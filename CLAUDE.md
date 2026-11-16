# STLFLIX_EDITOR

Kit do time de edição da STLFLIX para VSLs 9:16. Junta a edição no **FilmCraft** (operado pelo canal de controle) com os **motions da marca** gerados no HyperFrames a partir do plano de cenas que o editor escreve. Quem conversa com você é um editor de vídeo: responda em **português do Brasil**, sem jargão de programação, e cite posições como timecode da timeline.

## Ao começar uma conversa

Os editores abrem o kit pelo **app do Claude para computador (aba Code)**, numa conversa na pasta do kit. Toda conversa nova roda `1-instalacao/boas-vindas.ps1` (hook `SessionStart` em `.claude/settings.json`), que entrega a situação do computador e o roteiro da primeira resposta:

- **INSTALAR**: explique o kit em poucas linhas, diga o que falta preparar e o tempo, e peça o ok para instalar (skill `instalar-kit`).
- **PRIMEIRA-VEZ**: explique o kit em poucas linhas, avise "vou abrir o painel no seu navegador", abra (`./stlflix.cmd painel`) e pergunte a VSL.
- **DIA-A-DIA**: uma linha de saudação, avise e abra o painel, pergunte a VSL.

Faça isso só uma vez por conversa, mesmo que o editor já tenha pedido outra coisa (então atenda o pedido em seguida). Se ele não quiser o painel agora, não abra. A explicação longa aparece só uma vez por computador (marca em `%LOCALAPPDATA%\STLFLIX_EDITOR\boas-vindas.json`).

## Qual VSL

O kit serve para qualquer VSL de qualquer editor do time. Nenhuma VSL é a "padrão": não assuma a VSL-Shark nem a primeira da pasta.

- **A pasta da VSL fica onde o editor quiser** no computador dele (não precisa estar dentro do kit). Tudo o que o kit gera para ela (motions, pasta de trabalho do HyperFrames, transcrições, exportações) vai para dentro dessa pasta. O kit anota o caminho de cada VSL em `%LOCALAPPDATA%\STLFLIX_EDITOR\vsls.json`, e `--projeto` aceita só o nome (`--projeto VSL-Ender-3`) ou o caminho.
- Se o editor ainda não disse em qual VSL vai trabalhar e o pedido depende de uma, rode `./stlflix.cmd vsls` e pergunte qual é, com a opção **Criar uma VSL nova** (skill `nova-vsl`). Se não houver nenhuma, ofereça criar.
- "Vamos trabalhar na VSL-X" (o pedido que o painel copia) fixa a VSL da conversa: use `--projeto VSL-X` até ele trocar.
- Pasta de VSL que veio de outro lugar (copiada de outro editor, movida de disco): `./stlflix.cmd vsls --anotar "<pasta>"`. Se ele não souber o caminho, `./stlflix.cmd escolher-pasta` abre a janela do Windows para ele escolher.
- O painel tem o mesmo menu (escolher VSL ou criar nova) e o botão para baixar o ArtCraft Launcher (https://getartcraft.com).

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
| `painel` (sem `--projeto`) | Gera e abre `painel/index.html`: menu para escolher ou criar a VSL, ferramentas instaladas (com o botão do ArtCraft), o que falta na VSL escolhida, o próximo passo e a galeria dos motions (miniaturas em `05-motions/_miniaturas`) | não |
| `vsls [--anotar PASTA] [--tirar VSL]` (sem `--projeto`) | Lista as VSLs deste computador e onde estão; anota uma pasta que já existe ou tira da lista (sem apagar) | não |
| `escolher-pasta` | Abre a janela "Escolher pasta" do Windows e mostra o caminho escolhido | não |
| `campanha listar\|nova\|importar\|conferir [código]` (sem `--projeto`) | Campanhas visuais dos motions em `2-design-system/campanhas`: cria a partir dos PNGs do design (recorta, padroniza 520 px, corrige nomes), confere cores, logo e ícones | não (muda o kit) |
| `nova [--nome X] [--campanha bf26]` | Cria a pasta `--projeto` (caminho completo, onde o editor quiser) a partir de `projetos/_MODELO-VSL` e anota a VSL | não |
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

Qualquer comando do `motions.mjs` aceita `--arquivo <plano.md>` no lugar do plano do config (ex.: o rascunho).

**Permissões**: `.claude/settings.json` libera os comandos do kit que só leem e pede confirmação para `--aplicar`, `reconectar`, `exportar-xml`, commit/push e apagar arquivos. Não afrouxe essas regras sem o editor pedir.

`<seq>` é a chave em `config.json → sequencias` (`corpo`, `lead-a`…) ou o nome da sequência no FilmCraft.

Quando o editor pedir "abre o painel" (ou quiser saber o que falta), rode `./stlflix.cmd painel`. Ele lê as pastas e o instalador em modo de conferência; não abre o FilmCraft.

## Fluxo de uma VSL

Cada etapa tem uma skill em `.claude/skills/`: `instalar-kit`, `nova-vsl`, `campanha`, `decupar`, `transcrever`, `plano-de-cenas`, `gerar-motions`, `encaixar-motions`, `finalizar`, `problemas`.

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
