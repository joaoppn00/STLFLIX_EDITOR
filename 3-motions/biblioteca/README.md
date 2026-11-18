# Biblioteca de motions

Motions **genéricos** (sem texto de nenhuma VSL), prontos para usar em qualquer VSL ou anúncio. Cada pasta aqui é uma
coleção com o seu plano de cenas (`04-plano-de-cenas/plano.md`) e os `.mov` em `05-motions`.

Os `.mov` (ProRes 4444 com transparência, 1080×1920, 30 fps) **não vão para o GitHub** (são pesados): cada editor
gera os seus uma vez, com o render abaixo. O plano, o config e este README vão.

## Coleções

### `celular-plataformas` — o celular da marca com um B-roll da plataforma na tela

26 motions: 13 B-rolls da plataforma × 2 posições.

- **`P__C`** — celular no **centro**, fundo escurecido (um corte para a tela).
- **`P__L`** — celular menor **ao lado** (à direita) do apresentador, sem escurecer.

| Código | Plataforma | Código | Plataforma |
|---|---|---|---|
| P01 | STLFLIX ficha do modelo | P08 | STLIA como funciona |
| P02 | STLFLIX categorias | P09 | STLIA ferramentas |
| P03 | STLFLIX coleções | P10 | STLSeller adicionar loja |
| P04 | STLFLIX logo | P11 | STLSeller pedidos |
| P05 | STLFLIX no celular | P12 | STL Academy aula |
| P06 | Ecossistema STLFLIX | P13 | STL Academy |
| P07 | Ecossistema STLFLIX v2 | | |

O celular sobe com mola, flutua, um reflexo passa e ele cai antes de o vídeo acabar. O texto (kicker, título) não
vem junto: na VSL, ponha um motion de texto normal na faixa de cima (ele não cobre o celular) ou antes do celular.

**Usar numa VSL (FilmCraft):** importe o `.mov` de `3-motions/biblioteca/celular-plataformas/05-motions`, ponha numa
trilha de vídeo acima da câmera (V2 ou V3) com **escala 200** (sequência 2160×3840) ou 100 (1080×1920).
**Usar num anúncio:** é um vídeo com transparência; qualquer editor (Premiere, DaVinci, CapCut no PC) aceita.

**Gerar os `.mov`** (uns 30 s cada; precisa do Drive com os B-rolls em
`G:/Drives compartilhados/MKT 2/STUDIO/00 - ASSETS/1. STLFLIX/B-ROLLs/Plataforma/PT`):

```
node 3-motions/motions.mjs render --projeto 3-motions/biblioteca/celular-plataformas --pendentes
node 3-motions/motions.mjs render --projeto 3-motions/biblioteca/celular-plataformas --so P03C,P11L    só alguns
```

**B-roll novo na pasta da plataforma:** acrescente duas cenas no `plano.md` (mesmo formato, próximo código `P14C` /
`P14L`, `duração` = duração do B-roll + 0,9 s) e rode `--pendentes`.

### `fundos-halftone` — fundos de pontos (halftone) nas cores da STLFLIX

Grade de pontos que pulsa num campo de ondas, sobre o fundo escuro da marca. MP4 1080×1920, 10 s, 30 fps, **em loop
sem emenda** (repita o clipe na timeline para esticar). Para usar atrás de texto, cartela ou abertura.

As variações (código, movimento, paleta, tamanho do ponto) ficam em `fundos-halftone/variantes.json`:
movimentos `onda`, `pulso`, `fluxo` e `vinheta` (centro livre para texto); paletas `marca`, `titulo`, `navy` e `bf26`.
Em teste: H01, H03 e H04 foram renderizados e as demais ainda aguardam aprovação.

```
node 3-motions/biblioteca/fundos-halftone/gerar.mjs                 todas
node 3-motions/biblioteca/fundos-halftone/gerar.mjs --so H01,H04    só algumas (uns 25 s cada)
node 3-motions/biblioteca/fundos-halftone/gerar.mjs --pendentes     só as que ainda não têm .mp4
```
