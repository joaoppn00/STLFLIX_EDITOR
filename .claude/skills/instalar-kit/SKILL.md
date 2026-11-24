---
name: instalar-kit
description: Instala ou confere o ambiente do STLFLIX_EDITOR (Git, Node, Python, ffmpeg, FilmCraft via ArtCraft Launcher, Whisper, HyperFrames, token do FilmCraft). Use quando o editor pedir para instalar o kit, acabou de clonar o repositório, ou algum comando falha por falta de ferramenta.
---

# Instalar o kit

1. Confirme que está na raiz do kit (tem `CLAUDE.md` e `1-instalacao/`). Se o editor só colou o link do repositório, clone numa pasta **fora do OneDrive**, por exemplo `C:\STLFLIX_EDITOR`:
   `git clone <link> C:/STLFLIX_EDITOR` e continue a partir dela.
   O repositório é **público**: o clone não pede login nem convite. Se falhar, confira a internet e o endereço (https://github.com/joaoppn00/STLFLIX_EDITOR).
2. Rode primeiro só a conferência e mostre o resultado:
   `powershell -ExecutionPolicy Bypass -File 1-instalacao/instalar.ps1 -Verificar`
3. Explique o que falta e, com o ok do editor, rode a instalação (pode levar 5–15 min: baixa o faster-whisper e, com placa NVIDIA, as bibliotecas CUDA):
   `powershell -ExecutionPolicy Bypass -File 1-instalacao/instalar.ps1`
   Rode em segundo plano e avise quando terminar.
4. Se o Git, Node, Python ou ffmpeg acabaram de ser instalados pelo winget, o terminal atual não enxerga: peça para fechar e abrir o app do Claude e começar uma conversa nova (aba Code → pasta `C:\STLFLIX_EDITOR`), e rode `-Verificar` de novo.
5. **FilmCraft não é instalado pelo script.** O editor baixa o **ArtCraft Launcher** em https://getartcraft.com, instala o FilmCraft por ele e mantém na versão **0.13 ou mais nova**. O script só confere `C:\Program Files\FilmCraft\filmcraft.exe`.
6. O instalador baixa o modelo do Whisper (large-v3-turbo, ~1,6 GB) se ele ainda não estiver no computador; avise o editor que demora na primeira vez. Internet lenta? `-SemModelo` pula essa parte, e a primeira transcrição baixa sozinha.

## Itens que podem ficar como aviso

- **Placa NVIDIA**: sem ela a transcrição roda no processador, mais devagar.
- **Google Drive** (G: na maioria das máquinas; o kit acha a letra sozinho): precisa estar conectado para os brutos e entregas no Drive compartilhado. Peça para marcar as pastas da VSL como "disponível off-line" (evita o "MEDIA UNREADABLE").

## Ao terminar

Tudo `[ok]` → mostre o resumo final do script, avise que vai abrir o app STLFLIX EDITOR (o painel numa janela própria) e abra com `./stlflix.cmd painel`, a partir da pasta do kit. Conte que o instalador criou o ícone **STLFLIX EDITOR** na área de trabalho e no menu Iniciar, e que o app também abre sozinho a cada conversa nova na pasta do kit.

**Se esta conversa não começou na pasta do kit** (o editor só colou o link numa conversa qualquer), as instruções e as boas-vindas do kit ainda não estão valendo aqui. Termine com o passo a passo, em linguagem simples:
1. No app do Claude, aba **Code**, clique em **nova conversa**.
2. Escolha a pasta **`C:\STLFLIX_EDITOR`** (onde o kit foi baixado).
3. Mande "Oi": o Claude se apresenta, abre o painel e pergunta em qual VSL vamos trabalhar.

Se a conversa já está na pasta do kit, siga direto para a skill `nova-vsl`.
