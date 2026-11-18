---
name: encaixar-motions
description: Coloca os motions renderizados na timeline do FilmCraft (V2, escala 200) no tempo de cada frase-gatilho, faz o texto atrás da cabeça (apresentador recortado com IA na V3) e aplica o enquadramento padrão dos takes. Use quando o editor pedir para adicionar/encaixar os motions numa sequência ou ajustar escala e âncora dos takes.
---

# Encaixar os motions e enquadrar

Precisa: FilmCraft aberto pelo `abrir`, transcrição da sequência (`06-transcricoes/<seq>.json`) e os `.mov` em `05-motions`.

## Motions

1. Mostre o plano de encaixe (não muda nada):
   `./stlflix.cmd --projeto <VSL> motions <seq>`
   Repasse a tabela: timecode de cada motion, nota da frase e o que ficou de fora (frase não achada, sem `.mov`, cena de outro trecho). Se o config tem um plano por sequência, ele usa o da `<seq>`; outro plano: `--plano <caminho>`.
2. Espere a aprovação ("Coloque…"). Antes de aplicar numa sequência que já tem motions ajustados à mão, sugira duplicar a sequência como backup.
3. `./stlflix.cmd --projeto <VSL> motions <seq> --aplicar`
   Ele tira os `.mov` antigos da V2, coloca os novos (escala 200) e liga a trilha.
4. Confira alguns quadros com `file.exportFrame` (veja `CLAUDE.md` → operar o FilmCraft) e peça para o editor revisar na timeline e **salvar com Ctrl+S**.

## Texto atrás da cabeça (recorte)

**Só quando o editor pedir, e só nas cenas que ele disser** (leva tempo e a cabeça tampa o texto na maioria dos motions). Não ofereça nem aplique por conta própria ao encaixar os motions.

O apresentador recortado vai para a V3, por cima do motion, só na batida do número grande (número, contador de dinheiro ou cartão de preço): o boné passa na frente do número, e o resto do motion continua na frente dele.

1. Se o editor não disse a cena, liste as candidatas: `./stlflix.cmd --projeto <VSL> recorte <seq>` (○ = tem número grande, com o trecho do recorte).
2. `./stlflix.cmd --projeto <VSL> recorte <seq> --cenas L3D --aplicar`. Na GPU leva de 10 a 50 s por cena (na 1ª vez em cada máquina ele prepara o ambiente da GPU, uns minutos); sem placa NVIDIA, cai para o processador (~6× mais lento). Peça ao editor para **não trocar de sequência no FilmCraft** enquanto roda. Cena sem número grande é recusada (a cabeça esconderia o texto); `--forcar` só se o editor insistir.
3. Cada cena sai com `✓ alinhado` (comparou quadros com e sem o recorte). Mostre um quadro com `file.exportFrame` e lembre o **Ctrl+S**.
4. Mudou a montagem da V1 ou reencaixou os motions? Rode de novo nas mesmas cenas: o recorte é da câmera já montada, num trecho fixo.

Cuidados (aprendidos no teste da VSL-Lincoln): o recorte entra pelo **número do quadro** (pelos segundos ele atrasa 1 quadro e vira fantasma em cada corte da bruta); nunca use `file.import` com `replace` (troca o projeto inteiro).

## Enquadramento dos takes

1. `./stlflix.cmd --projeto <VSL> enquadrar [seqs]` mostra quantos takes estão fora da escala/âncora do config.
2. Com o ok: `enquadrar [seqs] --aplicar`. Vale também dentro de sequências aninhadas. Só mexe nos clipes cujo nome começa com `takes.prefixo`.
3. Lembre o Ctrl+S.

## Se algo não aparece

- Motion na timeline mas não no monitor/render: trilha V2 desligada. O `--aplicar` liga; se foi importado de XML, ela pode vir desligada de novo (`checar` acusa).
- Motion no lugar errado: a frase aparece duas vezes na montagem. Peça ao editor uma frase-gatilho mais específica no plano.
