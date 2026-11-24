"""Separa as peças de um 3MF (PrusaSlicer, Bambu Studio, Orca) em STLs, com a cor de cada uma quando o arquivo diz.

    python extrair3mf.py <arquivo.3mf> <pasta de saída>

Imprime um JSON: [{"arquivo": "<nome>.stl", "nome": "...", "cor": "#RRGGBB" ou null, "triangulos": N}].
As peças saem na posição montada do 3MF (é o que o fatiador mostra), no sistema do arquivo (Z para cima).
"""
import json
import os
import re
import sys
import zipfile

import numpy as np

REG = np.dtype([("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")])


def gravar_stl(caminho, tri):
    n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    rec = np.zeros(len(tri), dtype=REG)
    rec["n"], rec["v"] = n, tri
    with open(caminho, "wb") as f:
        f.write(b"\0" * 80)
        f.write(np.uint32(len(tri)).tobytes())
        f.write(rec.tobytes())


def malhas(xml):
    """{id do objeto: (vértices, triângulos)} de um .model"""
    saida = {}
    for m in re.finditer(r'<object\b[^>]*\bid="(\d+)"[^>]*>(.*?)</object>', xml, re.S):
        corpo = m.group(2)
        if "<mesh" not in corpo:
            continue
        v = np.array(re.findall(r'<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"', corpo), dtype=np.float32)
        t = np.array(re.findall(r'<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"', corpo), dtype=np.int64)
        if len(v) and len(t):
            saida[m.group(1)] = (v, t)
    return saida


def matriz(txt):
    """transform do 3MF ("m00 m01 m02 m10 … m32", 12 números) → 4x4 para vetores-linha"""
    if not txt:
        return None
    a = [float(x) for x in txt.split()]
    if len(a) != 12:
        return None
    return np.array([a[0:3] + [0], a[3:6] + [0], a[6:9] + [0], a[9:12] + [1]], dtype=np.float64)


def aplicar(v, m):
    return v if m is None else (np.c_[v, np.ones(len(v))] @ m)[:, :3].astype(np.float32)


def nome_seguro(s):
    return re.sub(r'[\\/:*?"<>|]+', "-", s).strip() or "peca"


def main(arq, destino):
    os.makedirs(destino, exist_ok=True)
    z = zipfile.ZipFile(arq)
    nomes = z.namelist()
    ler = lambda n: z.read(n).decode("utf-8", "replace")
    cores = []
    for cfg in ("Metadata/project_settings.config", "Metadata/Slic3r_PE.config"):
        if cfg in nomes:
            t = ler(cfg)
            m = re.search(r'"filament_colour":\s*\[([^\]]*)\]', t) or re.search(r"filament_colour = (.*)", t)
            if m:
                cores = re.findall(r"#[0-9A-Fa-f]{6}", m.group(1))
                break
    cor = lambda ext: cores[ext - 1] if ext and 0 < ext <= len(cores) else None
    pecas = []

    principal = ler("3D/3dmodel.model")
    objs = malhas(principal)
    # PrusaSlicer: um objeto com várias "volumes" (faixas de triângulos) descritas no Slic3r_PE_model.config
    if "Metadata/Slic3r_PE_model.config" in nomes and objs:
        conf = ler("Metadata/Slic3r_PE_model.config")
        for o in re.finditer(r'<object id="(\d+)"[^>]*>(.*?)</object>', conf, re.S):
            v, t = objs.get(o.group(1), (None, None))
            if v is None:
                continue
            ext_obj = re.search(r'key="extruder" value="(\d+)"', o.group(2).split("<volume")[0])
            for vol in re.finditer(r'<volume firstid="(\d+)" lastid="(\d+)">(.*?)</volume>', o.group(2), re.S):
                a, b = int(vol.group(1)), int(vol.group(2))
                nm = re.search(r'key="name" value="([^"]*)"', vol.group(3))
                ext = re.search(r'key="extruder" value="(\d+)"', vol.group(3)) or ext_obj
                pecas.append((nm.group(1) if nm else f"peca-{len(pecas) + 1}", v[t[a:b + 1]], cor(int(ext.group(1)) if ext else 1)))
    # Bambu/Orca: componentes apontando para 3D/Objects/*.model, com o nome e o filamento no model_settings.config
    elif "<components>" in principal or any(n.startswith("3D/Objects/") for n in nomes):
        conf = ler("Metadata/model_settings.config") if "Metadata/model_settings.config" in nomes else ""
        info = {}
        for o in re.finditer(r'<object id="(\d+)">(.*?)</object>', conf, re.S):
            ext_obj = re.search(r'key="extruder" value="(\d+)"', o.group(2))
            for p in re.finditer(r'<part id="(\d+)"[^>]*>(.*?)</part>', o.group(2), re.S):
                nm = re.search(r'key="name" value="([^"]*)"', p.group(2))
                ext = re.search(r'key="extruder" value="(\d+)"', p.group(2)) or ext_obj
                info[(o.group(1), p.group(1))] = (nm.group(1) if nm else None, int(ext.group(1)) if ext else 1)
        cache = {}
        for ob in re.finditer(r'<object id="(\d+)"[^>]*>(.*?)</object>', principal, re.S):
            for c in re.finditer(r'<component ([^>]*)/>', ob.group(2)):
                at = dict(re.findall(r'([\w:]+)="([^"]*)"', c.group(1)))
                caminho = at.get("p:path", "").lstrip("/")
                if caminho not in cache and caminho in nomes:
                    cache[caminho] = malhas(ler(caminho))
                v, t = cache.get(caminho, {}).get(at.get("objectid"), (None, None))
                if v is None:
                    continue
                nm, ext = info.get((ob.group(1), at.get("objectid")), (None, 1))
                pecas.append((nm or f"objeto{ob.group(1)}-{at.get('objectid')}", aplicar(v, matriz(at.get("transform")))[t], cor(ext)))
    else:
        for oid, (v, t) in objs.items():
            pecas.append((f"objeto-{oid}", v[t], cor(1)))

    saida, usados = [], set()
    for nm, tri, c in pecas:
        base = nome_seguro(nm)
        if base.lower().endswith(".stl"):
            base = base[:-4]
        arq_stl, k = base + ".stl", 2
        while arq_stl.lower() in usados:
            arq_stl, k = f"{base}-{k}.stl", k + 1
        usados.add(arq_stl.lower())
        gravar_stl(os.path.join(destino, arq_stl), tri)
        saida.append({"arquivo": arq_stl, "nome": nm, "cor": c, "triangulos": int(len(tri))})
    print(json.dumps(saida, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
