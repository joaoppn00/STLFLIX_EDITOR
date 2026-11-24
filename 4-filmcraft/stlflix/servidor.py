"""App STLFLIX EDITOR: o painel servido neste computador (http://127.0.0.1:47615), numa janela própria.

Por que um servidor local e não só o arquivo: numa página http o painel pode virar app instalado (PWA), se atualizar
sozinho quando o Claude gera o painel de novo, e abrir pastas e motions no Windows com um clique.

Só atende este computador (127.0.0.1) e só entrega:
  /painel/…, /2-design-system/…     arquivos do kit (página, ícones, fontes)
  /arquivo?c=<caminho>              imagens de dentro do kit ou das pastas das VSLs (miniaturas, ícones da campanha)
  POST /api/abrir {c}               abre no Windows uma pasta ou arquivo de dentro do kit ou das VSLs
  /api/estado[?ping]                versão do painel (a página recarrega quando muda) e se está atualizando
  /api/janela                       se alguma janela do app avisou que está aberta nos últimos 15 s
  POST /api/atualizar               gera o painel de novo (em segundo plano)

stlflix app        liga o servidor (se não estiver ligado) e abre a janela
stlflix app --se-fechado   idem, mas não abre outra janela se já houver uma aberta (usado ao começar a conversa)
"""
import json
import mimetypes
import os
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import vsls
from .vsls import KIT

PORTA = 47615
ENDERECO = f"http://127.0.0.1:{PORTA}"
NOME = "STLFLIX EDITOR"
INDEX = os.path.join(KIT, "painel", "index.html")
IMAGENS = {".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif", ".mp4"}
PUBLICAS = ("painel/", "2-design-system/")
# o que o app pode abrir no Windows com um clique (pastas sempre): mídia e texto, nunca programa ou script
ABRIVEIS = IMAGENS | {".mov", ".mxf", ".mkv", ".webm", ".wav", ".mp3", ".md", ".txt", ".json", ".xml", ".pdf"}

_estado = {"gerando": False, "erro": None, "ping": 0.0}
_amostras = {}                               # campanha → {"gerando": bool, "erro": str|None}
# versão do código do kit (o mais novo dos .py do stlflix): muda quando o kit é atualizado, e o `app` religa o servidor
CODIGO = max(os.path.getmtime(os.path.join(os.path.dirname(__file__), n)) for n in os.listdir(os.path.dirname(__file__)) if n.endswith(".py"))
_trava = threading.Lock()


def _dentro(caminho, raiz):
    try:
        return os.path.commonpath([os.path.normcase(os.path.abspath(caminho)), os.path.normcase(os.path.abspath(raiz))]) == \
            os.path.normcase(os.path.abspath(raiz))
    except ValueError:                      # discos diferentes
        return False


_raizes = {"quando": 0.0, "lista": []}


def _permitido(caminho):
    """Só o kit, as pastas das VSLs deste computador e as pastas que o config de cada uma aponta
    (motions, transcrições e exports podem ficar fora da pasta da VSL, por exemplo no Drive)."""
    if time.time() - _raizes["quando"] > 30:
        from .projeto import Projeto
        raizes = [KIT]
        for _, p, existe in vsls.todas():
            if not existe:
                continue
            raizes.append(p)
            try:
                proj = Projeto(p)
                raizes += [proj.caminho(proj["pastas"][k]) for k in ("motions", "transcricoes", "exports")]
            except (OSError, ValueError, KeyError):
                pass
        _raizes.update(quando=time.time(), lista=raizes)
    return any(_dentro(caminho, r) for r in _raizes["lista"])


def versao():
    try:
        return os.path.getmtime(INDEX)
    except OSError:
        return 0


def atualizar():
    """Gera o painel de novo em segundo plano (uma vez por vez)."""
    with _trava:
        if _estado["gerando"]:
            return
        _estado["gerando"] = True

    def tarefa():
        # num processo à parte: usa sempre o código do kit como está agora (mesmo depois de um "atualiza o kit")
        try:
            # python.exe (não pythonw) com a janela escondida: as ferramentas que ele chama (PowerShell, node) herdam
            # esse console escondido em vez de piscar janelas pretas na tela
            py = os.path.join(os.path.dirname(sys.executable), "python.exe")
            r = subprocess.run([py if os.path.exists(py) else sys.executable, "-m", "stlflix", "painel", "--sem-abrir"], cwd=KIT, capture_output=True,
                               timeout=900, creationflags=0x08000000)
            _estado["erro"] = None if r.returncode == 0 else r.stderr.decode("utf-8", "replace")[-500:]
        except (OSError, subprocess.SubprocessError) as e:      # o painel antigo continua no ar
            _estado["erro"] = str(e)
        finally:
            _estado["gerando"] = False
    threading.Thread(target=tarefa, daemon=True).start()


# ---- campanhas visuais dos motions (2-design-system/campanhas): criar, mudar cores, ícones e logo, amostra

def campanhas():
    from . import campanha as cp
    from .projeto import Projeto
    uso = {}
    for nome, p, existe in vsls.todas():
        if existe:
            try:
                uso.setdefault(Projeto(p)["motions"]["campanha"], []).append(nome)
            except (OSError, ValueError, KeyError):
                pass
    saida = []
    for c in cp.listar():
        cid, cfg = c["id"], cp.ler(c["id"])
        pasta = cp.pasta(cid)
        am = os.path.join(pasta, "_amostra")
        quadros = sorted(os.path.join(am, n) for n in os.listdir(am) if n.endswith(".jpg")) if os.path.isdir(am) else []
        previa = os.path.join(am, "previa.mp4")
        cores = cfg.get("cores") or {}
        saida.append(dict(
            id=cid, nome=c["nome"], degrade=cores.get("degrade") or [], barra=cores.get("barra"), brilho=cores.get("brilho"),
            texto_logo=(cfg.get("logo") or {}).get("texto", ""),
            logo=os.path.join(pasta, "logo-kv.png") if c["logo"] else None,
            icones=[dict(nome=n, caminho=os.path.join(pasta, n + ".png")) for n in c["icones"]],
            usada_por=sorted(uso.get(cid, [])),
            amostra=dict(quadros=quadros, previa=previa if os.path.exists(previa) else None,
                         feita=os.path.getmtime(previa) if os.path.exists(previa) else None,
                         mudou=os.path.exists(previa) and os.path.getmtime(os.path.join(pasta, "campanha.json")) > os.path.getmtime(previa),
                         **_amostras.get(cid, {"gerando": False, "erro": None}))))
    return saida


def _arquivos_recebidos(arquivos):
    """Grava numa pasta temporária as imagens enviadas pelo app ({nome, dados: data URL ou base64})."""
    import base64
    import tempfile
    tmp = tempfile.mkdtemp(prefix="stlflix-campanha-")
    for a in arquivos or []:
        nome = os.path.basename(str(a.get("nome") or ""))
        if os.path.splitext(nome)[1].lower() not in (".png", ".webp"):
            continue
        dados = str(a.get("dados") or "")
        dados = dados.split(",", 1)[1] if dados.startswith("data:") else dados
        with open(os.path.join(tmp, nome), "wb") as f:
            f.write(base64.b64decode(dados))
    return tmp


def _relatorio(feitos):
    return [dict(arquivo=o, nome=n, aviso=a) for o, n, a in feitos]


def gerar_amostra(cid):
    if _amostras.get(cid, {}).get("gerando"):
        return
    _amostras[cid] = {"gerando": True, "erro": None}

    def tarefa():
        try:
            r = subprocess.run(["node", os.path.join(KIT, "3-motions", "motions.mjs"), "amostra", "--campanha", cid], cwd=KIT,
                               capture_output=True, timeout=900, creationflags=0x08000000)
            erro = None if r.returncode == 0 else (r.stderr or r.stdout).decode("utf-8", "replace").strip()[-600:]
        except (OSError, subprocess.SubprocessError) as e:
            erro = str(e)
        _amostras[cid] = {"gerando": False, "erro": erro}
    threading.Thread(target=tarefa, daemon=True).start()


def acao_campanha(rota, d):
    """POST /api/campanha/<ação>. Devolve o dicionário da resposta (ok, e o que mudou)."""
    import shutil
    from . import campanha as cp
    cid = str(d.get("id") or "")
    if cid != cp.slug(cid) or not cid:
        return dict(ok=False, erro="código da campanha inválido: use letras minúsculas e números, ex.: natal26")
    if rota != "nova" and not os.path.isdir(cp.pasta(cid)):
        return dict(ok=False, erro=f"a campanha {cid} não existe")
    if rota == "nova":
        tmp = _arquivos_recebidos(d.get("arquivos"))
        try:
            feitos = cp.nova(cid, d.get("nome") or cid, tmp, d.get("degrade") or None, d.get("barra") or None, d.get("brilho") or None)
        except (ValueError, FileExistsError) as e:
            return dict(ok=False, erro=str(e))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        return dict(ok=True, arquivos=_relatorio(feitos), problemas=cp.conferir(cid))
    if rota == "salvar":
        try:
            cp.salvar(cid, d.get("nome"), d.get("degrade"), d.get("barra"), d.get("brilho"), d.get("texto_logo"))
        except ValueError as e:
            return dict(ok=False, erro=str(e))
        return dict(ok=True, problemas=cp.conferir(cid))
    if rota == "importar":
        tmp = _arquivos_recebidos(d.get("arquivos"))
        try:
            feitos = cp.importar(cid, tmp)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        return dict(ok=True, arquivos=_relatorio(feitos), problemas=cp.conferir(cid))
    if rota == "tirar":
        try:
            cp.tirar_icone(cid, str(d.get("nome") or ""))
        except (ValueError, FileNotFoundError) as e:
            return dict(ok=False, erro=str(e))
        return dict(ok=True, problemas=cp.conferir(cid))
    if rota == "amostra":
        gerar_amostra(cid)
        return dict(ok=True)
    return dict(ok=False, erro="ação desconhecida")


class Pedido(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _resposta(self, codigo, corpo=b"", tipo="text/plain; charset=utf-8", extra=None):
        self.send_response(codigo)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(corpo)

    def _json(self, dados, codigo=200):
        self._resposta(codigo, json.dumps(dados).encode(), "application/json")

    def _arquivo(self, caminho):
        if not os.path.isfile(caminho):
            return self._resposta(404, b"nao encontrado")
        tipo = mimetypes.guess_type(caminho)[0] or "application/octet-stream"
        if caminho.endswith(".webmanifest"):
            tipo = "application/manifest+json"
        if tipo.startswith("text/") or tipo.endswith(("javascript", "json")):
            tipo += "; charset=utf-8"
        with open(caminho, "rb") as f:
            corpo = f.read()
        faixa = (self.headers.get("Range") or "").replace("bytes=", "")
        if faixa and tipo.startswith("video/") and "-" in faixa and "," not in faixa:     # vídeo: o player pede pedaços
            a, b = faixa.split("-")
            a = int(a or 0)
            b = min(int(b) if b else len(corpo) - 1, len(corpo) - 1)
            return self._resposta(206, corpo[a:b + 1], tipo, {"Content-Range": f"bytes {a}-{b}/{len(corpo)}", "Accept-Ranges": "bytes"})
        self._resposta(200, corpo, tipo, {"Accept-Ranges": "bytes"} if tipo.startswith("video/") else None)

    def _local(self):
        """Recusa pedidos que não vieram deste computador pelo endereço do app (protege contra outros sites)."""
        host = (self.headers.get("Host") or "").split(":")[0]
        return host in ("127.0.0.1", "localhost")

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if not self._local():
            return self._resposta(403, b"so neste computador")
        url = urllib.parse.urlsplit(self.path)
        rota = urllib.parse.unquote(url.path).lstrip("/")
        if rota in ("", "painel", "painel/"):
            return self._resposta(302, extra={"Location": "/painel/index.html"})
        if rota == "sw.js":                 # o service worker precisa estar na raiz para cuidar do app inteiro
            return self._arquivo(os.path.join(KIT, "painel", "sw.js"))
        if rota == "api/estado":
            if "ping" in url.query:
                _estado["ping"] = time.time()
            return self._json(dict(versao=versao(), gerando=_estado["gerando"], erro=_estado["erro"], app=NOME, codigo=CODIGO))
        if rota == "api/campanhas":
            return self._json(campanhas())
        if rota == "api/janela":
            return self._json(dict(aberta=time.time() - _estado["ping"] < 15))
        if rota == "arquivo":
            c = urllib.parse.parse_qs(url.query).get("c", [""])[0]
            if os.path.splitext(c)[1].lower() not in IMAGENS or not _permitido(c):
                return self._resposta(403, b"fora das pastas do kit")
            return self._arquivo(c)
        if rota.startswith(PUBLICAS):
            alvo = os.path.normpath(os.path.join(KIT, *rota.replace("\\", "/").split("/")))
            if any(_dentro(alvo, os.path.join(KIT, p.rstrip("/"))) for p in PUBLICAS):   # nada de ..\ para fora
                return self._arquivo(alvo)
        self._resposta(404, b"nao encontrado")

    def do_POST(self):
        # o cabeçalho próprio faz o navegador recusar pedidos vindos de outros sites (não respondemos ao preflight)
        if not self._local() or self.headers.get("X-STLFLIX") != "1":
            return self._resposta(403, b"so pelo app")
        rota = urllib.parse.urlsplit(self.path).path.lstrip("/")
        n = int(self.headers.get("Content-Length") or 0)
        try:
            dados = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            dados = {}
        if rota == "api/atualizar":
            atualizar()
            return self._json(dict(ok=True))
        if rota.startswith("api/campanha/"):
            r = acao_campanha(rota.split("/")[-1], dados)
            if r.get("ok") and rota.split("/")[-1] != "amostra":
                atualizar()                  # o catálogo de ícones da VSL, no painel, acompanha a campanha
            return self._json(r, 200 if r.get("ok") else 400)
        if rota == "api/desligar":            # o `app` desliga um servidor de versão antiga do kit e liga o novo
            self._json(dict(ok=True))
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return
        if rota == "api/abrir":
            c = dados.get("c") or ""
            if not os.path.exists(c) or not _permitido(c):
                return self._json(dict(ok=False, erro="fora das pastas do kit"), 403)
            if os.path.isfile(c) and os.path.splitext(c)[1].lower() not in ABRIVEIS:     # nunca roda programa
                return self._json(dict(ok=False, erro="tipo de arquivo que o app não abre"), 403)
            os.startfile(c)
            return self._json(dict(ok=True))
        self._resposta(404, b"nao encontrado")


def ligado():
    try:
        with urllib.request.urlopen(ENDERECO + "/api/estado", timeout=1.5) as r:
            return json.load(r)
    except (OSError, ValueError):
        return None


class Servidor(ThreadingHTTPServer):
    """Porta só deste servidor: no Windows, o padrão do Python deixa dois servidores ligarem na mesma porta."""
    allow_reuse_address = False
    daemon_threads = True

    def server_bind(self):
        import socket
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def servir():
    """Roda o servidor (fica ligado até o computador desligar). Gera o painel ao ligar."""
    try:
        srv = Servidor(("127.0.0.1", PORTA), Pedido)
    except OSError:                          # já tem um servidor ligado: este não sobe
        return
    if time.time() - versao() > 60:          # acabou de ser gerado (ex.: pelo `stlflix painel`)? não gera de novo
        atualizar()
    srv.serve_forever()


def ligar():
    """Liga o servidor em segundo plano, sem janela preta, se ainda não estiver ligado (ou se é de uma versão antiga do kit)."""
    e = ligado()
    if e and e.get("codigo") == CODIGO:
        return True
    if e:
        try:
            urllib.request.urlopen(urllib.request.Request(ENDERECO + "/api/desligar", data=b"{}", headers={"X-STLFLIX": "1"}), timeout=3)
        except OSError:
            pass
        for _ in range(20):
            time.sleep(0.25)
            if not ligado():
                break
    py = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
    py = py if os.path.exists(py) else sys.executable
    flags = 0x00000008 | 0x00000200 | 0x08000000      # DETACHED_PROCESS | NEW_PROCESS_GROUP | NO_WINDOW
    subprocess.Popen([py, "-m", "stlflix", "servidor"], cwd=KIT, creationflags=flags, close_fds=True,
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        time.sleep(0.25)
        if ligado():
            return True
    return False


def _navegador():
    """Edge (vem no Windows) ou Chrome: os dois abrem o painel numa janela de app, sem barra de endereço."""
    for base in (os.environ.get("ProgramFiles(x86)"), os.environ.get("ProgramFiles"), os.environ.get("LOCALAPPDATA")):
        for rel in (r"Microsoft\Edge\Application\msedge.exe", r"Google\Chrome\Application\chrome.exe"):
            if base and os.path.exists(os.path.join(base, rel)):
                return os.path.join(base, rel)
    return None


def _ping_recente():
    """A página avisa o servidor a cada 5 s enquanto está aberta: assim dá para saber se já há uma janela."""
    try:
        req = urllib.request.Request(ENDERECO + "/api/janela")
        with urllib.request.urlopen(req, timeout=1.5) as r:
            return json.load(r).get("aberta", False)
    except (OSError, ValueError):
        return False


def abrir(se_fechado=False):
    if not ligar():
        print("✗ não consegui ligar o app (a porta 47615 está ocupada?)", file=sys.stderr)
        return False
    if se_fechado and _ping_recente():
        urllib.request.urlopen(urllib.request.Request(ENDERECO + "/api/atualizar", data=b"{}", headers={"X-STLFLIX": "1"}), timeout=3)
        print(f"✓ {NOME} já está aberto: atualizando")
        return True
    nav = _navegador()
    if nav:
        subprocess.Popen([nav, f"--app={ENDERECO}/painel/index.html", "--window-size=1280,900"],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        os.startfile(ENDERECO + "/painel/index.html")
    print(f"✓ {NOME} aberto ({ENDERECO})")
    return True


def criar_atalhos():
    """Atalho STLFLIX EDITOR (com o ícone da marca) na área de trabalho e no menu Iniciar; tira o atalho antigo do painel."""
    py = os.path.join(os.path.dirname(sys.executable), "pythonw.exe")
    icone = os.path.join(KIT, "painel", "icone.ico")
    feitos = []
    ps_pasta = "[Environment]::GetFolderPath('{}')"
    for pasta in ("Desktop", "Programs"):
        destino = subprocess.run(["powershell", "-NoProfile", "-Command", ps_pasta.format(pasta)],
                                 capture_output=True, text=True).stdout.strip()
        if not destino:
            continue
        lnk = os.path.join(destino, NOME + ".lnk")
        ps = ("$l = (New-Object -ComObject WScript.Shell).CreateShortcut($env:LNK); $l.TargetPath = $env:ALVO;"
              "$l.Arguments = '-m stlflix app'; $l.WorkingDirectory = $env:KIT; $l.IconLocation = $env:ICONE;"
              "$l.Description = 'STLFLIX EDITOR: VSLs e anúncios, o próximo passo e os motions'; $l.Save()")
        env = dict(os.environ, LNK=lnk, ALVO=py, KIT=KIT, ICONE=icone)
        r = subprocess.run(["powershell", "-NoProfile", "-Command", ps], env=env, capture_output=True)
        if r.returncode == 0:
            feitos.append(lnk)
        if pasta == "Desktop":
            velho = os.path.join(destino, "Painel STLFLIX.lnk")
            if os.path.exists(velho):
                os.remove(velho)
    return feitos
