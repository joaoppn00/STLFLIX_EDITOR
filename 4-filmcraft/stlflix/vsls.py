"""As VSLs deste computador.

Cada editor guarda a pasta da VSL onde quiser; o kit só anota o caminho em %LOCALAPPDATA%\\STLFLIX_EDITOR\\vsls.json
(fora do git e do OneDrive). As pastas dentro de projetos/ do kit entram sozinhas, sem precisar anotar.
Nos comandos, --projeto aceita o caminho da pasta ou só o nome dela ("VSL-Shark").
"""
import json
import os
import subprocess

KIT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELO = os.path.join(KIT, "projetos", "_MODELO-VSL")
ARQ = os.path.join(os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), "STLFLIX_EDITOR", "vsls.json")


def _igual(a, b):
    return os.path.normcase(os.path.abspath(a)) == os.path.normcase(os.path.abspath(b))


def _anotadas():
    try:
        return [p for p in json.load(open(ARQ, encoding="utf-8")) if isinstance(p, str)]
    except (OSError, ValueError):
        return []


def _gravar(pastas):
    os.makedirs(os.path.dirname(ARQ), exist_ok=True)
    json.dump(pastas, open(ARQ, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


def todas():
    """[(nome, pasta, existe)]: as anotadas (a mais recente primeiro) e as de projetos/ do kit, sem repetir."""
    dentro = os.path.join(KIT, "projetos")
    do_kit = [os.path.join(dentro, n) for n in sorted(os.listdir(dentro))
              if not n.startswith(("_", ".")) and os.path.isfile(os.path.join(dentro, n, "config.json"))] if os.path.isdir(dentro) else []
    saida = []
    for p in _anotadas() + do_kit:
        p = os.path.abspath(p)
        if not any(_igual(p, q) for _, q, _ in saida):
            saida.append((os.path.basename(p), p, os.path.isfile(os.path.join(p, "config.json"))))
    # pasta anotada que sumiu, mas a mesma VSL existe em outro lugar (o kit ou a VSL mudou de disco): esquece o endereço velho
    existentes = {n.lower() for n, _, e in saida if e}
    return [s for s in saida if s[2] or s[0].lower() not in existentes]


def tipo(pasta, cfg=None):
    """'anuncio' ou 'vsl': o campo "tipo" do config.json; sem ele, pastas que começam com ADS são anúncios."""
    t = ((cfg or {}).get("tipo") or "").lower()
    if t:
        return "anuncio" if t in ("anuncio", "anúncio", "ads") else "vsl"
    return "anuncio" if os.path.basename(os.path.normpath(pasta)).upper().startswith("ADS") else "vsl"


def anotar(pasta):
    """Põe a pasta no topo da lista (é assim que o painel e os comandos acham a VSL pelo nome)."""
    pasta = os.path.abspath(pasta)
    if not os.path.isfile(os.path.join(pasta, "config.json")):
        raise FileNotFoundError(f"não é uma pasta de VSL (sem config.json): {pasta}")
    _gravar([pasta] + [p for p in _anotadas() if not _igual(p, pasta)])
    return pasta


def tirar(nome_ou_pasta):
    """Tira da lista. Não apaga nada do disco."""
    alvo = resolver(nome_ou_pasta)
    _gravar([p for p in _anotadas() if not _igual(p, alvo)])
    return alvo


def limpar():
    """Tira da lista as pastas que não existem mais. Não apaga nada do disco. Devolve as que saíram."""
    fora = [p for p in _anotadas() if not os.path.isfile(os.path.join(p, "config.json"))]
    if fora:
        _gravar([p for p in _anotadas() if p not in fora])
    return fora


def resolver(nome_ou_pasta):
    """Caminho da pasta da VSL a partir do caminho (absoluto ou relativo) ou só do nome."""
    if os.path.isfile(os.path.join(nome_ou_pasta, "config.json")):
        return os.path.abspath(nome_ou_pasta)
    nome = os.path.basename(os.path.normpath(nome_ou_pasta.strip())).lower()
    achadas = [p for n, p, _ in todas() if n.lower() == nome]
    if len(achadas) == 1:
        return achadas[0]
    if achadas:
        raise FileNotFoundError(f"há {len(achadas)} VSLs chamadas '{nome_ou_pasta}': use o caminho ({'; '.join(achadas)})")
    raise FileNotFoundError(f"não achei a VSL '{nome_ou_pasta}': use o caminho da pasta, ou anote com `vsls --anotar <pasta>`")


def escolher_pasta(titulo="Escolha onde salvar a pasta da VSL"):
    """Abre a janela "Escolher pasta" do Windows. Devolve o caminho, ou None se o editor cancelar."""
    ps = ("[Console]::OutputEncoding = [Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms;"
          "$f = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true };"
          "$d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.ShowNewFolderButton = $true;"
          f"$d.Description = '{titulo}';"
          "if ($d.ShowDialog($f) -eq 'OK') { $d.SelectedPath }")
    r = subprocess.run(["powershell", "-NoProfile", "-STA", "-Command", ps], capture_output=True, timeout=1800)
    return r.stdout.decode("utf-8", "replace").strip() or None
