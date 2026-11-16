"""Rascunho do plano de cenas a partir das marcações da copy: cada [MOTION] e cada [TELA: lettering "..."] do
teleprompter vira uma cena no tempo certo da sequência montada, com a frase-gatilho copiada da transcrição (do
jeito que foi falada) e uma sugestão de peças pelo tipo de fala. É um RASCUNHO: vai para
04-plano-de-cenas/rascunho-<seq>.md, o Claude refina com o editor e só o aprovado passa para o plano.

Convenções da copy (as do time):
- "...frase. [MOTION]" — o motion é da frase que vem antes da marcação;
- "[TELA: lettering "A · B · C"]" ou "[TELA: "texto"]" — lettering pronto: vira cena (da frase mais parecida, a de
  antes ou a de depois); "[TELA: fotos do Luan…]" sem aspas é B-roll: vira só uma nota "tela:" na cena mais perto;
- blocos: "[L1 · Título]", "[B4 · Título]" ou "--- BLOCO 5 · Título ---".
"""
import json
import os
import re

from .texto import achar, norm

BLOCO = re.compile(r"^\s*(?:-{3}\s*BLOCO\s*(\d+)\s*·\s*(.+?)\s*-{3}|\[\s*([LB])\s*(\d+)\s*·\s*([^\]]+?)\s*\])\s*$", re.I)
MARCA = re.compile(r"\[(MOTION|TELA)\s*(?::\s*([^\]]*))?\]", re.I)
OUTRAS = re.compile(r"\[[^\]]*\]")                          # [CONFIRMAR: …], [LACUNA: …], [CORTE: …]: fora da fala
DINHEIRO = re.compile(r"(?:R\$\s*)?(\d[\d.,]*)\s*(mil|milh(?:ão|ões))?\s*(?:reais|R\$)|R\$\s*(\d[\d.,]*)\s*(mil)?", re.I)
NUMERO = re.compile(r"(\+?\d[\d.,]*)\s*(%|mil)?\s+([a-zà-ú]{3,}(?:\s+[a-zà-ú]{2,})?)", re.I)


def _caixa(txt, nomes=()):
    """Lettering escrito em CAIXA ALTA na copy vira frase normal, preservando R$ e os nomes do config (STLFLIX…)."""
    if txt != txt.upper():
        return txt
    t = txt.lower()
    t = t[:1].upper() + t[1:]
    t = re.sub(r"\br\$", "R$", t)
    for n in nomes or ():
        t = re.sub(re.escape(n), n, t, flags=re.I)
    return t


def _frases(texto):
    """[(bloco, frase, marcas)] na ordem do teleprompter; marcas = [(tipo, conteúdo)] ligadas à frase."""
    out, bloco, pendentes = [], ("", ""), []
    for linha in texto.splitlines():
        m = BLOCO.match(linha)
        if m:
            bloco = (m.group(1) and ("B", int(m.group(1))) or (m.group(3).upper(), int(m.group(4))), (m.group(2) or m.group(5)).strip())
            continue
        so_marca = MARCA.sub("", linha).strip() == "" and MARCA.search(linha)
        if so_marca:                                        # [TELA: …] numa linha sozinha: decide depois (antes/depois)
            for tipo, conteudo in MARCA.findall(linha):
                pendentes.append(dict(tipo=tipo.upper(), conteudo=(conteudo or "").strip(), bloco=bloco, apos=len(out) - 1))
            continue
        partes = re.split(r"(?<=[.!?])\s+", linha.strip())
        for p in partes:
            if not p:
                continue
            marcas = [(t.upper(), (c or "").strip()) for t, c in MARCA.findall(p)]
            limpa = re.sub(r"\s+", " ", OUTRAS.sub("", MARCA.sub("", p))).strip()
            if len(norm(limpa)) >= 3:
                out.append(dict(bloco=bloco, frase=limpa, marcas=marcas))
            elif marcas and out:                            # "[MOTION]" sozinho depois do ponto final
                out[-1]["marcas"] += marcas
    for p in pendentes:                                     # [TELA] sozinha: frase de antes ou de depois, a mais parecida
        cands = [i for i in (p["apos"] - 1, p["apos"], p["apos"] + 1) if 0 <= i < len(out) and out[i]["bloco"] == p["bloco"]]
        if not cands:
            cands = [i for i in (p["apos"] + 1, p["apos"]) if 0 <= i < len(out)]
        if not cands:
            continue
        lettering = re.findall(r"[\"“]([^\"”]+)[\"”]", p["conteudo"])
        if lettering and len(cands) > 1:                    # a frase (até 2 antes ou 1 depois) que mais divide palavras
            alvo = set(t for t in norm(lettering[0]) if len(t) >= 3)
            sim = [len(alvo & set(norm(out[i]["frase"]))) for i in cands]
            i = cands[max(range(len(cands)), key=lambda k: (sim[k], cands[k] == p["apos"]))]
        else:
            i = cands[0] if p["apos"] >= 0 and out[cands[0]]["bloco"] == p["bloco"] else cands[-1]
        out[i]["marcas"].append((p["tipo"], p["conteudo"]))
    return out


def _codigo(chave, bloco, usados):
    letra = lambda base: next(base + c for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" if base + c not in usados)
    m = re.match(r"lead-?(\d+)", chave or "")
    if m:
        base = f"L{m.group(1)}"
    elif bloco[0]:
        base = f"{bloco[0][0]}{bloco[0][1]:02d}" if bloco[0][0] == "B" else f"{bloco[0][0]}{bloco[0][1]}"
    else:
        base = "M"
    c = letra(base)
    usados.add(c)
    return c


def _destaque(frase, maximo=5):
    """Título curto: o fim da frase (até `maximo` palavras), com a palavra mais longa em destaque."""
    ws = re.sub(r"[.!?…]+$", "", frase).split()
    ws = ws[-maximo:] if len(ws) > maximo else ws
    if not ws:
        return frase
    k = max(range(len(ws)), key=lambda i: len(re.sub(r"\W", "", ws[i])))
    ws[k] = f"**{ws[k].strip(',;:')}**" + (ws[k][-1] if ws[k][-1] in ",;:" else "")
    return " ".join(ws)


def _pecas(frase, telas, modelo, nomes=()):
    """Sugestão de peças (linha "> 0.3 | …") pelo tipo de fala."""
    for t in telas:                                         # lettering pronto na copy
        let = re.findall(r"[\"“]([^\"”]+)[\"”]", t)
        if not let:
            continue
        txt = let[0].strip()
        itens = [_caixa(i.strip(), nomes) for i in re.split(r"\s*·\s*", txt) if i.strip()]
        if len(itens) >= 2:
            return f"chips: {'; '.join(itens)} [passo=0.9]"
        return f"título: {_destaque(_caixa(txt, nomes), 10)}"
    m = DINHEIRO.search(frase)
    if m:
        num = (m.group(1) or m.group(3) or "").rstrip(".,")
        mil = (m.group(2) or m.group(4) or "").lower()
        valor = f"R$ {num}" + (f" {mil}" if mil else "")
        antes = frase[:m.start()].split()[-4:]
        kicker = " ".join(antes).strip(",:;").upper()
        depois = " ".join(frase[m.end():].split()[:5]).strip(",.;:!") or ""
        if modelo == "stlflix-cenas" and num.replace(".", "").isdigit():
            ate = int(num.replace(".", ""))
            suf = f' ,"suf":" {mil}"' if mil else ""
            pec = f'json: {{"k":"dinheiro","d":0.15,"de":0,"ate":{ate},"pre":"R$ "{suf.replace(" ,", ",")},"dur":1.4}}'
        else:
            pec = f"número: {valor} [verde, conta]"
        return " | ".join(x for x in (f"kicker: {kicker}" if kicker else "", pec, f"legenda: {depois} [atraso=2.0]" if depois else "") if x)
    m = NUMERO.search(frase)
    if m and not re.fullmatch(r"\d", m.group(1)):          # número de verdade (não "1 impressora")
        num = m.group(1) + (m.group(2) or "")
        legenda = re.sub(r"[?!.,;:]+", "", f"{m.group(3)} {' '.join(frase[m.end():].split()[:3])}").strip()
        return f"número: {num} [conta] | legenda: {legenda}"
    itens = [i.strip(" .?!") for i in re.split(r",\s*|\s+e\s+", frase) if i.strip(" .?!")]
    if itens and len(itens[0].split()) > 3:                 # "Ele decide pela foto" → "pela foto"
        itens[0] = " ".join(itens[0].split()[-2:])
    PREP = r"^(pel[ao]s?|[ao]s?|d[eoa]s?|com|no|na|nos|nas|em|um|uma)\s+"
    itens = [re.sub(PREP, "", i, flags=re.I) for i in itens]
    curtos = [i for i in itens if 1 <= len(i.split()) <= 3]
    if len(curtos) >= 3 and len(curtos) >= len(itens) - 1:
        return f"chips: {'; '.join(c[:1].upper() + c[1:] for c in curtos[:5])} [check, passo=1.0]"
    return f"título: {_destaque(frase)}"


def gerar(proj, chave, roteiro=None):
    """Escreve 04-plano-de-cenas/rascunho-<seq>.md → (caminho, cenas, frases marcadas não achadas)."""
    rot = roteiro or proj.caminho(proj["roteiro"])
    frases = _frases(open(rot, encoding="utf-8").read())
    m = re.match(r"lead-?(\d+)$", proj.chave(chave))         # cada sequência olha só os blocos dela
    if m and any(f["bloco"][0] == ("L", int(m.group(1))) for f in frases):
        frases = [f for f in frases if f["bloco"][0] == ("L", int(m.group(1)))]
    elif any(f["bloco"][0] and f["bloco"][0][0] == "B" for f in frases) and not m:
        frases = [f for f in frases if f["bloco"][0] and f["bloco"][0][0] == "B"]
    nomes = proj["transcricao"].get("nomes") or []
    js = proj.arquivo_transcricao(chave)
    if not os.path.exists(js):
        raise FileNotFoundError(f"a sequência ainda não foi transcrita: rode `transcrever {chave}` antes")
    tr = json.load(open(js, encoding="utf-8"))
    sin = proj["transcricao"].get("sinonimos")
    words = tr["words"]
    tokens, dono = [], []                                    # token → índice da palavra original
    for wi, w in enumerate(words):
        for tok in norm(w["text"], sin):
            tokens.append((tok, w["start"]))
            dono.append(wi)
    modelo = (proj.cfg.get("motions") or {}).get("modelo", "shark-vsl")
    cenas, fora, usados = [], [], set()
    for f in frases:
        motion = any(t == "MOTION" for t, _ in f["marcas"])
        telas = [c for t, c in f["marcas"] if t == "TELA"]
        lettering = [c for c in telas if re.search(r"[\"“]", c)]
        if not motion and not lettering:
            continue
        i, nota = achar(tokens, f["frase"], sinonimos=sin)
        if i is None or nota < 0.6:
            fora.append(f["frase"])
            continue
        q = norm(f["frase"], sin)
        for k in range(max(0, i - 3), min(len(tokens), i + 6)):   # alinha o começo na 1ª palavra da frase
            if tokens[k][0] == q[0] and (len(q) < 2 or k + 1 >= len(tokens) or tokens[k + 1][0] == q[1]):
                i = k
                break
        w0, w1 = dono[i], dono[min(len(dono) - 1, i + len(q) - 1)]
        n = 6
        while True:                                          # gatilho: 6+ palavras faladas, que não se repetem na sequência
            gat = " ".join(w["text"] for w in words[w0:w0 + n]).strip(" ,.;:!?")
            j, nj = achar(tokens, gat, inicio=i + 1, sinonimos=sin)
            if nj < 0.9 or n >= 9:
                break
            n += 1
        t0 = max(0.0, words[w0]["start"] - 0.2)
        fim = words[w1]["end"] + 1.0
        cenas.append(dict(bloco=f["bloco"], t0=t0, fim=fim, gatilho=gat, frase=f["frase"], motion=motion, telas=telas,
                          pecas=_pecas(f["frase"], lettering, modelo, nomes)))
    cenas.sort(key=lambda c: c["t0"])
    linhas = [f"# Rascunho do plano de cenas — {proj['nome'] or os.path.basename(proj.pasta)} · {chave} (não aprovado)", "",
              "Gerado das marcações [MOTION] e [TELA] da copy (`rascunho-plano`). Tempos e gatilhos da transcrição da "
              "sequência montada; as peças são só sugestão pelo tipo de fala — refine antes de passar para o plano.", ""]
    bloco_atual = None
    for k, c in enumerate(cenas):
        prox = cenas[k + 1]["t0"] if k + 1 < len(cenas) else None
        dur = min(12.0, max(4.0, c["fim"] - c["t0"]))
        if prox is not None:
            dur = max(2.5, min(dur, prox - c["t0"] - 0.3))
        if c["bloco"] != bloco_atual:
            bloco_atual = c["bloco"]
            (tipo, num), titulo = c["bloco"] if c["bloco"][0] else (("", 0), chave)
            rotulo = f"Lead {num}" if tipo == "L" else (f"Bloco {num:02d}" if tipo == "B" else chave)
            linhas += [f"## {rotulo} · {titulo}" if titulo != chave else f"## {chave}", ""]
        cod = _codigo(chave, c["bloco"], usados)
        nome = re.sub(r"[*\[\]]", "", c["frase"])[:48].rstrip(" ,.")
        linhas += [f"- **{cod}** · {nome} — \"{c['gatilho']}\"", f"  duração: {dur:.1f}", f"  > 0.3 | {c['pecas']}"]
        origem = (["[MOTION]"] if c["motion"] else []) + [f"[TELA: {t}]" for t in c["telas"]]
        linhas += [f"  origem: {' '.join(origem)}", f"  fala: {c['frase']}", ""]
    caminho = os.path.join(proj.pasta, "04-plano-de-cenas", f"rascunho-{proj.chave(chave)}.md")
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    open(caminho, "w", encoding="utf-8").write("\n".join(linhas))
    return caminho, cenas, fora
