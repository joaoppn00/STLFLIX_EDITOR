---
name: motion-3d
description: Gera o motion padrão de modelo 3D da STLFLIX (entra em hélice, pousa no centro e sai subindo, luz cinema) a partir da pasta de um modelo com STL ou 3MF, como .mov transparente para a V2. Use quando o editor pedir um motion com um modelo 3D, "o modelo girando", "giro 360", "motion do produto", ou mandar uma pasta de modelo da STLFLIX.
---

# Motion de modelo 3D (Giro 3D)

Tudo em `3-motions/giro3d/` (detalhes no `README.md` de lá). Cada passo leva segundos, então mostre o resultado ao editor a cada etapa.

1. **Ache a pasta do modelo.** O editor diz onde está. Se não souber, `./stlflix.cmd escolher-pasta`.
2. **Prepare:** `node 3-motions/giro3d/giro3d.mjs preparar --modelo "<pasta>"`. O comando lista as peças (tamanho em mm, triângulos, cor do filamento) e cria o rascunho `giro3d.json` com a maior peça.
3. **Monte a receita** (`<pasta>/giro3d.json`) olhando o inventário:
   - **Versão colorida:** se existir (3MF "Multicolor", ou o da Bambu com mais de uma cor), use as peças extraídas de **um mesmo 3MF**. Elas já saem montadas.
   - **Cores:** as do filamento são só referência. A figura principal fica em `#E9E6DF` com `pla`. Detalhes dourados ficam em `#F0C33C` com `metal`. Pergunte ao editor se a cor não for óbvia.
   - **Peça solta** (halo, base, suporte): encaixe com `ajustes` (mover, girar). Ver o exemplo do The Holy Family no README.
4. **Confira com quadros:** `node 3-motions/giro3d/giro3d.mjs quadros --modelo "<pasta>"`, depois leia `<pasta>/_giro3d/quadros/contact-sheet.jpg`. Repita até ficar certo:
   - **De costas** (parte lisa, furo de pendurar): some 180 no Y do `girar`.
   - **De cabeça para baixo:** troque o sinal do X (`-90` ↔ `90`).
   - **Peça fora do lugar:** ajuste os `ajustes` dela.
   Mostre o quadro final ao editor.
5. **Render:** `node 3-motions/giro3d/giro3d.mjs render --modelo "<pasta>" [--projeto <VSL>]`, cerca de 20 s.
   - **Com `--projeto`:** o `.mov` vai para `<VSL>/05-motions/3d/` e a prévia usa o quadro de referência da VSL.
   - **Sem `--projeto`:** vai para `<pasta>/motion-3d/`.
   - **Para o editor ver:** abra a `previa-….mp4`.
6. **Tempo:** 6 s por padrão, com a saída no último 1,2 s. Para ficar mais tempo na tela, `--duracao 8`; sem saída, `--sem-saida`.
7. **Luz:** o padrão é `cinema`, aprovado como padrão do time. `--luz cinema-forte | estudio | campanha` só se o editor pedir.
8. **Para colocar na timeline:** importar o `.mov` e pôr na V2, escala 200, na frase que o editor disser (regras de "mostrar antes de mudar" do CLAUDE.md).

## Cuidados

- **Onde pousa:** o modelo pousa no centro, em cima do rosto do apresentador. Se o editor quiser em outro lugar, use `"altura": 0.25` (mais para cima) e/ou `"tamanho": 0.7` na receita.
- **Movimento e luz são do time:** não mude `cena.html` (movimento, luz) sem pedido explícito, e confira com `quadros`.
- **Fora do git:** pastas de modelo e renders não vão para o git.
