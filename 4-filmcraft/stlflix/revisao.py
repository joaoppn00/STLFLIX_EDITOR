"""Decupagem sem repetição: o método que achou os tropeços escondidos nas VSLs Hian, 2124, 682, 2197 e 2198.

O Whisper "normal" limpa a fala: junta "o cliente está... o cliente já entra" numa frase só, não escreve uma
claquete falada baixinho e engole a repetição de três palavras. Este módulo procura isso em três momentos:

1. detalhar_take (no transcrever-brutos): passada LITERAL com um prompt cheio de tropeços (o Whisper passa a
   escrevê-los), janelas de 4 s a cada 2 s sem contexto (cada uma ouve a fala "do zero") e FALA BAIXA: trechos com
   energia de fala onde a passada literal não tem palavra nenhuma, transcritos um a um. Daí saem os pontos para
   conferir de cada take: repetições, palavras esticadas e fala baixa.
2. conferir_cortes (no decupar --conferir): micro-transcrição dos dois lados de cada emenda da decupagem; avisa
   corte no meio da fala, emenda que repete palavras e repetição / fala baixa dentro de um trecho "usa".
3. revisar (depois de transcrever a sequência montada): repetições na montagem e frases da copy que não apareceram,
   com o tempo na timeline e no bruto.
"""
import json
import os
import re
import wave

import numpy as np

from .tempo import mmss
from .texto import achar, norm

PROMPTS = {   # tropeços de propósito: com eles no prompt, o Whisper escreve as repetições em vez de limpá-las
    "pt": "Eh... e, e aí, tipo, tipo... é, de novo. E a partir de, e a partir de hoje você, você tem tudo.",
    "en": "Um... and, and then, like, like... yeah, again. So from, so from today you, you have it all.",
    "es": "Eh... y, y bueno, tipo, tipo... sí, otra vez. Y a partir de, y a partir de hoy tú, tú tienes todo.",
}
ALUCINACOES = re.compile(r"^(obrigad[oa]|tchau|e a[ií]|legendas?|inscreva|thank you|thanks|bye|gracias|subt[ií]tulos)\b", re.I)
SR = 16000


# ───── áudio e modelo ─────

def _audio(wav):
    with wave.open(wav, "rb") as w:
        sr, ch = w.getframerate(), w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    if sr != SR:
        x = np.interp(np.arange(0, len(x), sr / SR), np.arange(len(x)), x).astype(np.float32)
    return x


def _energia(x):
    """(fala, dB) em janelas de 10 ms — o mesmo critério da decupagem (18 dB acima do ruído de fundo)."""
    hop = SR // 100
    n = len(x) // hop
    db = 20 * np.log10(np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(axis=1)) + 1e-9)
    return db > np.percentile(db, 10) + 18, db


def _modelo(cfg):
    from .transcrever import _carregar            # só aqui: precisa do faster-whisper
    return _carregar(cfg["modelo"])[0]


def _palavras(m, x, idioma, a=0.0, prompt=None):
    segs, _ = m.transcribe(x, language=idioma, initial_prompt=prompt, condition_on_previous_text=False,
                           word_timestamps=True, vad_filter=False, beam_size=5)
    return [{"text": w.word.strip(), "start": round(a + w.start, 2), "end": round(a + w.end, 2)} for s in segs for w in (s.words or [])]


def micro(m, x, idioma, a, b, tropecos=True):
    """Transcreve só [a, b] (s) de um áudio, sem contexto: o jeito de ouvir uma emenda ou uma fala baixa.
    tropecos=False tira o prompt de tropeços (numa janela curta ele às vezes inventa uma repetição)."""
    a, b = max(0.0, a), min(len(x) / SR, b)
    if b - a < 0.2:
        return []
    return _palavras(m, x[int(a * SR):int(b * SR)], idioma, a, PROMPTS.get(idioma) if tropecos else None)


def _marcas(toks):
    """"stl" + palavra seguinte vira uma palavra só (o Whisper escreve "STL Flix", a copy "STLFLIX")."""
    out = []
    for t in toks:
        tok = t[0] if isinstance(t, tuple) else t
        prev = out[-1][0] if out and isinstance(out[-1], tuple) else (out[-1] if out else None)
        if prev == "stl" and tok != "stl":
            out[-1] = (prev + tok, out[-1][1]) if isinstance(t, tuple) else prev + tok
        else:
            out.append(t)
    return out


def _texto(ws):
    return " ".join(w["text"] for w in ws).strip()


# ───── o que procurar numa lista de palavras ─────

def tokens_da_copy(proj):
    """Tokens do teleprompter: o que a copy já repete de propósito não conta como tropeço."""
    rot = proj.caminho(proj["roteiro"]) if proj.cfg.get("roteiro") else ""
    if not (rot and os.path.exists(rot)):
        return []
    return _marcas(norm(re.sub(r"\[[^\]]*\]", " ", open(rot, encoding="utf-8").read()), proj["transcricao"].get("sinonimos")))


def _vezes(tokens, g):
    n = len(g)
    return sum(1 for k in range(len(tokens) - n + 1) if tokens[k:k + n] == g)


def repeticoes(palavras, janela=15.0, sinonimos=None, copia=None):
    """Sequências de palavras ditas de novo logo depois: 3 palavras iguais em até `janela` s (4 em 2×, 5+ em 4×), ou 2 palavras
    repetidas com no máximo 2 palavras no meio ("o cliente está... o cliente já"). Ignora o que a copy já repete
    (`copia` = tokens do teleprompter). → [{t1, t2, texto}]"""
    toks = _marcas([(tok, w["start"]) for w in palavras for tok in norm(w["text"], sinonimos)])
    copia = copia or []
    achados, usados = [], set()
    for n in (6, 5, 4, 3, 2):
        for i in range(len(toks) - n + 1):
            if i in usados:
                continue
            g = [t for t, _ in toks[i:i + n]]
            if n == 2 and max(len(t) for t in g) < 3:
                continue
            if copia and _vezes(copia, g) >= 2:
                continue
            fim_busca = i + n + (3 if n == 2 else 60)
            for j in range(i + 1, min(len(toks) - n + 1, fim_busca)):
                limite = janela if n <= 3 else (janela * 2 if n == 4 else janela * 4)   # frase longa refeita depois de uma pausa
                if [t for t, _ in toks[j:j + n]] == g and toks[j][1] - toks[i][1] <= limite and j >= i + n - 1:
                    achados.append(dict(t1=toks[i][1], t2=toks[j][1], texto=" ".join(g)))
                    usados.update(range(i, i + n))
                    usados.update(range(j, j + n))
                    break
    juntos = []                                            # a mesma frase longa repetida vira um aviso só
    for r in sorted(achados, key=lambda r: r["t1"]):
        p = juntos[-1] if juntos else None
        if p and abs((r["t2"] - r["t1"]) - (p["t2"] - p["t1"])) < 1.5 and r["t1"] - p["_ult"] <= 6:
            p["texto"] += " " + r["texto"]
            p["_ult"] = r["t1"]
        else:
            juntos.append(dict(r, _ult=r["t1"]))
    return [{k: v for k, v in r.items() if k != "_ult"} for r in juntos]


def esticadas(palavras, minimo=1.5):
    """Palavra que "dura" demais: o Whisper costuma esconder ali uma pausa com tropeço ou uma repetição."""
    return [dict(t=w["start"], dur=round(w["end"] - w["start"], 2), texto=w["text"]) for w in palavras if w["end"] - w["start"] >= minimo]


def falas_baixas(m, x, idioma, palavras, min_s=0.35):
    """Trechos com energia de fala onde a passada literal não pôs palavra nenhuma (claquete falada baixinho, uma
    frase repetida em voz baixa): transcreve cada um isolado. → [{a, b, texto}]"""
    fala, _ = _energia(x)
    cobertos = np.zeros(len(fala), bool)
    for w in palavras:
        cobertos[max(0, int(w["start"] * 100) - 15):int(w["end"] * 100) + 15] = True
    livre = fala & ~cobertos
    idx = np.flatnonzero(livre)
    if idx.size == 0:
        return []
    ilhas, s, ant = [], idx[0], idx[0]
    for k in idx[1:]:
        if k - ant > 25:                                   # junta pedaços separados por menos de 0,25 s
            ilhas.append((s, ant + 1))
            s = k
        ant = k
    ilhas.append((s, ant + 1))
    out = []
    for i0, i1 in ilhas:
        if (i1 - i0) / 100 < min_s:
            continue
        a, b = i0 / 100 - 0.25, i1 / 100 + 0.25
        txt = _texto(micro(m, x, idioma, a, b))
        if txt and not ALUCINACOES.match(txt.strip(" .!?,")):
            out.append(dict(a=round(a, 2), b=round(b, 2), texto=txt))
    return out


def repeticoes_nas_janelas(janelas, sinonimos=None, copia=None):
    """Repetição escrita dentro de uma janela de 4 s ("procura aquele produto. Procura aquele produto."): a janela
    ouve sem contexto e costuma escrever o tropeço que a passada longa limpou. → [{t, texto}] (uma por trecho)"""
    out = []
    for j in janelas:
        ws = [{"text": tok, "start": j["t"] + k * 0.01} for k, tok in enumerate(norm(j["texto"], sinonimos))]
        for p in repeticoes(ws, janela=99, sinonimos=sinonimos, copia=copia):
            if not any(abs(o["t"] - j["t"]) <= 4 and (p["texto"] in o["texto"] or o["texto"] in p["texto"]) for o in out):
                out.append(dict(t=j["t"], texto=p["texto"], janela=j["texto"]))
    return out


# ───── 1. brutos ─────

def detalhar_take(proj, wav, saida, refazer=False):
    """Passada literal + janelas + fala baixa de um take → <take>.literal.json (pulado se já existe e é mais novo)."""
    if not refazer and os.path.exists(saida) and os.path.getmtime(saida) >= os.path.getmtime(wav):
        return json.load(open(saida, encoding="utf-8"))
    cfg = proj["transcricao"]
    idioma, sin = cfg["idioma"], cfg.get("sinonimos")
    m, x = _modelo(cfg), _audio(wav)
    prompt = PROMPTS.get(idioma, "") + (" " + ", ".join(cfg.get("nomes") or []) + "." if cfg.get("nomes") else "")
    palavras = _palavras(m, x, idioma, 0.0, prompt)
    janelas, t, dur = [], 0.0, len(x) / SR
    while t < dur - 0.5:                                   # 4 s a cada 2 s, sem contexto: cada janela ouve "do zero"
        y = x[int(t * SR):int(min(dur, t + 4) * SR)]
        if np.sqrt((y ** 2).mean()) > 0.003:               # pula silêncio (evita "Obrigado!" inventado)
            txt = " ".join(s.text.strip() for s in m.transcribe(y, language=idioma, condition_on_previous_text=False,
                                                                vad_filter=False, beam_size=5)[0]).strip()
            if txt and not ALUCINACOES.match(txt.strip(" .!?,")):
                janelas.append(dict(t=round(t, 1), texto=txt))
        t += 2.0
    copia = tokens_da_copy(proj)
    r = dict(palavras=palavras, janelas=janelas, baixas=falas_baixas(m, x, idioma, palavras),
             repeticoes=repeticoes(palavras, sinonimos=sin, copia=copia), esticadas=esticadas(palavras),
             nas_janelas=repeticoes_nas_janelas(janelas, sin, copia))
    json.dump(r, open(saida, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return r


def pontos_md(r):
    """Linhas de "pontos para conferir" de um take, em ordem de tempo, para o brutos.md."""
    itens = [(p["t1"], f"⟳ **{mmss(p['t1'])} / {mmss(p['t2'])}** disse duas vezes: \"{p['texto']}\"") for p in r["repeticoes"]]
    itens += [(p["t"], f"⚠ **{mmss(p['t'])}** palavra esticada ({p['dur']:.1f} s): \"{p['texto']}\" — pode esconder pausa ou repetição") for p in r["esticadas"]]
    itens += [(p["a"], f"🔈 **{mmss(p['a'])}–{mmss(p['b'])}** fala baixa que a transcrição normal não pegou: \"{p['texto']}\"") for p in r["baixas"]]
    itens += [(p["t"], f"⟳ **{mmss(p['t'])}–{mmss(p['t'] + 4)}** repetição ouvida de perto: \"{p['texto']}\" — {p['janela']}") for p in r.get("nas_janelas", [])
              if not any(abs(q["t1"] - p["t"]) <= 4 or abs(q["t2"] - p["t"]) <= 4 for q in r["repeticoes"])]
    return [f"- {txt}" for _, txt in sorted(itens)]


# ───── 2. emendas da decupagem ─────

def conferir_cortes(proj, trechos):
    """Para cada trecho "usa" (na ordem da timeline): repetição e fala baixa dentro dele, e as duas pontas de cada
    emenda ouvidas de perto. → [{onde, avisos:[...], esquerda, direita}]"""
    from .decupagem import pasta_brutos
    cfg = proj["transcricao"]
    idioma, sin = cfg["idioma"], cfg.get("sinonimos")
    pasta, cache, m = pasta_brutos(proj), {}, None
    usados = [t for t in trechos if t["tipo"] == "usa"]

    def take(nome):
        if nome not in cache:
            wav = os.path.join(pasta, nome + ".wav")
            lit = os.path.join(pasta, nome + ".literal.json")
            cache[nome] = (_audio(wav), json.load(open(lit, encoding="utf-8")) if os.path.exists(lit) else None) if os.path.exists(wav) else None
        return cache[nome]

    out = []
    for i, t in enumerate(usados):
        tk = take(t["take"])
        if tk is None:
            continue
        x, lit = tk
        fala, _ = _energia(x)
        avisos = []
        if lit:
            for p in lit["repeticoes"]:
                if t["a"] <= p["t1"] and p["t2"] <= t["b"]:
                    avisos.append(f"dentro do trecho ele disse duas vezes \"{p['texto']}\" ({mmss(p['t1'])} e {mmss(p['t2'])})")
            for p in lit["baixas"]:
                if p["a"] < t["b"] and t["a"] < p["b"]:
                    avisos.append(f"fala baixa em {mmss(p['a'])} que a transcrição normal não pegou: \"{p['texto']}\" — é para entrar? (claquete, repetição dita baixinho?)")
        prox = usados[i + 1] if i + 1 < len(usados) else None
        esq = dir_ = ""
        if prox and take(prox["take"]) is not None:
            m = m or _modelo(cfg)
            x2 = take(prox["take"])[0]
            fala2, _ = _energia(x2)
            we = micro(m, x, idioma, t["b"] - 3.0, t["b"], tropecos=False)        # cada lado ouve só o que fica na montagem
            wd = micro(m, x2, idioma, prox["a"], prox["a"] + 3.0, tropecos=False)
            esq, dir_ = _texto(we), _texto(wd)
            if fala[max(0, int(t["b"] * 100) - 2):int(t["b"] * 100) + 2].any():
                avisos.append(f"o fim ({mmss(t['b'])}) cai no meio da fala")
            if fala2[max(0, int(prox["a"] * 100) - 2):int(prox["a"] * 100) + 2].any():
                avisos.append(f"o começo do trecho seguinte ({mmss(prox['a'])}) cai no meio da fala")
            ne, nd = norm(esq, sin)[-6:], norm(dir_, sin)[:6]
            for n in (4, 3, 2):
                comuns = {tuple(ne[k:k + n]) for k in range(len(ne) - n + 1)} & {tuple(nd[k:k + n]) for k in range(len(nd) - n + 1)}
                comuns = [c for c in comuns if n > 2 or max(len(w) for w in c) >= 3]
                if comuns:
                    avisos.append(f"a emenda repete \"{' '.join(comuns[0])}\" dos dois lados — sobrou um pedaço do tropeço?")
                    break
        out.append(dict(trecho=t, prox=prox, avisos=avisos, esquerda=esq, direita=dir_))
    return out


def tabela_cortes(res):
    linhas, n = [], 0
    for r in res:
        t = r["trecho"]
        cab = f"{t['take']} {mmss(t['a'])}-{mmss(t['b'])} (linha {t['linha']})"
        if r["prox"] is not None:
            p = r["prox"]
            cab += f"  →  {p['take']} {mmss(p['a'])}"
        if r["avisos"]:
            n += len(r["avisos"])
            linhas.append(f"  ✗ {cab}")
            linhas += [f"      · {a}" for a in r["avisos"]]
            if r["esquerda"] or r["direita"]:
                linhas.append(f"      antes: …{r['esquerda'][-70:]}")
                linhas.append(f"      depois: {r['direita'][:70]}…")
    linhas.append(f"{len(res)} trechos conferidos · {n} pontos para ouvir" + ("" if n else " — nenhuma emenda suspeita"))
    return "\n".join(linhas)


# ───── 3. sequência montada ─────

def _frases_da_copy(texto):
    """Frases do teleprompter (sem títulos, [notas] e linhas de bloco)."""
    texto = re.sub(r"\[[^\]]*\]", " ", texto)
    linhas = [l for l in texto.splitlines() if l.strip() and not re.match(r"^\s*(#|---|L\d|B\d)", l.strip())]
    frases = re.split(r"(?<=[.!?])\s+", " ".join(linhas))
    return [f.strip() for f in frases if len(norm(f)) >= 4]


def _no_bruto(cortes, t):
    for c in cortes or []:
        if c["start"] <= t < c["start"] + c["dur"]:
            return f"{os.path.splitext(c['take'])[0]} {mmss(c['src_in'] + t - c['start'])}"
    return ""


def revisar(proj, chave):
    """Na transcrição da sequência montada: repetições, palavras esticadas e frases da copy que não apareceram."""
    js = proj.arquivo_transcricao(chave)
    if not os.path.exists(js):
        raise FileNotFoundError(f"a sequência ainda não foi transcrita: rode `transcrever {chave}` antes")
    tr = json.load(open(js, encoding="utf-8"))
    sin = proj["transcricao"].get("sinonimos")
    try:
        cortes = json.load(open(proj.arquivo_transcricao(chave, "cortes.json"), encoding="utf-8"))["cortes"]
    except (OSError, ValueError, KeyError, TypeError):
        cortes = []
    reps = repeticoes(tr["words"], sinonimos=sin, copia=tokens_da_copy(proj))
    est = esticadas(tr["words"], 1.2)
    faltam = []
    rot = proj.caminho(proj["roteiro"]) if proj.cfg.get("roteiro") else ""
    if rot and os.path.exists(rot):
        frases = _frases_da_copy(open(rot, encoding="utf-8").read())
        tokens = [(tok, w["start"]) for w in tr["words"] for tok in norm(w["text"], sin)]
        notas = [achar(tokens, f, sinonimos=sin) for f in frases]
        achadas = [i for i, (_, r) in enumerate(notas) if r >= 0.75]
        grupos = []                                        # só o pedaço da copy que esta sequência cobre (lead ≠ corpo):
        for i in achadas:                                  # o maior bloco de frases achadas, sem buracos de mais de 3
            if grupos and i - grupos[-1][-1] <= 4:
                grupos[-1].append(i)
            else:
                grupos.append([i])
        if grupos:
            g = max(grupos, key=len)
            for i in range(g[0], g[-1] + 1):
                if notas[i][1] < 0.6:
                    faltam.append(dict(frase=frases[i], nota=round(notas[i][1], 2)))
    return dict(repeticoes=[dict(r, bruto=_no_bruto(cortes, r["t2"])) for r in reps],
                esticadas=[dict(e, bruto=_no_bruto(cortes, e["t"])) for e in est], faltam=faltam)


def tabela_revisao(r):
    linhas = []
    for p in r["repeticoes"]:
        linhas.append(f"  ⟳ {mmss(p['t1'])} e {mmss(p['t2'])}: \"{p['texto']}\" duas vezes" + (f"  (2ª no bruto: {p['bruto']})" if p["bruto"] else ""))
    for p in r["esticadas"]:
        linhas.append(f"  ⚠ {mmss(p['t'])}: \"{p['texto']}\" esticada ({p['dur']:.1f} s)" + (f"  (bruto: {p['bruto']})" if p["bruto"] else ""))
    for p in r["faltam"]:
        linhas.append(f"  ? frase da copy que não achei na montagem ({p['nota']:.2f}): \"{p['frase'][:90]}\"")
    n = len(r["repeticoes"]) + len(r["esticadas"])
    linhas.append(f"{len(r['repeticoes'])} repetições · {len(r['esticadas'])} palavras esticadas · {len(r['faltam'])} frases da copy não achadas"
                  + (" — montagem limpa" if not n and not r["faltam"] else " — ouça cada ponto antes de mexer"))
    return "\n".join(linhas)
