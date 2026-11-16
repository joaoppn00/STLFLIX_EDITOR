# Modelo STLFLIX-Cenas

O **Shark-VSL com cenas novas**. Fica a mesma identidade das VSLs: lettering na faixa acima da cabeça do apresentador, Sora + Inter, gradiente verde→azul na palavra-chave, verde só para resultado e CTA, ícones da campanha. Por cima disso entram **11 peças novas**, adaptadas das cenas do catálogo do HyperFrames ("Scenes & demos") e redesenhadas no visual da STLFLIX.

Aprovado na VSL 2198 (upsell do Luan, Black November, novembro de 2026), com 13 cenas. O plano completo dela está em `exemplo-plano.md`, nesta pasta.

## Como usar numa VSL

No `config.json` da VSL:

```json
"motions": { "modelo": "stlflix-cenas", ... }
```

Todas as peças do Shark-VSL continuam valendo (kicker, título, número, legenda, chips, ícone, cta…) e saem **iguais**. As novas entram no plano por `json: {...}` dentro de uma batida, como qualquer outra peça:

```
- **M07** · As 3 formações de venda — "Você pode levar a Rota do Lojista"
  duração: 13.2
  > 0.2 | json: {"k":"lista","items":[{"ico":"casa-loja-fisica","t":"Rota do **Lojista**","s":"vender em quantidade pra lojas","d":1.44}, ...]}
```

O `validar` avisa se uma peça nova for usada numa VSL com outro modelo, e se um ícone citado dentro dela não existir na campanha.

## As peças novas

Tempos (`d`, `check`, `a`, `b`, `ini`, `selo.d`…) são **segundos a partir do início da peça**. A peça começa no segundo da batida; se ela não for a primeira da batida, entram mais 0,15 s, a não ser que você ponha `"d"` na própria peça (`"d":0.15`, `"d":0`). Use a transcrição da sequência (`06-transcricoes/<seq>.json`, tempo de cada palavra) para cair na palavra certa.

`**palavra**` dentro dos textos = destaque em gradiente, como no resto do plano.

| Peça | O que faz | Veio de (catálogo) | Exemplo |
|---|---|---|---|
| `notif` | Notificação do app STLFLIX caindo do alto com mola; o ✓ verde se desenha no segundo `check` | native-notification-pop | `{"k":"notif","titulo":"Acesso **garantido**","corpo":"Black November · vitalício","check":1.5}` (opcionais: `app`, `quando`) |
| `lista` | Cards com ícone da campanha que montam um a um no nome falado (`d` de cada item); a borda em gradiente passa para o card novo. Até 3 cards cabem na faixa | grid-card-assemble | `{"k":"lista","items":[{"ico":"casa-feira","t":"Feira 3D **Lucrativa**","s":"direto pro cliente","d":8.4}]}` |
| `dinheiro` | Contador em branco que aterrissa no valor depois de `dur` segundos, vira verde de resultado, pulsa, brilha e solta os ícones da campanha em anel atrás do número | apple-money-count | `{"k":"dinheiro","de":0,"ate":2000,"pre":"R$ ","dur":1.3}` (opcionais: `suf`, `icones`, `size`) |
| `checklist` | Card com linhas apagadas; cada uma acende e ganha ✓ no seu `d`. O `selo` opcional é carimbado com tranco | marker-checklist-card | `{"k":"checklist","d":0.15,"items":[{"t":"Vivendo de Impressão 3D","d":1.6},{"t":"STLFLIX","d":4.9}],"selo":{"t":"Vitalício","d":7.6}}` — até 4 linhas |
| `preco` | Etiqueta de preço que cai 1 centavo `n` vezes, a cada `dt` s a partir de `ini`, piscando no vermelho a cada queda | count-up | `{"k":"preco","d":0.15,"de":2990,"n":7,"dt":0.3,"ini":2.83}` (`de` em centavos: 2990 = R$ 29,90) |
| `trilho` | Trilho entre duas etapas: em `a` a primeira acende e um feixe de luz corre até a segunda, que acende em `b`, iluminando as marcas no caminho | state-chip-rail + tracing-beam | `{"k":"trilho","d":0.15,"de":"Primeira peça","ate":"Modelagem **3D**","a":3.25,"b":4.85}` (opcional: `marcas`, padrão 5) |
| `hub` | Ícone central com legenda; linhas em gradiente desenham até cada caminho (com ponto de luz na ponta) no `d` de cada item | constellation-hub | `{"k":"hub","d":0,"centro":{"ico":"casa-marketplace","t":"mesmo produto"},"items":[{"ico":"casa-feira","t":"Feira","d":3.5}]}` — 3 itens |
| `cartao` | Card que pousa com tranco contido e um reflexo diagonal que passa uma vez. Bom para preço/custo (fica branco: verde é só resultado) | gloss-sweep | `{"k":"cartao","d":0.15,"texto":"+ R$ 1.997"}` (opcional: `sub`) |
| `ctatoque` | O botão de CTA (com seta e brilho) mais um toque animado que aperta o botão em `toque` s e solta uma onda | gesture-tap | `{"k":"ctatoque","d":0.3,"text":"COMPLETAR MINHA OFERTA","toque":0.9}` |
| `cascata` | Cards de "Nova venda" (produto + valor no verde de resultado) chegando com a mola da notificação, cada vez mais rápido; o novo nasce no topo da pilha e empurra os outros; 3 visíveis, os de baixo encolhem, escurecem e somem. `n` vendas entre os segundos `de` e `ate` (ou `tempos: [...]` exatos) | notification-cascade | `{"k":"cascata","d":0.15,"n":8,"de":0.3,"ate":6.2}` (opcionais: `itens: [{"p":"Gatinho porta-incenso","v":"R$ 19,90"}]`, `titulo`) — cabe com um kicker na faixa |
| `celular` | Celular da marca com um B-roll da plataforma tocando na tela: sobe inclinado e assenta com mola, flutua, um reflexo passa e ele cai antes de o vídeo acabar. `pos`: `centro` (grande, fundo escurecido — um corte para a tela) ou `direita`/`esquerda` (menor, ao lado do apresentador, sem escurecer). O título da batida continua na faixa de cima | browser-device-stage + physical-exit | `{"k":"celular","d":0.4,"pos":"centro","video":"broll_site_10_seller_pedidos.mp4"}` (opcionais: `de` = segundo do vídeo onde começa, `vdur`, `escurecer` 0–1) |

### Vídeos do `celular`

Os B-rolls da plataforma (1080×1920) ficam no Drive, em `G:/Drives compartilhados/MKT 2/STUDIO/00 - ASSETS/1. STLFLIX/B-ROLLs/Plataforma/PT` (outra pasta: `"motions": { "brolls": "<pasta>" }` no `config.json`). Não vão para o Git: o kit copia para a pasta de trabalho só os que o plano usa e mede a duração de cada um. O `validar` avisa se o arquivo não existir. Hoje há: STLFLIX (ficha do modelo, categorias, coleções, logo, ecossistema), STLAI (como funciona, ferramentas), STLSeller (adicionar loja, pedidos) e STL Academy (aula, cursos).

## Cuidados

- **O .mov é transparente**: não há vídeo atrás do motion na hora do render, então nada de `backdrop-filter` (desfoque de vidro). Os cards usam fundo escuro quase opaco.
- **Nada em cima do rosto**: o `dinheiro` limita o anel de ícones à altura do número e eles saem para cima. Ao criar peças novas, teste sobre o quadro de referência do apresentador.
- **Tudo é função do tempo** (molas e contas calculadas, sem `Math.random` nem medidas do SVG em tempo de render), então qualquer quadro sai igual em qualquer ordem de render.
- **O Whisper escreve números do jeito dele** ("2 mil reais" vira "R$ 2.000"): copie a frase-gatilho da transcrição, não da copy.
- Mudar `motor.mjs` muda todas as VSLs com este modelo: teste com `render --so` em duas ou três cenas antes.

## De onde vêm as peças

As cenas originais estão instaladas em `<VSL-2198>/motions-hf/catalogo` (`npx hyperframes@0.8.176 add <nome>`, 93 itens de "Scenes & demos"). Elas são em inglês, 16:9 ou quadradas e com outro visual; aqui só o **movimento** foi aproveitado (curvas, molas, tempos), e o desenho é o da STLFLIX. Para trazer outra cena: escolha no catálogo, leia o HTML dela, recrie a peça em `motor.mjs` (HTML em `elHTML`, estilo no `CSS`, animação no `RUNTIME`, sempre guiada pelos `data-at`), acrescente o nome em `PECAS_DO_MODELO` no `3-motions/motions.mjs` e documente nesta tabela.
