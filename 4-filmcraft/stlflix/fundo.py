"""Tira o fundo de um vídeo na placa de vídeo (GPU): o mesmo modelo e as mesmas contas do `hyperframes remove-background`
(u2net_human_seg, entrada 320×320, máscara esticada de volta com lanczos), só que rodando no onnxruntime com CUDA,
e com a borda refinada por um filtro guiado (`refinar`).
Na RTX 4060: ~10× mais rápido que o HyperFrames no processador. Sem GPU, cai para o processador sozinho.

Sai ProRes 4444 com transparência, já na velocidade pedida (num/den), um quadro de saída por quadro de entrada.
"""
import os
import subprocess
import time
import urllib.request

import numpy as np

MODELO_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx"
LADO = 320
MEDIA = np.array([0.485, 0.456, 0.406], np.float32)
DESVIO = np.array([0.229, 0.224, 0.225], np.float32)


def _modelo():
    """O mesmo arquivo que o HyperFrames baixa (reaproveita o cache dele)."""
    cache = os.path.join(os.path.expanduser("~"), ".cache", "hyperframes", "background-removal", "models")
    caminho = os.path.join(cache, "u2net_human_seg.onnx")
    if not os.path.exists(caminho):
        os.makedirs(cache, exist_ok=True)
        urllib.request.urlretrieve(MODELO_URL, caminho + ".part")
        os.replace(caminho + ".part", caminho)
    return caminho


def sessao():
    import onnxruntime as ort
    try:
        ort.preload_dlls()                       # CUDA/cuDNN dos pacotes nvidia-* do pip
    except Exception:
        pass
    prov = [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider") if p in ort.get_available_providers()]
    s = ort.InferenceSession(_modelo(), providers=prov)
    s.run(None, {s.get_inputs()[0].name: np.zeros((1, 3, LADO, LADO), np.float32)})   # se a GPU falhar, ele cai para o processador aqui
    return s, ("GPU" if s.get_providers()[0] == "CUDAExecutionProvider" else "processador")


def _caixa(x, r):
    import cv2
    return cv2.boxFilter(x, -1, (2 * r + 1, 2 * r + 1))


def refinar(rgb, m, raio=6, eps=1e-3):
    """A máscara do modelo sai em 320×320 e, esticada, fica com a borda mole (halo em volta do boné por cima do número).
    Filtro guiado pela própria imagem (a borda segue o contorno real) + curva que firma a transição."""
    import cv2
    g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    p = m.astype(np.float32) / 255
    mg, mp = _caixa(g, raio), _caixa(p, raio)
    A = (_caixa(g * p, raio) - mg * mp) / (_caixa(g * g, raio) - mg * mg + eps)
    B = mp - A * mg
    q = _caixa(A, raio) * g + _caixa(B, raio)
    q = np.clip((q - 0.5) / 0.3 + 0.5, 0, 1)
    return np.round(q * 255).astype(np.uint8)


def _sonda(caminho):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                          "-of", "csv=p=0", caminho], capture_output=True, text=True, check=True).stdout.strip()
    w, h = out.split(",")[:2]
    return int(w), int(h)


def remover(entrada, saida, num=24000, den=1001, log=None):
    """Recorta a pessoa de `entrada` e grava `saida` (.mov ProRes 4444 com alfa). Devolve (quadros, segundos, onde rodou)."""
    import cv2
    s, onde = sessao()
    nome_in, nome_out = s.get_inputs()[0].name, s.get_outputs()[0].name
    w, h = _sonda(entrada)
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", entrada, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                           stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{w}x{h}",
                            "-r", f"{num}/{den}", "-i", "-", "-c:v", "prores_ks", "-profile:v", "4444",
                            "-pix_fmt", "yuva444p10le", "-r", f"{num}/{den}", saida], stdin=subprocess.PIPE)
    n, t0, tam = 0, time.time(), w * h * 3
    try:
        while True:
            buf = dec.stdout.read(tam)
            if len(buf) < tam:
                break
            rgb = np.frombuffer(buf, np.uint8).reshape(h, w, 3)
            peq = cv2.resize(rgb, (LADO, LADO), interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
            peq = (peq / max(float(peq.max()), 1.0) - MEDIA) / DESVIO
            m = s.run([nome_out], {nome_in: peq.transpose(2, 0, 1)[None]})[0][0, 0]
            m = (m - m.min()) / ((m.max() - m.min()) or 1.0)
            m = np.clip(np.round(m * 255), 0, 255).astype(np.uint8)
            m = cv2.resize(m, (w, h), interpolation=cv2.INTER_LANCZOS4)
            m = refinar(rgb, m)
            enc.stdin.write(np.dstack([rgb, m]).tobytes())
            n += 1
            if log and n % 100 == 0:
                log(f"    {n} quadros ({n / (time.time() - t0):.0f}/s)")
    finally:
        enc.stdin.close()
        enc.wait()
        dec.wait()
    if n == 0 or enc.returncode:
        raise RuntimeError(f"tirar o fundo falhou ({n} quadros, ffmpeg {enc.returncode})")
    return n, time.time() - t0, onde


if __name__ == "__main__":
    # roda no ambiente da GPU (venv-gpu), chamado pelo recorte.py: python fundo.py entrada saida num den
    import json
    import sys
    n, seg, onde = remover(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
    print(json.dumps({"quadros": n, "segundos": round(seg, 1), "onde": onde}))
