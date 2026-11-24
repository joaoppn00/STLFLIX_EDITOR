"""Painel do editor: página local com as ferramentas instaladas e o que já está preenchido em cada VSL.

stlflix painel gera painel/index.html a partir de painel/modelo.html (dados embutidos em JSON) e abre no navegador.
Só lê: não cria pastas nem conecta no FilmCraft. As ferramentas vêm do próprio instalador (-Verificar -Json);
as VSLs, da lista deste computador (vsls.py).
"""
import datetime
import json
import os
import pathlib
import subprocess
import tempfile

from . import campanha as campanhas
from . import plano, vsls
from .blocos import ler_roteiro
from .motions import arquivos_motion
from .projeto import Projeto
from .vsls import KIT


def ferramentas():
    """Resultado do instalador em modo de conferência: [{ok, item, detalhe, essencial}]."""
    saida = os.path.join(tempfile.gettempdir(), "stlflix-ferramentas.json")
    script = os.path.join(KIT, "1-instalacao", "instalar.ps1")
    subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-Verificar", "-Json", saida],
                   capture_output=True, timeout=300)
    try:
        return json.load(open(saida, encoding="utf-8-sig"))
    except (OSError, ValueError):
        return [dict(ok=False, item="Instalador", detalhe="não consegui rodar 1-instalacao/instalar.ps1", essencial=True)]


def atualizacao():
    """Quantas mudanças do kit estão no GitHub e ainda não neste computador (None se não deu para saber, ex.: sem internet)."""
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0", GCM_INTERACTIVE="never")   # nunca abrir janela de login
    try:
        subprocess.run(["git", "-C", KIT, "fetch", "--quiet", "origin"], capture_output=True, timeout=20, env=env, check=True)
        r = subprocess.run(["git", "-C", KIT, "rev-list", "--count", "HEAD..@{u}"], capture_output=True, text=True,
                           timeout=10, env=env, check=True)
        return int(r.stdout.strip())
    except (OSError, subprocess.SubprocessError, ValueError):
        return None


def _uri(p):
    return pathlib.Path(p).as_uri() if p and os.path.exists(p) else None


def estado_motions(pasta):
    """Cada cena do plano com a situação (pronto, falta, mudou, só encaixe), calculada pelo próprio gerador de motions."""
    try:
        r = subprocess.run(["node", os.path.join(KIT, "3-motions", "motions.mjs"), "estado", "--projeto", pasta],
                           capture_output=True, timeout=120)
        return json.loads(r.stdout.decode("utf-8")) if r.returncode == 0 else None
    except (OSError, subprocess.SubprocessError, ValueError):
        return None


def miniatura(mov, referencia, pasta):
    """Quadro do motion sobre o apresentador, cortado no alto (onde fica o motion). Só é refeita quando o .mov muda."""
    os.makedirs(pasta, exist_ok=True)
    jpg = os.path.join(pasta, os.path.basename(mov).split("-")[0].split(".")[0] + ".jpg")
    if os.path.exists(jpg) and os.path.getmtime(jpg) >= os.path.getmtime(mov):
        return jpg
    fundo = ["-i", referencia] if referencia and os.path.exists(referencia) else ["-f", "lavfi", "-i", "color=c=0x1c1d28:s=1080x1920"]
    for t in ("2.2", "0.6"):                       # 2,2 s: a primeira batida já entrou; motion curto cai no 0,6 s
        if os.path.exists(jpg):
            os.remove(jpg)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", t, "-i", mov, *fundo, "-filter_complex",
                        "[1:v]scale=1080:1920,setsar=1[bg];[bg][0:v]overlay=format=auto,crop=1080:1080:0:0,scale=360:360",
                        "-frames:v", "1", "-q:v", "5", jpg], capture_output=True, timeout=60)
        if os.path.exists(jpg) and os.path.getsize(jpg):
            return jpg
    return None


def galeria(proj, est):
    """Planos com as cenas para a galeria do painel: miniatura e link do .mov de cada motion pronto."""
    ref = proj["motions"]["referencia"]
    ref = proj.caminho(ref) if ref else None
    pasta = os.path.join(est["pasta"], "_miniaturas")
    for p in est["planos"]:
        for c in p["cenas"]:
            c["mini"] = _uri(miniatura(c["mov"], ref, pasta)) if c["mov"] else None
            c["mov"] = _uri(c["mov"])
        p["arquivo"] = os.path.relpath(p["arquivo"], proj.pasta).replace("\\", "/")
    return est["planos"]


def _conteudo(pasta):
    """Arquivos e atalhos na pasta (sem entrar nas subpastas), ignorando .gitkeep."""
    if not os.path.isdir(pasta):
        return []
    return [n for n in os.listdir(pasta) if n != ".gitkeep" and not n.startswith("~")]


def _exemplo():
    return json.load(open(os.path.join(KIT, "projetos", "_MODELO-VSL", "config.json"), encoding="utf-8"))


def _etapa(titulo, estado, detalhe, pedido=None, pasta=None):
    """Uma das 6 etapas. estado: ok (pronto), aviso (conferir), falta, info (ainda não é a hora)."""
    return dict(titulo=titulo, estado=estado, detalhe=detalhe, pedido=pedido, pasta=pasta)


def _mexido(pasta):
    """Quando a pasta foi mexida por último (ela e o que está logo dentro): o painel põe as mais recentes no topo."""
    try:
        return max([os.path.getmtime(pasta)] + [e.stat().st_mtime for e in os.scandir(pasta)])
    except OSError:
        return 0


# sequência só com os takes da câmera (comum nos anúncios): não é montagem, não precisa de transcrição nem de motions
SEQ_BRUTOS = ("brutos",)


def projeto(pasta):
    proj = Projeto(pasta)
    vid = os.path.basename(proj.pasta)          # nome da pasta: é como o editor chama a VSL nos pedidos
    nome = proj["nome"] or vid
    tipo = vsls.tipo(proj.pasta, proj.cfg)
    anuncio = tipo == "anuncio"
    seqs = {k: v for k, v in proj["sequencias"].items() if k.lower() not in SEQ_BRUTOS}
    palavra_seq = "criativos" if anuncio else "sequências"
    pasta_tr = proj.caminho(proj["pastas"]["transcricoes"])

    # 1. Preparar: projeto do FilmCraft, sequências (criativos) e roteiro
    problemas = []                               # (estado, detalhe, pedido)
    fc = proj["filmcraft"]["projeto"]
    if not (fc and os.path.exists(proj.caminho(fc))):
        problemas.append(("falta", "caminho do projeto do FilmCraft não encontrado" if fc else "falta ligar o projeto do FilmCraft",
                          f"Configura o projeto do FilmCraft da {vid}"))
    if not seqs:
        problemas.append(("falta", f"nenhum dos {palavra_seq} anotado", f"Configura os {palavra_seq} da {vid}"))
    elif seqs in (_exemplo()["sequencias"], {"c1": "Criativo 1"}):
        problemas.append(("aviso", f"os nomes dos {palavra_seq} ainda são os do exemplo", f"Configura os {palavra_seq} da {vid}"))
    rot = proj.caminho(proj["roteiro"])
    if not os.path.exists(rot):
        problemas.append(("falta", "falta o roteiro (teleprompter .txt)", f"Coloca o roteiro da {vid} no kit"))
    elif not anuncio and not ler_roteiro(rot):
        problemas.append(("aviso", "o roteiro não tem as marcações de bloco (--- BLOCO 5 · Título ---)", f"Marca os blocos no roteiro da {vid}"))
    if problemas:
        e, d, ped = sorted(problemas, key=lambda p: p[0] != "falta")[0]
        preparar = _etapa("Preparar", e, d + (f" (+{len(problemas) - 1})" if len(problemas) > 1 else ""), ped,
                          _uri(os.path.dirname(rot)))
    else:
        preparar = _etapa("Preparar", "ok", f"FilmCraft, roteiro e {len(seqs)} {palavra_seq if len(seqs) > 1 else palavra_seq[:-1]}",
                          pasta=_uri(os.path.dirname(rot)))

    # 2. Transcrever os brutos (cada take da câmera)
    feitas = [k for k in seqs if os.path.exists(proj.arquivo_transcricao(k))]
    takes = [n[:-5] for n in _conteudo(os.path.join(pasta_tr, "brutos")) if n.endswith(".json") and n != "takes.json"]
    ja_decupada = bool(feitas) and not takes        # montada direto no FilmCraft, sem a decupagem do kit
    if takes:
        brutos = _etapa("Transcrever os brutos", "ok", f"{len(takes)} takes transcritos", pasta=_uri(pasta_tr))
    elif ja_decupada:
        brutos = _etapa("Transcrever os brutos", "info", "não precisou: a montagem foi feita direto no FilmCraft")
    else:
        brutos = _etapa("Transcrever os brutos", "falta", "o Claude ouve cada take da câmera",
                        f"Abre o FilmCraft e transcreve os brutos da {vid}")

    # 3. Decupar: decupagem montada e transcrita (é da transcrição da montagem que saem as frases-gatilho)
    decups = [n for n in _conteudo(pasta_tr) if n.startswith("decupagem-") and n.endswith(".md")]
    falta_tr = [k for k in seqs if k not in feitas]
    if seqs and not falta_tr:
        decupar = _etapa("Decupar", "ok", "montado e transcrito: " + ", ".join(feitas), pasta=_uri(pasta_tr))
    elif feitas or decups:
        decupar = _etapa("Decupar", "aviso", (f"prontos: {', '.join(feitas)} · " if feitas else "decupagem escrita · ")
                         + "falta transcrever a montagem de " + ", ".join(falta_tr),
                         f"Transcreve {'o ' + falta_tr[0] if anuncio else falta_tr[0]} da {vid}", _uri(pasta_tr))
    elif takes:
        alvo = next(iter(seqs), "corpo")
        decupar = _etapa("Decupar", "falta", "o Claude cruza os brutos com a copy, você aprova e ele monta",
                         f"Faz a decupagem do {alvo} da {vid}")
    else:
        decupar = _etapa("Decupar", "info", "depois de transcrever os brutos")

    # 4. Plano de cenas
    ids, erros, faltam_planos = [], [], []
    for p in proj.plano():
        if not os.path.exists(p):
            faltam_planos.append(os.path.relpath(p, proj.pasta).replace("\\", "/"))
            continue
        cenas = plano.ler(p)
        ids += [c["id"] for c in cenas]
        erros += plano.validar(cenas)
    pasta_pl = os.path.dirname(proj.plano()[0])
    if faltam_planos and not ids:
        plano_e = _etapa("Plano de cenas", "falta", "você escreve, ou pede um rascunho ao Claude",
                         f"Faz um rascunho do plano de cenas da {vid}", _uri(pasta_pl))
    elif erros or faltam_planos:
        plano_e = _etapa("Plano de cenas", "aviso", f"{len(ids)} cenas · " + "; ".join(erros[:1] + [f"falta {f}" for f in faltam_planos[:1]]),
                         f"Confere o plano de cenas da {vid}", _uri(pasta_pl))
    else:
        plano_e = _etapa("Plano de cenas", "ok", f"{len(ids)} cenas", pasta=_uri(pasta_pl))

    # 5. Motions (com a campanha e o quadro de referência, que só servem a eles)
    cid = proj["motions"]["campanha"]
    ccfg = campanhas.ler(cid)
    camp = dict(id=cid, nome=ccfg.get("nome") or cid, existe=os.path.isdir(campanhas.pasta(cid)),
                cores=(ccfg.get("cores") or {}).get("degrade") or [], logo=_uri(os.path.join(campanhas.pasta(cid), "logo-kv.png")),
                icones=[dict(nome=n, uri=_uri(os.path.join(campanhas.pasta(cid), n + ".png"))) for n in campanhas.icones(cid)])
    pasta_mov = proj.caminho(proj["pastas"]["motions"])
    movs = arquivos_motion(pasta_mov) if os.path.isdir(pasta_mov) else {}
    sem = [i for i in ids if i not in movs]
    est = estado_motions(proj.pasta)
    mudaram = [c["id"] for p in (est or {}).get("planos", []) for c in p["cenas"] if c["estado"] == "mudou"]
    if not camp["existe"]:
        motions = _etapa("Motions", "falta", f"a campanha '{cid}' não existe neste kit", f"Troca a campanha da {vid}")
    elif not ids:
        motions = _etapa("Motions", "info", "depois do plano de cenas")
    elif not sem and not mudaram:
        motions = _etapa("Motions", "ok", f"todos os {len(ids)} prontos", pasta=_uri(pasta_mov))
    elif not sem:
        motions = _etapa("Motions", "aviso", f"{len(mudaram)} mudaram no plano e precisam ser refeitos",
                         f"Refaz os motions que mudaram da {vid}", _uri(pasta_mov))
    else:
        feitos = len(ids) - len(sem)
        motions = _etapa("Motions", "aviso" if feitos else "falta", f"{feitos} de {len(ids)} prontos",
                         f"Cria os motions {' e '.join(sem[:2])} da {vid} para eu ver" if not feitos else
                         f"Cria os motions que faltam da {vid}" + (" e refaz os que mudaram" if mudaram else ""), _uri(pasta_mov))

    # 6. Entregar
    pasta_exp = proj.caminho(proj["pastas"]["exports"])
    n = len(_conteudo(pasta_exp))
    alvo = next(iter(seqs), "corpo")
    if n:
        entregar = _etapa("Entregar", "ok", f"{n} arquivos exportados", pasta=_uri(pasta_exp))
    elif motions["estado"] == "ok":
        entregar = _etapa("Entregar", "falta", "pôr os motions na timeline, revisar, conferir e exportar",
                          f"Coloca os motions no {alvo} da {vid} e confere antes de exportar", _uri(pasta_exp))
    else:
        entregar = _etapa("Entregar", "info", "no fim: motions na timeline, conferir e exportar", pasta=_uri(pasta_exp))

    etapas = [preparar, brutos, decupar, plano_e, motions, entregar]
    # próximo passo: o primeiro pendente depois da última etapa pronta (aviso antigo de uma etapa já passada não trava o painel)
    ultima_ok = max((i for i, e in enumerate(etapas) if e["estado"] == "ok"), default=-1)
    pendentes = [e for e in etapas if e["estado"] in ("falta", "aviso")]
    proximo = next((e for e in etapas[ultima_ok + 1:] if e["estado"] in ("falta", "aviso")), None) or \
        (pendentes[0] if pendentes else None) or \
        _etapa("Tudo pronto", "ok", "revise na timeline e exporte uma nova versão quando quiser", f"Confere tudo antes de exportar a {vid}")
    return dict(id=vid, nome=nome, tipo=tipo, pasta=proj.pasta, uri=_uri(proj.pasta), etapas=etapas, proximo=proximo,
                galeria=galeria(proj, est) if est else None, campanha=camp,
                mexido=_mexido(proj.pasta))


def gerar(abrir=True):
    projetos, erros = [], []
    for n, p, existe in vsls.todas():
        if not existe:
            erros.append(f"{n}: pasta não encontrada ({p}). Se mudou de lugar, peça ao Claude para anotar o novo caminho")
            continue
        try:
            projetos.append(projeto(p))
        except (OSError, ValueError, KeyError) as e:
            erros.append(f"{n}: {e}")
    projetos.sort(key=lambda p: -p["mexido"])       # os mexidos por último primeiro
    dados = dict(gerado=datetime.datetime.now().strftime("%d/%m/%Y %H:%M"), kit=KIT, atualizacao=atualizacao(),
                 ferramentas=ferramentas(), projetos=projetos, erros=erros)
    modelo = open(os.path.join(KIT, "painel", "modelo.html"), encoding="utf-8").read()
    js = json.dumps(dados, ensure_ascii=False).replace("</", "<\\/")
    saida = os.path.join(KIT, "painel", "index.html")
    tmp = saida + ".novo"                        # grava inteiro e troca: a janela do app nunca lê o arquivo pela metade
    open(tmp, "w", encoding="utf-8").write(modelo.replace("__DADOS__", js))
    os.replace(tmp, saida)
    if abrir:
        from . import servidor
        servidor.abrir(se_fechado=True)          # app STLFLIX EDITOR; se já está aberto, ele recarrega sozinho
    return saida, dados
