# STLFLIX_EDITOR

Kit do time de edição da STLFLIX para VSLs 9:16. Junta a edição no **FilmCraft** (operado pelo canal de controle) com os **motions da marca** gerados no HyperFrames a partir do plano de cenas que o editor escreve. Quem conversa com você é um editor de vídeo: responda em **português do Brasil**, sem jargão de programação, e cite posições como timecode da timeline.

## Ao começar uma conversa

Os editores abrem o kit pelo **app do Claude para computador (aba Code)**, numa conversa na pasta do kit. Toda conversa nova roda `1-instalacao/boas-vindas.ps1` (hook `SessionStart` em `.claude/settings.json`), que entrega a situação do computador e o roteiro da primeira resposta:

- **INSTALAR**: explique o kit em poucas linhas, diga o que falta preparar e o tempo, e peça o ok para instalar (skill `instalar-kit`).
- **PRIMEIRA-VEZ**: explique o kit em poucas linhas, conte que o app STLFLIX EDITOR abriu sozinho e pergunte a VSL ou o anúncio.
- **DIA-A-DIA**: uma linha de saudação, pergunte a VSL ou o anúncio.

O próprio hook abre o **app STLFLIX EDITOR** (o painel numa janela própria) ao começar a conversa; se já houver uma janela aberta, só atualiza. Não rode o painel de novo só para abrir.

Faça isso só uma vez por conversa, mesmo que o editor já tenha pedido outra coisa (então atenda o pedido em seguida). A explicação longa aparece só uma vez por computador (marca em `%LOCALAPPDATA%\STLFLIX_EDITOR\boas-vindas.json`).

## Qual VSL

O kit serve para qualquer VSL de qualquer editor do time. Nenhuma VSL é a "padrão": não assuma a VSL-Shark nem a primeira da pasta.

- **A pasta da VSL fica onde o editor quiser** no computador dele (não precisa estar dentro do kit). Tudo o que o kit gera para ela (motions, pasta de trabalho do HyperFrames, transcrições, exportações) vai para dentro dessa pasta. O kit anota o caminho de cada VSL em `%LOCALAPPDATA%\STLFLIX_EDITOR\vsls.json`, e `--projeto` aceita só o nome (`--projeto VSL-Ender-3`) ou o caminho.
- Se o editor ainda não disse em qual VSL vai trabalhar e o pedido depende de uma, rode `./stlflix.cmd vsls` e pergunte qual é, com a opção **Criar uma VSL nova** (skill `nova-vsl`). Se não houver nenhuma, ofereça criar.
- "Vamos trabalhar na VSL-X" (o pedido que o painel copia) fixa a VSL da conversa: use `--projeto VSL-X` até ele trocar.
- Pasta de VSL que veio de outro lugar (copiada de outro editor, movida de disco): `./stlflix.cmd vsls --anotar "<pasta>"`. Se ele não souber o caminho, `./stlflix.cmd escolher-pasta` abre a janela do Windows para ele escolher.
- O painel tem o mesmo menu (escolher VSL ou criar nova) e o botão para baixar o ArtCraft Launcher (https://getartcraft.com).
- **Anúncios** usam o mesmo kit e o mesmo fluxo: cada criativo é uma sequência em `sequencias` (`"c33": "Criativo 3.3 – Três peças"`), e uma sequência chamada `brutos` só guarda os takes (o painel não cobra transcrição nem motions dela). É anúncio quem tem `"tipo": "anuncio"` no `config.json` ou pasta que começa com `ADS`; o roteiro não precisa de marcações de bloco. "Cria um anúncio novo chamado ADS-X" → skill `nova-vsl` com `--tipo anuncio`.
- Caminho do `.fcproj` que está dentro da pasta do projeto: grave só o nome do arquivo (relativo), para não quebrar quando a pasta mudar de disco.

## Regras (sempre)

- **Mostrar antes de mudar.** Todo comando que mexe no projeto do FilmCraft (`--aplicar`, ou qualquer chamada direta que altere a timeline) só roda depois de você mostrar o que vai mudar e o editor aprovar. O jeito comum de aprovar é "Coloque…" / "Pode aplicar".
- **Backup antes de operação destrutiva**: duplique a sequência (`project.select` + `edit.duplicate`) antes de apagar ou reconstruir clipes. Nunca apague trilhas vazias que o editor criou; só apague trilhas temporárias que você mesmo criou, pelo id.
- **Nunca sobrescrever exportações, XMLs ou renders anteriores**: mova o antigo para uma subpasta `_… anteriores (dd-mm HHhMM)`. O `exportar-xml` já faz isso.
- **O editor revisa na timeline antes de qualquer render final.** Não exporte vídeo nem renderize todos os motions sem ele pedir.
- **Teste com pouco**: no render de motions, primeiro `--so` com 2 ou 3 cenas. Cada cena leva ~30 s.
- **Não mexa no projeto se o editor disser que está em outro** ("calma, estou em outro projeto"): pare e espere.
- Ao fim de cada etapa que mudou a timeline, lembre: **salvar com Ctrl+S** no FilmCraft.
- O **plano de cenas é do editor**. Você pode sugerir cenas ou fazer um rascunho quando ele pedir (skill `plano-de-cenas`), mas o rascunho vai em `04-plano-de-cenas/rascunho-<seq>.md` e só passa para o `plano-de-cenas.md` o que ele aprovar.
- Não apague `05-motions/.registro-render.json`: é como o kit sabe quais motions mudaram no plano depois do render.
- Processamento sutil (sem efeito "robótico"); B-roll preenche o quadro; inserts só de imagem vão sem áudio.

## Como rodar

Sempre a partir da **raiz do kit** (a pasta deste arquivo). `<VSL>` é o nome da VSL ou o caminho da pasta dela.

```
./stlflix.cmd --projeto <VSL> <comando>          edição (Python, FilmCraft)
node 3-motions/motions.mjs <comando> --projeto <VSL>   motions (HyperFrames)
powershell -ExecutionPolicy Bypass -File 1-instalacao/instalar.ps1 [-Verificar]
```

`stlflix.cmd` usa o Python criado pelo instalador em `%LOCALAPPDATA%\STLFLIX_EDITOR\venv` (fora do OneDrive e do git). Se não existir, rode o instalador.

| `stlflix` | O que faz | Muda o projeto? |
|---|---|---|
| `painel` (sem `--projeto`) | Gera e abre `painel/index.html`: início com **VSLs e Anúncios** separados (mais recentes primeiro) e o botão de criar; na tela do projeto, o próximo passo (pedido para copiar), as 6 etapas (Preparar, Transcrever os brutos, Decupar, Plano de cenas, Motions, Entregar), a galeria dos motions (miniaturas em `05-motions/_miniaturas`) e os ícones da campanha. O tutorial fica em `painel/ajuda.html` ("Como funciona") | não |
| `vsls [--anotar PASTA] [--tirar VSL] [--limpar]` (sem `--projeto`) | Lista as VSLs e anúncios deste computador e onde estão; anota uma pasta que já existe, tira da lista ou tira os endereços que não existem mais (sem apagar nada) | não |
| `escolher-pasta` | Abre a janela "Escolher pasta" do Windows e mostra o caminho escolhido | não |
| `campanha listar\|nova\|importar\|conferir [código]` (sem `--projeto`) | Campanhas visuais dos motions em `2-design-system/campanhas`: cria a partir dos PNGs do design (recorta, padroniza 520 px, corrige nomes), confere cores, logo e ícones | não (muda o kit) |
| `nova [--nome X] [--campanha bf26] [--tipo anuncio]` | Cria a pasta `--projeto` (caminho completo, onde o editor quiser) a partir de `projetos/_MODELO-VSL` e anota a VSL; `--tipo anuncio` grava `"tipo": "anuncio"` e começa com um criativo `c1` | não |
| `abrir` | Abre o FilmCraft com o controle ligado e o `.fcproj` do config | não |
| `status` | O que já está preenchido e gerado | não |
| `transcrever-brutos [--pasta] [--so] [--refazer] [--rapido]` | Cada take da câmera (`takes.prefixo`) → Whisper → `06-transcricoes/brutos.md`; pega os brutos do FilmCraft aberto, de `02-brutos` ou de `--pasta`. Faz também a **passada detalhada** (literal com tropeços, janelas de 4 s e fala baixa) e põe no `brutos.md` os **pontos para conferir** de cada take (`--rapido` pula) | não |
| `decupar <seq> [--conferir] [--aplicar]` | Mostra os cortes da `06-transcricoes/decupagem-<seq>.md`; `--conferir` ouve de perto os dois lados de cada emenda e avisa repetição, fala baixa e corte no meio da fala; `--aplicar` duplica a sequência (backup), tira os brutos dela e monta a decupagem no estilo do time | **com --aplicar** |
| `transcrever <seq>` | Áudio da sequência → Whisper → documento por blocos em `06-transcricoes`, e já roda a revisão abaixo | não |
| `revisar <seq>` | Na sequência montada (depois de `transcrever`): repetições, palavras esticadas e frases da copy que não apareceram, com o tempo na timeline e no bruto | não |
| `blocos <seq>` | Refaz só o documento por blocos | não |
| `plano` | Valida o plano de cenas e lista as cenas sem .mov | não |
| `gatilhos <seq> [--plano arquivo]` | Confere as frases-gatilho na transcrição (sem FilmCraft nem .mov); serve para rascunho | não |
| `rascunho-plano <seq> [--roteiro arq]` | Rascunho do plano a partir das marcações da copy: cada `[MOTION]` e `[TELA: lettering "…"]` do bloco da sequência vira cena no tempo da fala, com gatilho copiado da transcrição e peças sugeridas pelo tipo de fala → `04-plano-de-cenas/rascunho-<seq>.md` | não |
| `motions <seq> [--aplicar]` | Mostra o encaixe dos motions nas frases-gatilho; `--aplicar` coloca na V2 | **com --aplicar** |
| `recorte <seq> [--cenas L3D] [--aplicar]` | **Texto atrás da cabeça, só quando o editor pedir e na cena que ele disser**: sem `--cenas`, lista os motions e marca os candidatos (número grande: `número:`, contador de dinheiro ou cartão de preço). Com `--cenas … --aplicar`: exporta só a câmera na batida do número, tira o fundo com IA na GPU (`fundo.py`, modelo do HyperFrames num ambiente próprio `venv-gpu`, criado na 1ª vez; sem GPU usa o HyperFrames no processador), refina a borda e põe o apresentador na **V3** (escala 200) no mesmo quadro; confere o alinhamento. Recusa cena sem número grande (`--forcar` passa). Refazer o mesmo trecho reaproveita o recorte | **com --aplicar** |
| `enquadrar [seqs] --auto [--so takes] [--aplicar]` | **Enquadramento automático**: acha o rosto em cada take (OpenCV, mediana de 7 quadros; entende câmera gravando girada) e calcula escala, posição e âncora para a cabeça ficar logo abaixo da faixa dos motions (alvo medido no enquadramento aprovado da 2124; muda em `takes.enquadramento_auto`). Gera a prévia de cada take em `06-transcricoes/enquadramento/` (linha azul = faixa dos motions) e atualiza o quadro de referência dos motions. Sem `--auto`: escala e âncora fixas do config | **com --aplicar** |
| `checar [seqs] [--rapido]` | Checagens antes de exportar | não |
| `reconectar` | Resolve o "MEDIA UNREADABLE" do Drive (acha a letra do Drive sozinho; G: na maioria das máquinas) | só os links |
| `exportar-xml [seqs] [--destino]` | XML FCP7 para o Drive, guardando o anterior | não |

| `motions.mjs` | O que faz |
|---|---|
| `validar [--plano corpo]` | Confere a linguagem do plano e se os ícones existem na campanha |
| `gerar` | Cria a pasta de trabalho do HyperFrames |
| `previa` | Abre o Studio do HyperFrames |
| `render [--so B05H,B05I] [--por-parte 30]` | .mov por cena em `05-motions` + prévia sobre o quadro de referência; a versão anterior vai para `_motions anteriores (data)` |
| `render --pendentes` | Só as cenas sem .mov ou que mudaram no plano depois do render |
| `amostra --campanha <código>` | 3 cenas de teste com as cores, ícones e logo da campanha → `campanhas/<código>/_amostra` |
| `estado` | Situação de cada cena (pronto, falta, mudou, só encaixe), em JSON; o painel usa para a galeria |

**Biblioteca de motions** (`3-motions/biblioteca/`): motions genéricos, sem texto de VSL, para reusar em VSLs e anúncios. Hoje: `celular-plataformas` (26 = 13 B-rolls da plataforma × celular no centro / ao lado). Quando o editor pedir "o celular com o STLSeller", "motion da plataforma" etc., use o `.mov` de lá (importar e pôr acima da câmera, escala 200) em vez de renderizar de novo; se o `.mov` não existe na máquina, `node 3-motions/motions.mjs render --projeto 3-motions/biblioteca/celular-plataformas --so P11C`. Detalhes em `3-motions/biblioteca/README.md`.

**Motion de modelo 3D** (`3-motions/giro3d/`, skill `motion-3d`): o padrão do time para mostrar um modelo da STLFLIX. O modelo desce em hélice, pousa no centro e sai subindo, com luz cinema (sombra de um lado), em `.mov` transparente para a V2. `node 3-motions/giro3d/giro3d.mjs preparar|quadros|render --modelo <pasta do modelo> [--projeto VSL]`. A receita de cada modelo (peças, cores, como ficar em pé) fica em `<pasta do modelo>/giro3d.json`; confira com `quadros` (~10 s) antes do `render` (~20 s). Detalhes em `3-motions/giro3d/README.md`.

Qualquer comando do `motions.mjs` aceita `--arquivo <plano.md>` no lugar do plano do config (ex.: o rascunho).

**Permissões**: `.claude/settings.json` libera os comandos do kit que só leem e pede confirmação para `--aplicar`, `reconectar`, `exportar-xml`, commit/push e apagar arquivos. Não afrouxe essas regras sem o editor pedir.

`<seq>` é a chave em `config.json → sequencias` (`corpo`, `lead-a`…) ou o nome da sequência no FilmCraft.

Quando o editor pedir "abre o painel" (ou quiser saber o que falta), ou depois de uma etapa que mudou as pastas, rode `./stlflix.cmd painel`: lê as pastas e o instalador em modo de conferência (não abre o FilmCraft) e o app aberto recarrega sozinho; se não houver janela aberta, abre uma.

**App STLFLIX EDITOR**: o painel servido em `http://127.0.0.1:47615` (`4-filmcraft/stlflix/servidor.py`, só atende este computador) e aberto numa janela de app do Edge/Chrome. `./stlflix.cmd app` abre (`--se-fechado`: não abre outra janela se já houver uma); `./stlflix.cmd atalhos` (re)cria o ícone STLFLIX EDITOR na área de trabalho e no menu Iniciar (o instalador já faz). Pela janela do app, as pastas e os motions abrem direto no Windows e o botão ↻ Atualizar lê as pastas de novo. A tela **🎨 Campanhas** do app cria e edita campanhas dos motions (PNGs, cores com prévia, amostra renderizada) sem comando: ofereça ela quando o editor falar em campanha nova (skill `campanha`). Link direto para uma tela: `painel/index.html#ir=campanhas` (ou `#ir=campanha:bf26`, `#ir=VSL-X`). Ícones em `painel/icone*`; manifesto do app em `painel/manifest.webmanifest`.

**Página pública** (`docs/index.html`, GitHub Pages): apresentação e passo a passo de instalação para quem recebe o link. Não ponha nela nomes de VSLs, campanhas ou dados internos.

## Fluxo de uma VSL

Cada etapa tem uma skill em `.claude/skills/`: `instalar-kit`, `nova-vsl`, `campanha`, `decupar`, `transcrever`, `plano-de-cenas`, `gerar-motions`, `motion-3d`, `encaixar-motions`, `finalizar`, `problemas`.

1. `nova` → editor preenche `config.json`, `01-roteiro/teleprompter.txt` e as pastas de assets; importa os brutos no projeto do FilmCraft.
2. `abrir` → `transcrever-brutos`.
3. **Decupagem com o Claude** (skill `decupar`): Claude escreve `decupagem-<seq>.md` cruzando os brutos com a copy e os pontos para conferir do `brutos.md` → `decupar <seq> --conferir` até não sobrar emenda suspeita → editor aprova → `decupar <seq> --aplicar` → `transcrever <seq>` (já revisa a montagem) → corrige o que a revisão apontar → editor revisa e salva.
4. `enquadrar --auto` → mostre as prévias → `--aplicar` com o ok do editor (deixa o quadro de referência dos motions igual ao vídeo).
5. Editor escreve `04-plano-de-cenas/plano-de-cenas.md` a partir da transcrição e da copy, ou pede um rascunho: comece por `rascunho-plano <seq>` (as marcações da copy) e complete com a skill `plano-de-cenas`.
5. `motions.mjs render --so …` (teste) → render completo.
6. `motions <seq>` → aprovação → `--aplicar`; `enquadrar --aplicar`. Editor revisa e salva.
7. `reconectar` → `checar` (zero erros) → exportar vídeo → `exportar-xml`.

## Operar o FilmCraft fora dos comandos

Para pedidos que os comandos não cobrem (ajustar um clipe, B-roll 9:16, reconstruir áudio), use o cliente Python do kit:

```
"$LOCALAPPDATA/STLFLIX_EDITOR/venv/Scripts/python.exe" -c "from stlflix.fc import FC; fc = FC(); print(fc.sequencias())"
```

`fc.run("<comando>", **params)` executa um comando do FilmCraft (`sequence.inspect`, `effects.setParam`, `media.relink`…); `fc.seq(nome)` devolve a sequência inspecionada.

Antes, leia `5-guias/FilmCraft_Guia_Aprendizados.md`: unidades de tempo (ticks), pegadinhas de parâmetro (`effects.setParam` só na sequência aberta, `timeline.setTrack` para ligar trilha, exportação com `wait:false`), e os problemas já conhecidos. Scripts antigos de referência estão em `4-filmcraft/_legado/` (caminhos fixos: não rode direto, adapte).

O controle só liga se o FilmCraft for aberto pelo `stlflix abrir` (FilmCraft 0.13+ exige o token em `~/.config/filmcraft/control_token`). Se a porta 9876 não responder, peça para o editor fechar o FilmCraft e rode `abrir` de novo.

## Atualizar o kit

Quando o editor pedir para atualizar: confira que `git status` não tem mudanças locais nos arquivos do kit (projetos ficam fora do git), rode `git pull` e depois o instalador com `-Verificar`. Se ele mudou algum arquivo do kit, mostre antes de fazer qualquer coisa.

## Onde está cada coisa

- `projetos/_MODELO-VSL/`: modelo de projeto (config comentado no `4-filmcraft/README.md` e `3-motions/README.md`).
- `3-motions/modelos/`: os modelos visuais, escolhidos por `motions.modelo` no `config.json` da VSL. Mudanças num motor valem para todo o time: só com pedido explícito e teste com `render --so`.
  - `shark-vsl` (padrão): faixa de lettering acima da cabeça.
  - `stlflix-cenas`: o shark-vsl + 11 peças novas adaptadas do catálogo do HyperFrames (notificação, lista, contador de dinheiro, checklist, preço caindo, trilho, hub, card com reflexo, botão com toque, celular com B-roll da plataforma, vendas em cascata), por `json: {...}` no plano. Sintaxe e exemplo no `README.md` da pasta. O `validar` acusa peça nova numa VSL com outro modelo.
- `2-design-system/`: assets da marca e das campanhas. Cada campanha (`campanhas/<código>/`) tem `campanha.json` (cores e texto do logo), os ícones e o `logo-kv.png`; guia em `campanhas/README.md`, skill `campanha`. Campanha nova muda o kit: suba para o GitHub para o time receber.
- `5-guias/`: aprendizados do FilmCraft, estilo de edição, linguagem do plano de cenas.
- `PLANO.md`: fases e decisões do kit.
- Projetos de VSL, brutos, renders e `.venv` **não vão para o git** (ver `.gitignore`).
