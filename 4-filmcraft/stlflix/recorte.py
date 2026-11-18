"""Texto atrás da cabeça: recorta o apresentador (IA do HyperFrames) no trecho de um motion e põe o recorte por cima dele.

Como funciona, para cada cena pedida (o motion já encaixado na trilha de motions):
1. exporta só a câmera (as trilhas acima da V1 desligadas) no trecho do motion, em ProRes, na metade do tamanho (1080×1920);
2. tira o fundo com o modelo do `hyperframes remove-background` (u2net), rodando na GPU (fundo.py, num ambiente
   próprio criado na 1ª vez); sem GPU, usa o próprio HyperFrames no processador (~6× mais lento);
3. o recorte sai na velocidade exata da sequência (o HyperFrames grava 23,98 em vez de 23,976: o kit regrava);
4. importa e coloca na trilha de recorte (V3), no **mesmo quadro** em que o trecho exportado começa, na escala 200;
5. confere: compara quadros com e sem o recorte (sem os motions); se a pessoa não bate com a câmera, avisa.

Só nas cenas de **número grande** (`numeros_grandes`): em título, legenda e chips a cabeça esconde o meio da frase.

Cuidados que custaram um teste (VSL-Lincoln, Lead 3):
- o FilmCraft arredonda o começo da exportação para o quadro de baixo; por isso o recorte é posicionado pelo número do quadro,
  nunca pelos segundos (1 quadro de atraso vira um fantasma em cada corte da bruta);
- o recorte é da câmera **já montada** (com os cortes e crossfades da V1), então ele acompanha os cortes que caem dentro do motion.
"""
import json
import os
import re
import shutil
import subprocess
import time

from .fc import FC
from .tempo import T

TRILHA = "V3"
VERSAO_RECORTE = 2          # muda quando o jeito de recortar muda: recortes antigos são refeitos
ESCALA_EXPORT = 0.5              # 2160×3840 → 1080×1920 (mesmo tamanho dos motions)


def _id_da_cena(nome):
    return nome.split("-", 1)[0].upper()


def cenas_na_timeline(seq, trilha_motions):
    """{id da cena: [clipes]} dos motions na trilha de motions; cada clipe = (quadro inicial, quadro final, segundo do .mov
    onde ele começa). Um motion encurtado tem 2 clipes (o meio foi cortado)."""
    nome = "Video " + trilha_motions.lstrip("Vv")
    trilha = next((t for t in seq["video"] if t["name"] == nome), None)
    out = {}
    for c in (trilha["items"] if trilha else []):
        if not c["name"].lower().endswith(".mov") or "recorte" in c["name"].lower():
            continue
        out.setdefault(_id_da_cena(c["name"]), []).append((c["startFrame"], c["endFrame"], c["sourceIn"] / T))
    return out


def extensao(clipes):
    return min(c[0] for c in clipes), max(c[1] for c in clipes)


PECAS_GRANDES = re.compile(r'(^|\|)\s*número\s*:|"k"\s*:\s*"(dinheiro|cartao)"', re.I)   # número, contador e cartão de preço
BATIDA = re.compile(r"^\s*>\s*([\d.]+)\s*\|")


def _entrada_do_numero(linha):
    """Segundos entre o começo da batida e a entrada do número: o "d" do contador de dinheiro ou do cartão, ou o atraso padrão de uma
    peça que não é a primeira da batida. O recorte entra aí, e não no começo da batida: antes disso o texto da batida
    anterior ainda está saindo, e ele ficaria atrás da cabeça (foi o que estragou a 1ª versão da L1A)."""
    import json as _j
    m = re.search(r"json:\s*(\{.*?\})\s*(\||$)", linha)
    if m:
        try:
            o = _j.loads(m.group(1))
            if o.get("k") in ("dinheiro", "cartao"):
                return float(o.get("d", 0.15))
        except ValueError:
            pass
    pecas = [p.strip() for p in linha.split("|")[1:]]
    i = next((k for k, p in enumerate(pecas) if p.lower().startswith("número")), 0)
    return 0.15 if i > 0 else 0.0


def numeros_grandes(caminho_plano):
    """{id: [(de, até), …]} em segundos do motion: as batidas com número grande (número: …, contador de dinheiro ou
    cartão de preço, como o "R$ 110 por rolo" — o cartão passando atrás do boné foi aprovado na L1A);
    `até` None = até o fim. Só nelas o texto atrás da cabeça funciona: em título, legenda e chips a cabeça esconde o
    meio da frase, por isso o recorte entra só nessas batidas, não na cena inteira."""
    from .plano import CENA
    batidas, atual = {}, None
    for linha in open(caminho_plano, encoding="utf-8"):
        m = CENA.match(linha)
        if m:
            atual = m.group(1).upper()
            batidas[atual] = []
            continue
        m = BATIDA.match(linha)
        if atual and m:
            batidas[atual].append((float(m.group(1)), bool(PECAS_GRANDES.search(linha)), _entrada_do_numero(linha)))
    out = {}
    for cid, bs in batidas.items():
        faixas = []
        for i, (t, grande, entra) in enumerate(bs):
            if not grande:
                continue
            fim = bs[i + 1][0] if i + 1 < len(bs) else None
            if faixas and faixas[-1][1] == t:            # batidas grandes seguidas viram uma faixa só
                faixas[-1] = (faixas[-1][0], fim)
            else:
                faixas.append((t + entra, fim))
        if faixas:
            out[cid] = faixas
    return out


def quadros_da_batida(clipes, faixas, fps_seq):
    """(quadro inicial, quadro final) na timeline que cobre as batidas grandes, respeitando o corte do motion encurtado.
    Começa 2 quadros antes de o número entrar e vai até o fim da última faixa."""
    def na_timeline(seg):
        for a, b, src in clipes:
            q = a + round((seg - src) * fps_seq)
            if a <= q <= b:
                return q
        return None
    a_cena, b_cena = extensao(clipes)
    de = na_timeline(faixas[0][0])
    ate = b_cena if faixas[-1][1] is None else na_timeline(faixas[-1][1])
    de = a_cena if de is None else max(a_cena, de - 2)
    ate = b_cena if ate is None else min(b_cena, ate)
    return de, ate


def _trilha(seq, nome_curto):
    nome = "Video " + nome_curto.lstrip("Vv")
    return next((t for t in seq["video"] if t["name"] == nome), None)


def _abrir(fc, seq_id):
    """Abre a sequência e confere que é ela a ativa: os comandos de timeline agem na sequência aberta, e o editor
    pode ter clicado em outra durante o recorte (foi assim que um recorte da Lead 3 caiu na Lead 1)."""
    fc.run("sequence.open", item=seq_id)
    ativa = fc.run("sequence.inspect")["id"]
    if ativa != seq_id:
        raise RuntimeError(f"não consegui abrir a sequência {seq_id} (aberta: {ativa})")


def _ligar(fc, seq, ligar):
    """Liga/desliga as trilhas de vídeo acima da V1; devolve o estado anterior para restaurar."""
    antes = {}
    for t in seq["video"][1:]:
        antes[t["id"]] = t["enabled"]
        if t["enabled"] != ligar:
            fc.run("timeline.setTrack", track=t["id"], enabled=ligar)
    return antes


def _restaurar(fc, antes):
    for tid, en in antes.items():
        fc.run("timeline.setTrack", track=tid, enabled=en)


# --- tirar o fundo: na GPU (ambiente próprio, criado na 1ª vez) ou, sem ele, no HyperFrames (processador) ---------
VENV_GPU = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "STLFLIX_EDITOR", "venv-gpu")
PACOTES_GPU = ["onnxruntime-gpu==1.22.0", "nvidia-cuda-runtime-cu12", "nvidia-cublas-cu12", "nvidia-cudnn-cu12==9.10.2.21",
               "nvidia-cufft-cu12", "nvidia-curand-cu12", "numpy", "opencv-python-headless>=4.9,<5"]
# Versões casadas de propósito: o onnxruntime-gpu mais novo usa CUDA 13 (o driver das máquinas é CUDA 12.8) e o cuDNN
# mais novo quebra o 1.22. Ambiente separado porque o faster-whisper do venv principal usa o onnxruntime comum.


def _python_gpu(log=print):
    py = os.path.join(VENV_GPU, "Scripts", "python.exe")
    marca = os.path.join(VENV_GPU, "pacotes.txt")
    if os.path.exists(py) and os.path.exists(marca) and open(marca, encoding="utf-8").read() == " ".join(PACOTES_GPU):
        return py
    import sys
    log("  preparando a GPU para tirar o fundo (só na primeira vez, ~2 GB, alguns minutos)…")
    subprocess.run([sys.executable, "-m", "venv", VENV_GPU], check=True)
    subprocess.run([py, "-m", "pip", "install", "-q", "--disable-pip-version-check"] + PACOTES_GPU, check=True)
    open(marca, "w", encoding="utf-8").write(" ".join(PACOTES_GPU))
    return py


def tirar_fundo(entrada, saida, num, den, versao_hf, log=print):
    """GPU (fundo.py no venv-gpu, ~19 quadros/s na RTX 4060) e, se não der, HyperFrames no processador (~3/s)."""
    try:
        py = _python_gpu(log)
        r = subprocess.run([py, os.path.join(os.path.dirname(__file__), "fundo.py"), entrada, saida, str(num), str(den)],
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode == 0:
            return json.loads(r.stdout.strip().splitlines()[-1])["onde"]
        log("  ⚠ a GPU não rodou (" + (r.stderr or "")[-200:].strip() + "); indo pelo HyperFrames no processador")
    except Exception as e:                       # sem internet na 1ª vez, sem placa NVIDIA…
        log(f"  ⚠ ambiente da GPU indisponível ({e}); indo pelo HyperFrames no processador")
    bruto = saida.replace(".mov", "-hf.mov")
    remover_fundo(entrada, bruto, versao_hf)
    acertar_velocidade(bruto, saida, num, den)
    os.remove(bruto)
    return "processador (HyperFrames)"


def _npx():
    return shutil.which("npx.cmd") or shutil.which("npx") or "npx"


def remover_fundo(entrada, saida, versao):
    r = subprocess.run([_npx(), "--yes", f"hyperframes@{versao}", "remove-background", entrada, "-o", saida, "--device", "auto"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0 or not os.path.exists(saida):
        raise RuntimeError("remove-background falhou: " + (r.stderr or r.stdout)[-600:])


def acertar_velocidade(entrada, saida, num, den):
    """Regrava com a velocidade exata da sequência (um quadro por quadro, sem pular nem repetir)."""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", entrada, "-vf", f"setpts=N*{den}/{num}/TB", "-r", f"{num}/{den}",
                    "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", "-an", saida], check=True)


def _conferir(fc, seq_id, quadros, clipe, num, den, pasta):
    """% de pixels que mudam ao ligar o recorte (sem os motions). A pessoa recortada em cima dela mesma muda ~0."""
    import cv2
    import numpy as np
    _abrir(fc, seq_id)
    seq = fc.run("sequence.inspect", item=seq_id)
    antes = _ligar(fc, seq, False)
    v3 = next(t for t in seq["video"] if any(c["clip"] == clipe for c in t["items"]))
    piores = []
    try:
        for q in quadros:
            t = round(q * T * den / num)
            _abrir(fc, seq_id)
            fc.run("timeline.setTrack", track=v3["id"], enabled=True)
            fc.run("file.exportFrame", path=os.path.join(pasta, "_com.png"), format="png", sequence=seq_id, time=t)
            fc.run("timeline.setTrack", track=v3["id"], enabled=False)
            fc.run("file.exportFrame", path=os.path.join(pasta, "_sem.png"), format="png", sequence=seq_id, time=t)
            a = cv2.imread(os.path.join(pasta, "_com.png"), 0).astype(float)
            b = cv2.imread(os.path.join(pasta, "_sem.png"), 0).astype(float)
            piores.append((np.abs(a - b) > 25).mean() * 100)
    finally:
        _abrir(fc, seq_id)
        _restaurar(fc, antes)
        for f in ("_com.png", "_sem.png"):
            try:
                os.remove(os.path.join(pasta, f))
            except OSError:
                pass
    return max(piores) if piores else 0.0


def recortar(fc, proj, chave, cena, a, b, versao, log=print):
    """Faz o recorte de uma cena (quadros a..b da sequência) e põe na V3. Devolve (arquivo, clipe, % desalinhado)."""
    nome_seq = proj.sequencia(chave)
    seq_id = fc.sequencias()[nome_seq]
    _abrir(fc, seq_id)
    seq = fc.run("sequence.inspect", item=seq_id)
    fr = seq["settings"]["frame_rate"]
    num, den = fr["num"], fr["den"]
    pasta = os.path.join(proj.pasta_de("motions"), "recorte")
    os.makedirs(pasta, exist_ok=True)
    camera = os.path.join(pasta, f"{cena}-camera.mov")
    final = os.path.join(pasta, f"{cena}-recorte.mov")
    marca = os.path.join(pasta, f"{cena}-recorte.json")      # de que trecho é o .mov: refazer o mesmo trecho reaproveita
    trecho = {"sequencia": nome_seq, "de": a, "ate": b, "versao": VERSAO_RECORTE}
    try:
        pronto = os.path.exists(final) and json.load(open(marca, encoding="utf-8")) == trecho
    except (OSError, ValueError):
        pronto = False

    if pronto:
        log(f"  {cena}: o recorte deste trecho já existe, reaproveitando")
    else:
        # 1. só a câmera, no trecho exato (quadros a..b)
        antes = _ligar(fc, seq, False)
        try:
            log(f"  {cena}: exportando a câmera ({(b - a) / num * den:.1f} s)…")
            fc.run("file.exportMedia", path=camera, format="prores", proresProfile="hq", scale=ESCALA_EXPORT, audio=False,
                   sequence=seq_id, range="custom", startSeconds=a * den / num, endSeconds=b * den / num, wait=True)
        finally:
            _abrir(fc, seq_id)
            _restaurar(fc, antes)

        # 2 e 3. tira o fundo (já sai na velocidade da sequência)
        t0 = time.time()
        log(f"  {cena}: tirando o fundo…")
        onde = tirar_fundo(camera, final, num, den, versao, log)
        os.remove(camera)
        json.dump(trecho, open(marca, "w", encoding="utf-8"), ensure_ascii=False)
        log(f"  {cena}: recorte pronto em {time.time() - t0:.0f} s ({onde})")
        fc = FC()                # o FilmCraft derruba a conexão parada durante o recorte (minutos): abre outra

    # 4. tira o recorte antigo desta cena, importa e coloca no quadro a
    _abrir(fc, seq_id)
    seq = fc.run("sequence.inspect", item=seq_id)
    if _trilha(seq, TRILHA) is None:
        fc.run("sequence.addTracks", video=1)
        seq = fc.run("sequence.inspect", item=seq_id)
    trilha = _trilha(seq, TRILHA)
    velhos = [c["clip"] for c in trilha["items"] if _id_da_cena(c["name"]) == cena and "recorte" in c["name"].lower()]
    if velhos:
        fc.run("timeline.delete", clips=velhos)
    item = fc.run("file.import", paths=[final])["items"][0]          # nunca replace=True: ele troca o projeto inteiro
    _abrir(fc, seq_id)
    clipe = fc.run("timeline.place", item=item, track=TRILHA, frame=a, insert=False, audio=False)["clips"][0]
    fc.run("effects.setParam", clip=clipe, effect="motion", param="scale", value=round(100 / ESCALA_EXPORT))
    if not trilha["enabled"]:
        fc.run("timeline.setTrack", track=trilha["id"], enabled=True)

    # 5. confere o alinhamento no começo, no meio e no fim
    erro = _conferir(fc, seq_id, [a + 1, (a + b) // 2, b - 2], clipe, num, den, pasta)
    return final, clipe, erro
