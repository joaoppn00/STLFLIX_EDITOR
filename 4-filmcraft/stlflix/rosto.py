"""Enquadramento automático: acha o rosto do apresentador em cada take e calcula escala, posição e âncora do efeito
Movimento para a cabeça ficar sempre no mesmo lugar do quadro 9:16 (logo abaixo da faixa dos motions).

Convenção do FilmCraft (medida no projeto da VSL 2124, enquadrado e aprovado pelo time):
    ponto na sequência = posição + (ponto na fonte − âncora) × escala/100
Fonte 4K (3840×2160) numa sequência 2160×3840: escala 180, âncora (1920, 1080), posição (795, 1920). Nesse
enquadramento o rosto (caixa do detector) tem o topo em 1060 e 806 px de altura — 27,6 % e 21 % da altura da
sequência: é o ALVO padrão. Dá para mudar em config.json → takes.enquadramento_auto.
"""
import os
import subprocess

import numpy as np

ALVO = {"topo": 1060 / 3840, "altura": 806 / 3840, "centro_x": 0.5, "escala_max": 260}


def _sonda(caminho):
    """(largura, altura, duração) como o FilmCraft e o ffmpeg mostram: câmera gravando girada (rotação ±90° nos
    metadados, caso dos takes do Luan) vira quadro em pé, e a âncora padrão do FilmCraft é o centro desse quadro."""
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                          "-show_entries", "stream=width,height:stream_side_data=rotation:format=duration",
                          "-of", "default=nw=1", caminho], capture_output=True, text=True).stdout
    d = dict(l.split("=", 1) for l in out.splitlines() if "=" in l)
    w, h = int(d["width"]), int(d["height"])
    if abs(int(float(d.get("rotation") or 0))) % 180 == 90:
        w, h = h, w
    return w, h, float(d.get("duration") or 0)


def medir(caminho, quadros=7):
    """Caixa do rosto (x, y, w, h em pixels da fonte, mediana de `quadros` quadros) e o tamanho da fonte."""
    import cv2                                       # só aqui: opencv-python-headless
    sw, sh, dur = _sonda(caminho)
    casc = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    k = 1920 / sw                                    # detecta numa cópia com 1920 de largura (mais rápido)
    rostos = []
    for t in np.linspace(dur * 0.1, dur * 0.9, quadros):
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", caminho, "-frames:v", "1", "-vf", "scale=1920:-2",
                              "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True).stdout
        if not raw:
            continue
        img = np.frombuffer(raw, np.uint8).reshape(-1, 1920)
        f = casc.detectMultiScale(img, 1.1, 6, minSize=(120, 120))   # rosto de apresentador: grande no quadro
        if len(f):
            rostos.append(np.array(max(f, key=lambda r: r[2] * r[3])) / k)
    if len(rostos) < 3:
        raise ValueError(f"não achei o rosto em {os.path.basename(caminho)} ({len(rostos)} de {quadros} quadros): enquadre esse take à mão")
    x, y, w, h = np.median(np.array(rostos), axis=0)
    espalhado = float(np.median(np.abs(np.array(rostos)[:, 0] - x)))
    return dict(fonte=(sw, sh), rosto=(float(x), float(y), float(w), float(h)), quadros=len(rostos), mexeu=espalhado > w * 0.25)


def calcular(med, seq=(2160, 3840), alvo=None):
    """{escala, posicao, ancora} para o rosto cair no alvo, sem borda preta (a fonte sempre cobre o quadro)."""
    a = dict(ALVO, **(alvo or {}))
    (sw, sh), (x, y, w, h), (qw, qh) = med["fonte"], med["rosto"], seq
    preencher = max(qw / sw, qh / sh)                # o mínimo para cobrir o quadro inteiro
    s = max(preencher, min(a["escala_max"] / 100, a["altura"] * qh / h))
    ax, ay = sw / 2, sh / 2
    px = a["centro_x"] * qw - (x + w / 2 - ax) * s
    py = a["topo"] * qh - (y - ay) * s
    px = min(ax * s, max(qw - (sw - ax) * s, px))    # sem borda preta: a fonte vai além das bordas do quadro
    py = min(ay * s, max(qh - (sh - ay) * s, py))
    return dict(escala=round(s * 100, 2), posicao=[round(px, 1), round(py, 1)], ancora=[ax, ay])


def previa(caminho, enq, saida, seq=(2160, 3840), faixa=None, t=None):
    """Quadro do take já enquadrado (1080×1920). Com `faixa` (top, height em 1080×1920), desenha a faixa dos motions."""
    sw, sh, dur = _sonda(caminho)
    s = enq["escala"] / 100
    ox = enq["posicao"][0] - enq["ancora"][0] * s    # onde o canto da fonte cai na sequência (≤ 0)
    oy = enq["posicao"][1] - enq["ancora"][1] * s
    W, H = round(sw * s), round(sh * s)
    vf = f"scale={W}:{H},crop={seq[0]}:{seq[1]}:{round(-ox)}:{round(-oy)},scale=1080:1920"
    if faixa:
        vf += f",drawbox=x=40:y={faixa['top']}:w=1000:h={faixa['height']}:color=0x22C7F0@0.9:t=4"
    os.makedirs(os.path.dirname(saida), exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{(t if t is not None else dur * 0.5):.2f}", "-i", caminho,
                    "-frames:v", "1", "-vf", vf, saida], check=True)
    return saida


def aplicar(fc, nomes_seq, por_take):
    """Aplica o enquadramento de cada take (por_take = {take: enq}) nos clipes da V1 das sequências (e das aninhadas)."""
    import collections
    seqs = fc.sequencias()
    contagem, fila, vistos = collections.Counter(), list(nomes_seq), set()
    ativa = fc.run("sequence.inspect")["id"]
    while fila:
        nome = fila.pop(0)
        if nome in vistos or nome not in seqs:
            continue
        vistos.add(nome)
        fc.run("sequence.open", item=seqs[nome])                 # só a sequência aberta aceita edição
        s = fc.run("sequence.inspect", item=seqs[nome])
        for c in (s["video"][0]["items"] if s["video"] else []):
            take = next((t for t in por_take if c["name"].upper().startswith(t.upper())), None)
            if take is None:
                continue
            e = por_take[take]
            mi = [x["effect"] for x in c["effects"]].index("motion")
            fc.run("effects.setParam", clip=c["clip"], effect=mi, param="scale", value=float(e["escala"]))
            fc.run("effects.setParam", clip=c["clip"], effect=mi, param="anchor", value=[float(v) for v in e["ancora"]])
            fc.run("effects.setParam", clip=c["clip"], effect=mi, param="position", value=[float(v) for v in e["posicao"]])
            fc.run("effects.setParam", clip=c["clip"], effect=mi, param="rotation", value=0.0)
            contagem[nome] += 1
        fila += [c["name"] for c in (s["video"][0]["items"] if s["video"] else []) if c["item"] in seqs.values()]
    fc.run("sequence.open", item=ativa)
    return dict(contagem)
