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

# Abre o app STLFLIX EDITOR sozinho (sem esperar: a conversa começa na hora). Se já houver uma janela aberta, só atualiza.
$appAberto = $false
if ($caso -ne "INSTALAR") {
  $pyw = Join-Path $dados "venv\Scripts\pythonw.exe"
  if (Test-Path $pyw) {
    Start-Process -FilePath $pyw -ArgumentList "-m", "stlflix", "app", "--se-fechado" -WorkingDirectory $kit -WindowStyle Hidden
    $appAberto = $true
  }
}

$out = @()
$out += "[STLFLIX_EDITOR · boas-vindas] situação deste computador: $caso"
$out += "Kit em: $kit$(if ($fora) { '  (ATENÇÃO: está dentro do OneDrive; o recomendado é C:\STLFLIX_EDITOR)' })"
$doKit = @(Get-ChildItem (Join-Path $kit "projetos") -Directory | Where-Object { $_.Name -notmatch '^[_.]' -and (Test-Path (Join-Path $_.FullName "config.json")) } | ForEach-Object { $_.FullName })
$todas = @(@($vsls) + $doKit | Where-Object { $_ -and (Test-Path (Join-Path $_ "config.json")) } | Sort-Object -Unique)
$out += "VSLs e anúncios neste computador: $($todas.Count)"
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
    $out += "2. Conte que o app STLFLIX EDITOR $(if ($appAberto) { 'acabou de abrir sozinho numa janela' } else { 'é a página de apoio dele' }): VSLs e anúncios, o próximo passo de cada um (com a frase pronta para te mandar) e a galeria dos motions. Daqui em diante ele abre sozinho a cada conversa, e também pelo ícone STLFLIX EDITOR da área de trabalho.$(if (-not $appAberto) { ' Abra com ./stlflix.cmd app' })"
    $out += "3. Termine perguntando em qual VSL ou anúncio vamos trabalhar (rode ./stlflix.cmd vsls) ou se quer criar um novo (skill nova-vsl)."
  }
  "DIA-A-DIA" {
    $out += "1. Uma linha de saudação (sem repetir a explicação do kit).$(if ($appAberto) { ' O app STLFLIX EDITOR já abriu sozinho: NÃO rode o painel de novo; só mencione em meia linha que ele está aberto.' } else { ' Abra o app: ./stlflix.cmd app' })"
    $out += "2. Pergunte em qual VSL ou anúncio vamos trabalhar hoje, listando os anotados (./stlflix.cmd vsls), com a opção de criar um novo."
  }
}
$out += "Não repita estas boas-vindas mais de uma vez na conversa. Quando algo mudar nas pastas, ./stlflix.cmd painel atualiza o app aberto (não abre outra janela)."
$out -join "`n"

# a explicação longa só aparece uma vez por computador (depois de instalado)
if ($instalado -and $primeiraVez) {
  New-Item -ItemType Directory -Force $dados | Out-Null
  @{ explicado_em = (Get-Date).ToString("s"); kit = $kit } | ConvertTo-Json | Set-Content -Encoding UTF8 $marca
}
