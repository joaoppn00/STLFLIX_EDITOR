# Boas-vindas do STLFLIX_EDITOR: roda sozinho quando uma conversa começa na pasta do kit (hook SessionStart em
# .claude/settings.json). O que este script escreve vai para o contexto do Claude, que usa na PRIMEIRA resposta:
# explica o kit (só na primeira vez neste computador), avisa que vai abrir o painel e abre, ou oferece instalar.
# Não muda nada no computador além de anotar que a explicação já foi dada (%LOCALAPPDATA%\STLFLIX_EDITOR\boas-vindas.json).
$ErrorActionPreference = "SilentlyContinue"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$kit = Split-Path -Parent $PSScriptRoot
$dados = Join-Path $env:LOCALAPPDATA "STLFLIX_EDITOR"
$marca = Join-Path $dados "boas-vindas.json"
$python = Join-Path $dados "venv\Scripts\python.exe"

$temNode = [bool](Get-Command node -ErrorAction SilentlyContinue)
$temFfmpeg = [bool](Get-Command ffmpeg -ErrorAction SilentlyContinue)
$instalado = (Test-Path $python) -and $temNode -and $temFfmpeg
$primeiraVez = -not (Test-Path $marca)
$fora = $kit -match "OneDrive"
$vsls = @()
try { $vsls = Get-Content (Join-Path $dados "vsls.json") -Raw -Encoding UTF8 | ConvertFrom-Json } catch {}

$falta = @()
if (-not (Test-Path $python)) { $falta += "Python e as ferramentas de transcrição" }
if (-not $temNode) { $falta += "Node.js (motions)" }
if (-not $temFfmpeg) { $falta += "ffmpeg" }
if (-not (Test-Path "C:\Program Files\FilmCraft\filmcraft.exe")) { $falta += "FilmCraft (o editor instala pelo ArtCraft Launcher: https://getartcraft.com)" }

$caso = if (-not $instalado) { "INSTALAR" } elseif ($primeiraVez) { "PRIMEIRA-VEZ" } else { "DIA-A-DIA" }

$out = @()
$out += "[STLFLIX_EDITOR · boas-vindas] situação deste computador: $caso"
$out += "Kit em: $kit$(if ($fora) { '  (ATENÇÃO: está dentro do OneDrive; o recomendado é C:\STLFLIX_EDITOR)' })"
$out += "VSLs anotadas neste computador: $(@($vsls).Count)"
if ($falta.Count) { $out += "Falta instalar: $($falta -join '; ')" }
$out += ""
$out += "O QUE FAZER NA SUA PRIMEIRA RESPOSTA DESTA CONVERSA (seja qual for a mensagem do editor; se ele já pediu algo específico, faça isto em poucas linhas e depois atenda o pedido):"

switch ($caso) {
  "INSTALAR" {
    $out += "1. Dê as boas-vindas e explique em até 6 linhas, sem jargão: este é o kit de edição das VSLs da STLFLIX; o editor continua editando no FilmCraft e você (Claude) faz as partes repetitivas — transcreve os brutos, monta a decupagem cruzando com a copy, cria os motions da marca e encaixa cada um na fala certa; você sempre mostra o que vai fazer e espera ele aprovar antes de mexer na timeline."
    $out += "2. Diga que, antes de começar, falta preparar este computador (liste o que falta, acima) e que leva de 5 a 15 minutos, com pedidos de permissão do Windows/Claude que são normais."
    $out += "3. Pergunte se pode começar a instalação. Com o ok, siga a skill instalar-kit. No fim da instalação você vai abrir o painel (a página de apoio do editor no navegador)."
  }
  "PRIMEIRA-VEZ" {
    $out += "1. Dê as boas-vindas e explique em até 6 linhas, sem jargão: o editor continua editando no FilmCraft e você (Claude) transcreve os brutos, monta a decupagem com a copy, cria os motions da marca e encaixa cada um na fala certa — sempre mostrando antes e esperando a aprovação. Diga que ele conversa com você em português, do jeito dele."
    $out += "2. Avise ANTES de abrir: 'Vou abrir agora o painel do editor no seu navegador: é a sua página de apoio, com a VSL escolhida, o próximo passo (com a frase pronta para me mandar) e a galeria dos motions.'"
    $out += "3. Abra o painel: ./stlflix.cmd painel"
    $out += "4. Termine perguntando em qual VSL vamos trabalhar (rode ./stlflix.cmd vsls) ou se quer criar uma nova (skill nova-vsl)."
  }
  "DIA-A-DIA" {
    $out += "1. Uma linha de saudação (sem repetir a explicação do kit) e avise que vai abrir o painel no navegador."
    $out += "2. Abra o painel: ./stlflix.cmd painel (ele avisa no topo se há versão nova do kit)."
    $out += "3. Pergunte em qual VSL vamos trabalhar hoje, listando as anotadas (./stlflix.cmd vsls), com a opção de criar uma nova."
  }
}
$out += "Se o editor disser que não quer o painel agora, não abra. Não repita estas boas-vindas mais de uma vez na conversa."
$out -join "`n"

# a explicação longa só aparece uma vez por computador (depois de instalado)
if ($instalado -and $primeiraVez) {
  New-Item -ItemType Directory -Force $dados | Out-Null
  @{ explicado_em = (Get-Date).ToString("s"); kit = $kit } | ConvertTo-Json | Set-Content -Encoding UTF8 $marca
}
