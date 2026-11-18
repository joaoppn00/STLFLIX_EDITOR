// Fundos halftone STLFLIX: grade de pontos cujo tamanho segue um campo de ondas, nas cores da marca.
// Cada variante vira um .mp4 1080×1920 de 10 s que roda em loop sem emenda (as ondas fecham o ciclo no fim).
//
//   node 3-motions/biblioteca/fundos-halftone/gerar.mjs                 todas as variantes
//   node 3-motions/biblioteca/fundos-halftone/gerar.mjs --so H01,H03    só algumas
//   node 3-motions/biblioteca/fundos-halftone/gerar.mjs --pendentes     só as que ainda não têm .mp4
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(AQUI, "../../..");
const HF = "0.8.176";
const W = 1080, H = 1920, FPS = 30;
const cfg = JSON.parse(fs.readFileSync(path.join(AQUI, "variantes.json"), "utf8"));

const args = process.argv.slice(2);
const so = (() => { const i = args.indexOf("--so"); return i >= 0 ? args[i + 1].toUpperCase().split(",") : null; })();
const pendentes = args.includes("--pendentes");
const SAIDA = path.join(AQUI, "05-motions");
const TRABALHO = path.join(AQUI, "motions-hf");
fs.mkdirSync(SAIDA, { recursive: true });

const gsap = path.join(KIT, "2-design-system/vendor/gsap/3.14.2/gsap.min.js");
const arquivo = (v) => `${v.codigo} · ${v.nome.replace(/[·/\\:]/g, "-").replace(/\s+-\s+/g, " - ")}.mp4`;

function html(v) {
  const p = cfg.paletas[v.paleta];
  const P = JSON.stringify({ campo: v.campo, passo: v.passo, fundo: p.fundo, cores: p.cores, dur: cfg.duracao, W, H });
  return `<!doctype html>
<html lang="pt-BR" data-resolution="portrait">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<script src="gsap.min.js"></script>
<style>
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: ${p.fundo}; }
  #root { position: relative; width: 100%; height: 100%; overflow: hidden; background: ${p.fundo}; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${cfg.duracao}" data-width="${W}" data-height="${H}">
  <canvas id="c" width="${W}" height="${H}"></canvas>
</div>
<script>
(function () {
  var P = ${P};
  var TAU = Math.PI * 2;
  var cv = document.getElementById("c"), g = cv.getContext("2d");
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  var CORES = P.cores.map(hex), BG = hex(P.fundo);
  // cor do gradiente da marca na posição u (0..1)
  function cor(u) {
    u = Math.min(0.9999, Math.max(0, u)) * (CORES.length - 1);
    var i = Math.floor(u), f = u - i, a = CORES[i], b = CORES[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  function suave(a, b, x) { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); }
  // campos: todos periódicos em t (fase ph = 0..2π ao longo da duração), para o loop fechar
  var CAMPOS = {
    onda: function (x, y, ph) {
      var d = (x * 0.62 + y * 0.78) / 1000;
      return 0.5 + 0.32 * Math.sin(d * 7.5 - ph * 2) + 0.18 * Math.sin(d * 3.1 + ph + Math.sin(x / 260 + ph));
    },
    pulso: function (x, y, ph) {
      var r = Math.hypot(x - P.W / 2, y - P.H / 2) / 1000;
      return (0.5 + 0.5 * Math.sin(r * 14 - ph * 3)) * (0.35 + 0.65 * suave(1.25, 0.1, r));
    },
    fluxo: function (x, y, ph) {
      var a = Math.sin(x / 210 + Math.sin(y / 340 + ph) * 1.4 + ph);
      var b = Math.sin(y / 260 - Math.cos(x / 300 - ph * 2) * 1.2 - ph);
      var c = Math.sin((x + y) / 420 + ph * 2);
      return 0.5 + 0.22 * a + 0.2 * b + 0.12 * c;
    },
    vinheta: function (x, y, ph) {
      var dx = (x - P.W / 2) / (P.W * 0.62), dy = (y - P.H / 2) / (P.H * 0.5);
      var r = Math.sqrt(dx * dx + dy * dy);
      var w = 0.55 + 0.45 * Math.sin(r * 9 - ph * 2 + Math.sin(Math.atan2(dy, dx) * 3 + ph) * 0.8);
      return w * suave(0.38, 1.05, r);
    }
  };
  var campo = CAMPOS[P.campo], S = P.passo, RMAX = S * 0.56;
  function desenha(t) {
    var ph = TAU * (t / P.dur);
    g.fillStyle = P.fundo; g.fillRect(0, 0, P.W, P.H);
    for (var j = -1, y = -S; y < P.H + S; j++, y += S * 0.866) {
      var off = (j & 1) ? S / 2 : 0;
      for (var x = -S + off; x < P.W + S; x += S) {
        var v = Math.min(1, Math.max(0, campo(x, y, ph)));
        if (v < 0.06) continue;
        var r = RMAX * Math.pow(v, 1.15);
        // gradiente na diagonal + um pouco do valor do campo, para a cor também "andar"
        var c = cor(0.75 * ((x / P.W) * 0.35 + (y / P.H) * 0.65) + 0.25 * v);
        var a = 0.28 + 0.72 * v;
        g.fillStyle = "rgb(" + (BG[0] + (c[0] - BG[0]) * a | 0) + "," + (BG[1] + (c[1] - BG[1]) * a | 0) + "," + (BG[2] + (c[2] - BG[2]) * a | 0) + ")";
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
    }
    // vinheta escura nas bordas (profundidade, e o texto por cima respira)
    var vg = g.createRadialGradient(P.W / 2, P.H / 2, P.H * 0.25, P.W / 2, P.H / 2, P.H * 0.75);
    vg.addColorStop(0, "rgba(" + BG + ",0)"); vg.addColorStop(1, "rgba(" + BG + ",0.7)");
    g.fillStyle = vg; g.fillRect(0, 0, P.W, P.H);
  }
  window.__timelines = window.__timelines || {};
  var tl = gsap.timeline({ paused: true }), o = { t: 0 };
  tl.fromTo(o, { t: 0 }, { t: P.dur, duration: P.dur, ease: "none", immediateRender: true, onUpdate: function () { desenha(o.t); } }, 0);
  desenha(0);
  window.__timelines["main"] = tl;
})();
</script>
</body>
</html>
`;
}

const lista = cfg.variantes.filter((v) => (!so || so.includes(v.codigo)) && !(pendentes && fs.existsSync(path.join(SAIDA, arquivo(v)))));
if (!lista.length) { console.log("nada para renderizar"); process.exit(0); }
for (const v of lista) {
  const w = path.join(TRABALHO, v.codigo);
  fs.mkdirSync(w, { recursive: true });
  fs.writeFileSync(path.join(w, "index.html"), html(v));
  fs.copyFileSync(gsap, path.join(w, "gsap.min.js"));
  fs.writeFileSync(path.join(w, "package.json"), JSON.stringify({ name: `fundo-${v.codigo.toLowerCase()}`, private: true, type: "module" }, null, 2));
  const out = path.join(SAIDA, arquivo(v));
  console.log(`▶ ${v.codigo} · ${v.nome}`);
  // nome simples no render (o npx no Windows passa pelo shell e quebraria o nome com espaços), renomeia depois
  const r = spawnSync("npx", ["--yes", `hyperframes@${HF}`, "render", "--format", "mp4", "--quality", "delivery", "--fps", String(FPS), "--quiet", "-o", "render.mp4"],
    { cwd: w, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0 || !fs.existsSync(path.join(w, "render.mp4"))) { console.error(`✗ ${v.codigo} falhou`); process.exit(1); }
  for (const f of fs.readdirSync(SAIDA)) if (f.startsWith(v.codigo + " ") && f !== arquivo(v)) fs.rmSync(path.join(SAIDA, f));   // nome antigo da mesma variante
  fs.renameSync(path.join(w, "render.mp4"), out);
}
console.log(`✓ ${lista.length} fundos em ${SAIDA}`);
