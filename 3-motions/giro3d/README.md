# Giro 3D · motion padrão de modelo 3D

Um modelo da STLFLIX (STL ou 3MF) desce do alto girando numa hélice, cresce e pousa no centro da tela. Fica "respirando" (balança e flutua de leve) e, no último 1,2 s, **sai**: abaixa um pouco, gira acelerando e sobe para fora da tela pela mesma hélice. A luz padrão é **cinema**: luz forte da esquerda, o lado direito cai para a sombra, as peças fazem sombra umas nas outras, e um fio de contorno quente atrás à direita separa o modelo do fundo. Sai um `.mov` transparente (ProRes 4444, 1080×1920, 30 fps, 6 s), igual aos outros motions: vai na V2, escala 200.

Feito com three.js dentro do HyperFrames. Cada render leva cerca de 20 s.

```
node 3-motions/giro3d/giro3d.mjs preparar --modelo <pasta do modelo>
node 3-motions/giro3d/giro3d.mjs quadros  --modelo <pasta> [--luz cinema]
node 3-motions/giro3d/giro3d.mjs render   --modelo <pasta> [--luz cinema] [--duracao 6] [--sem-saida] [--projeto VSL] [--saida pasta] [--referencia png]
```

- **`preparar`**: separa as peças dos `.3mf` (PrusaSlicer, Bambu Studio, Orca) em STLs em `<pasta>/_giro3d/pecas/`, com a cor do filamento quando o arquivo traz. Também lista todas as peças com o tamanho em mm (`_giro3d/inventario.json`) e cria o rascunho da receita `giro3d.json` se ainda não existir.
- **`quadros`**: 4 quadros do movimento (0,6 s, 1,4 s, 2,2 s e o fim) em `<pasta>/_giro3d/quadros/contact-sheet.jpg`. Leva cerca de 10 s. Serve para conferir se o modelo está em pé, de frente e com as peças no lugar, antes de renderizar.
- **`render`**: grava o `.mov` e a `previa-….mp4` (o motion sobre o quadro de referência).
  - **Sem `--projeto`**: os arquivos vão para `<pasta do modelo>/motion-3d/`.
  - **Com `--projeto VSL-X`**: vão para `<VSL>/05-motions/3d/`, e a prévia usa o quadro de referência da VSL.
  - **Versão anterior**: nunca é sobrescrita. Vai para `_giro3d anteriores (dd-mm HHhMM)`.

Luzes (`--luz` ou `"luz"` na receita):

| Luz | Como fica |
|---|---|
| `cinema` (padrão) | Lateral forte com sombra de um lado |
| `cinema-forte` | O lado escuro mais fechado, quase sem preenchimento |
| `estudio` | Clara e uniforme, produto de catálogo |
| `campanha` | A de estúdio com contorno nas cores da campanha da VSL |

## A receita (`giro3d.json` na pasta do modelo)

```json
{
  "nome": "The Holy Family",
  "girar": [90, 0, 0],
  "pecas": [
    { "arquivo": "_giro3d/pecas/the-holy-family-multicolor/Family.stl", "cor": "#E9E6DF", "acabamento": "pla" },
    { "arquivo": "_giro3d/pecas/the-holy-family-multicolor/Halo.stl", "cor": "#F0C33C", "acabamento": "metal" },
    { "arquivo": "The Holy Family Monocolor/The Holy Family_Table Halo_Monocolor.stl", "cor": "#F0C33C", "acabamento": "metal",
      "ajustes": [ { "mover": [-115.5, -115.5, 0] }, { "girar": [-90, 0, 0] }, { "mover": [0, -73.4, 0] } ] }
  ]
}
```

- **`girar`** (graus X, Y, Z): deixa o modelo inteiro em pé e de frente para a câmera.
  - Os fatiadores usam Z para cima. Por isso o comum é `[-90, 0, 0]` (frente para −Y) ou `[90, 0, 0]` (frente para +Y).
  - Modelo de costas: some 180 no Y.
  - Modelo de cabeça para baixo: troque o sinal do X.
  - Confira sempre com `quadros`.
- **`pecas`**: cada arquivo, caminho relativo à pasta do modelo.
  - `cor` em HEX.
  - `acabamento`: `pla` (fosco, como peça impressa), `brilho` (resina ou verniz) ou `metal` (dourado, prata).
- **`ajustes`** (opcional): encaixa uma peça solta no lugar, aplicados em ordem, em mm e graus. Exemplo: um halo que vem deitado no STL e precisa ficar em pé atrás da figura. Use as medidas do `inventario.json`.
  - `mover: [x, y, z]`
  - `girar: [x, y, z]`
  - `escala: n`
- **Opcionais da receita**:
  - `luz` e `duracao`;
  - `tamanho`: multiplica o tamanho final, 1 = o modelo ocupa ~78% da largura;
  - `altura`: onde pousa, 0 = centro e 0.25 = um quarto da tela acima;
  - `pouso`: em quantos segundos chega, padrão 3,8;
  - `saida`: duração da saída em segundos (padrão 1,2), ou `false` para ele ficar na tela até o fim (o mesmo que `--sem-saida`). A saída acontece sempre no fim da `duracao`: para o modelo ficar mais tempo parado, aumente a `duracao` (ex.: `--duracao 8`).

O modelo é centralizado e dimensionado sozinho, qualquer que seja o tamanho em mm. Peças que vêm de um mesmo 3MF já saem montadas na posição certa.

## Cuidados

- Os STLs podem ser grandes (400 mil triângulos renderizam bem). STL em texto (ASCII) não é aceito: exporte em binário.
- O three.js vem do CDN do jsDelivr (versão fixa 0.181.2): o render precisa de internet.
- A pasta `_giro3d/` dentro da pasta do modelo é de trabalho e é refeita a cada comando. Pastas que começam com `_` não entram no inventário.
- Mudanças em `cena.html` (movimento, luz) valem para todo o time: só com pedido explícito, e confira com `quadros` antes.
