#!/usr/bin/env node
// Giro 3D: motion padrão de modelo 3D da STLFLIX (o modelo desce em hélice e pousa no centro, luz cinema).
//
//   node 3-motions/giro3d/giro3d.mjs preparar --modelo <pasta>
//   node 3-motions/giro3d/giro3d.mjs quadros  --modelo <pasta> [--luz cinema] [--projeto VSL]
//   node 3-motions/giro3d/giro3d.mjs render   --modelo <pasta> [--luz cinema] [--duracao 6] [--projeto VSL] [--saida pasta] [--referencia png]
//
// A receita de cada modelo fica em <pasta>/giro3d.json (peças, cores, como deixar em pé). Ver README.md desta pasta.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(AQUI, "..", "..");
const HF = "0.9.91";                                  // versão do HyperFrames testada com o three.js
const LUZES = ["cinema", "cinema-forte", "estudio", "campanha"];
const RECEITA = "giro3d.json";
const PY = path.join(process.env.LOCALAPPDATA || os.homedir(), "STLFLIX_EDITOR", "venv", "Scripts", "python.exe");

function args() {
  const [cmd, ...r] = process.argv.slice(2);
  const o = { cmd };
  for (let i = 0; i < r.length; i++) if (r[i].startsWith("--")) o[r[i].slice(2)] = r[i + 1] && !r[i + 1].startsWith("--") ? r[++i] : true;
  return o;
}

function sh(cmd, argv, opts = {}) {
  if (process.platform === "win32" && cmd === "npx") { argv = ["/d", "/s", "/c", "npx", ...argv]; cmd = "cmd"; }
  const r = spawnSync(cmd, argv, { cwd: opts.cwd, encoding: "utf8", maxBuffer: 64 << 20,
    stdio: opts.log ? ["ignore", fs.openSync(opts.log, "w"), fs.openSync(opts.log, "a")] : ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) throw new Error(`${cmd} ${argv.slice(0, 6).join(" ")}… falhou${opts.log ? ` (veja ${opts.log})` : `:\n${(r.stderr || r.stdout || "").slice(-1500)}`}`);
  return r.stdout || "";
}

// --projeto aceita a pasta da VSL ou só o nome (a mesma lista do stlflix: %LOCALAPPDATA%\STLFLIX_EDITOR\vsls.json)
function resolverVsl(arg) {
  if (fs.existsSync(path.join(arg, "config.json"))) return path.resolve(arg);
  let anotadas = [];
  try { anotadas = JSON.parse(fs.readFileSync(path.join(process.env.LOCALAPPDATA || os.homedir(), "STLFLIX_EDITOR", "vsls.json"), "utf8")); } catch {}
  const dentro = path.join(KIT, "projetos");
  const doKit = fs.existsSync(dentro) ? fs.readdirSync(dentro).filter((n) => !/^[_.]/.test(n)).map((n) => path.join(dentro, n)) : [];
  const nome = path.basename(path.normalize(arg.trim())).toLowerCase();
  const achadas = [...new Set([...anotadas, ...doKit].map((p) => path.resolve(p)))]
    .filter((p) => path.basename(p).toLowerCase() === nome && fs.existsSync(path.join(p, "config.json")));
  if (achadas.length === 1) return achadas[0];
  throw new Error(achadas.length ? `há ${achadas.length} VSLs chamadas "${arg}": use o caminho` : `não achei a VSL "${arg}"`);
}

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const agora = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${p(d.getDate())}-${p(d.getMonth() + 1)} ${p(d.getHours())}h${p(d.getMinutes())}`; };

function pastaModelo(o) {
  if (!o.modelo || o.modelo === true) throw new Error("faltou --modelo <pasta do modelo>");
  const p = path.resolve(o.modelo);
  if (!fs.statSync(p, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`não achei a pasta ${p}`);
  return p;
}

function arquivos(pasta, ext) {
  const saida = [];
  const andar = (d) => { for (const n of fs.readdirSync(d, { withFileTypes: true })) {
    if (n.name.startsWith("_") || n.name.startsWith(".")) continue;          // _giro3d e pastas de backup ficam de fora
    const c = path.join(d, n.name);
    if (n.isDirectory()) andar(c); else if (n.name.toLowerCase().endsWith(ext)) saida.push(c);
  } };
  andar(pasta);
  return saida;
}

function medidas(arq) {                                  // caixa do STL binário (mm), para o inventário
  const b = fs.readFileSync(arq);
  const n = b.readUInt32LE(80);
  if (84 + 50 * n !== b.length) return { triangulos: null, tamanho: "STL em texto (ASCII): converta para binário" };
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) for (let e = 0; e < 3; e++) {
    const v = b.readFloatLE(84 + 50 * i + 12 + 12 * k + 4 * e);
    if (v < min[e]) min[e] = v; if (v > max[e]) max[e] = v;
  }
  const r = (x) => Math.round(x * 10) / 10;
  return { triangulos: n, min: min.map(r), max: max.map(r), tamanho: max.map((x, e) => r(x - min[e])).join(" × ") + " mm (X × Y × Z)" };
}

// ---------- preparar: separa os 3MF em peças e faz o inventário + rascunho da receita ----------
function preparar(o) {
  const pasta = pastaModelo(o);
  const pecas = path.join(pasta, "_giro3d", "pecas");
  fs.mkdirSync(pecas, { recursive: true });
  const inventario = [];
  for (const m of arquivos(pasta, ".3mf")) {
    const destino = path.join(pecas, slug(path.basename(m, ".3mf")));
    if (!fs.existsSync(PY)) throw new Error("não achei o Python do kit: rode o instalador");
    const lista = JSON.parse(sh(PY, ["-I", path.join(AQUI, "extrair3mf.py"), m, destino]).trim().split("\n").pop());
    for (const p of lista) inventario.push({ origem: path.relative(pasta, m), arquivo: path.relative(pasta, path.join(destino, p.arquivo)), cor: p.cor });
  }
  for (const s of arquivos(pasta, ".stl")) inventario.push({ origem: "STL solto", arquivo: path.relative(pasta, s), cor: null });
  for (const it of inventario) Object.assign(it, medidas(path.join(pasta, it.arquivo)));
  fs.writeFileSync(path.join(pasta, "_giro3d", "inventario.json"), JSON.stringify(inventario, null, 2));

  const receita = path.join(pasta, RECEITA), nova = !fs.existsSync(receita);
  if (nova) {
    // rascunho: a maior peça, em pé pelo padrão dos fatiadores (Z para cima, frente para -Y). Confira com `quadros`.
    const maior = [...inventario].sort((a, b) => (b.triangulos || 0) - (a.triangulos || 0))[0];
    if (!maior) throw new Error("a pasta não tem STL nem 3MF");
    fs.writeFileSync(receita, JSON.stringify({ nome: path.basename(pasta).replace(/_[0-9a-f]{8,}$/i, "").replace(/_/g, " "),
      girar: [-90, 0, 0], pecas: [{ arquivo: maior.arquivo.replace(/\\/g, "/"), cor: maior.cor || "#E9E6DF", acabamento: "pla" }] }, null, 2));
  }
  console.log(`Peças de ${path.basename(pasta)} (${inventario.length}):`);
  for (const it of inventario) console.log(`  ${it.arquivo}  ·  ${it.tamanho}${it.triangulos ? `  ·  ${it.triangulos} triângulos` : ""}${it.cor ? `  ·  cor ${it.cor}` : ""}`);
  console.log(`\nReceita: ${receita}${nova ? " (rascunho: confira com o comando quadros)" : ""}`);
}

// ---------- pasta de trabalho do HyperFrames ----------
function receitaDe(pasta, o) {
  const arq = path.join(pasta, RECEITA);
  if (!fs.existsSync(arq)) throw new Error(`falta ${RECEITA}: rode primeiro "preparar --modelo ${pasta}"`);
  const r = JSON.parse(fs.readFileSync(arq, "utf8"));
  const luz = o.luz && o.luz !== true ? o.luz : r.luz || "cinema";
  if (!LUZES.includes(luz)) throw new Error(`luz "${luz}" não existe (use ${LUZES.join(", ")})`);
  const duracao = Number(o.duracao && o.duracao !== true ? o.duracao : r.duracao || 6);
  if (!(duracao >= 2 && duracao <= 30)) throw new Error("--duracao entre 2 e 30 segundos");
  if (!Array.isArray(r.pecas) || !r.pecas.length) throw new Error(`${RECEITA} sem "pecas"`);
  for (const p of r.pecas) if (!fs.existsSync(path.join(pasta, p.arquivo))) throw new Error(`não achei a peça ${p.arquivo}`);
  return { ...r, luz, duracao, ...(o["sem-saida"] ? { saida: false } : {}) };
}

function coresDaCampanha(o) {
  let id = "bf26";
  if (o.projeto && o.projeto !== true) {
    try { id = JSON.parse(fs.readFileSync(path.join(resolverVsl(o.projeto), "config.json"), "utf8")).motions?.campanha || id; } catch {}
  }
  try { return JSON.parse(fs.readFileSync(path.join(KIT, "2-design-system", "campanhas", id, "campanha.json"), "utf8")).cores?.degrade; } catch { return undefined; }
}

function montar(pasta, r, o) {
  const w = path.join(pasta, "_giro3d", "hf");
  fs.rmSync(path.join(w, "assets"), { recursive: true, force: true });
  fs.mkdirSync(path.join(w, "assets"), { recursive: true });
  r.pecas.forEach((p, i) => fs.copyFileSync(path.join(pasta, p.arquivo), path.join(w, "assets", `peca-${i}.stl`)));
  fs.writeFileSync(path.join(w, "package.json"), JSON.stringify({ name: "giro3d", private: true, type: "module" }, null, 2));
  fs.writeFileSync(path.join(w, "hyperframes.json"), JSON.stringify({ $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
    paths: { blocks: "compositions", components: "compositions/components", assets: "assets" } }, null, 2));
  fs.writeFileSync(path.join(w, "meta.json"), JSON.stringify({ id: "giro3d", name: `giro3d ${r.nome || ""}` }));
  const cfg = { ...r, pecas: r.pecas.map(({ cor, acabamento, ajustes }) => ({ cor, acabamento, ajustes })), cores: coresDaCampanha(o) };
  const html = fs.readFileSync(path.join(AQUI, "cena.html"), "utf8")
    .replace("__DURACAO__", String(r.duracao)).replace("__CONFIG__", JSON.stringify(cfg));
  fs.writeFileSync(path.join(w, "index.html"), html);
  return w;
}

function referencia(o, w) {
  const ref = path.join(w, "referencia.png");
  let fonte = o.referencia && o.referencia !== true ? path.resolve(o.referencia) : "";
  if (!fonte && o.projeto && o.projeto !== true) {
    const vsl = resolverVsl(o.projeto);
    const cand = [path.join(vsl, "04-plano-de-cenas", "referencia.png")];
    try { const mv = JSON.parse(fs.readFileSync(path.join(vsl, "config.json"), "utf8")).motions; if (mv?.referencia) cand.unshift(path.resolve(vsl, mv.referencia)); } catch {}
    fonte = cand.find((c) => fs.existsSync(c)) || "";
  }
  if (fonte && fs.existsSync(fonte)) fs.copyFileSync(fonte, ref);
  else sh("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x2a2d36:s=1080x1920", "-frames:v", "1", ref]);
  return ref;
}

// ---------- quadros: confere posição e luz antes do render (segundos, não minutos) ----------
function quadros(o) {
  const pasta = pastaModelo(o), r = receitaDe(pasta, o), w = montar(pasta, r, o);
  const saida = path.join(pasta, "_giro3d", "quadros");
  fs.rmSync(saida, { recursive: true, force: true });
  const fim = Math.max(r.duracao - 0.5, 0.5);
  const tempos = r.saida === false ? [0.6, 1.4, 2.2, fim] : [0.6, 1.4, 2.2, r.duracao - 1.4, r.duracao - 0.7, r.duracao - 0.3];
  sh("npx", ["--yes", `hyperframes@${HF}`, "snapshot", "--at", tempos.map((t) => Math.max(0.1, Math.min(t, r.duracao - 0.05))).join(","), "--no-end", "-o", saida, "--timeout", "120000"], { cwd: w });
  console.log(`Quadros (${r.luz}): ${path.join(saida, "contact-sheet.jpg")}`);
}

// Quadros em que o modelo some no meio do movimento (a transparência cai ao vazio entre dois quadros com modelo)
function quadrosVazios(mov) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", mov, "-vf", "alphaextract,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-", "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 64 << 20 });
  const v = [...(r.stdout || "").matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  if (!v.length) return [];
  const vazio = Math.min(...v);
  return v.flatMap((x, i) => (i > 0 && i < v.length - 1 && x <= vazio + 0.5 && v[i - 1] > vazio + 5 && v[i + 1] > vazio + 5 ? [i] : []));
}

// ---------- render: .mov transparente + prévia sobre o quadro da VSL ----------
function render(o) {
  const pasta = pastaModelo(o), r = receitaDe(pasta, o), w = montar(pasta, r, o);
  const ref = referencia(o, w);
  let destino = o.saida && o.saida !== true ? path.resolve(o.saida) : "";
  if (!destino && o.projeto && o.projeto !== true) {
    const vsl = resolverVsl(o.projeto);
    let mot = "05-motions";
    try { mot = JSON.parse(fs.readFileSync(path.join(vsl, "config.json"), "utf8")).pastas?.motions || mot; } catch {}
    destino = path.join(path.resolve(vsl, mot), "3d");
  }
  destino ||= path.join(pasta, "motion-3d");
  fs.mkdirSync(destino, { recursive: true });
  const base = `${slug(r.nome || path.basename(pasta))}-giro3d-${r.luz}`;
  const mov = path.join(destino, `${base}.mov`), previa = path.join(destino, `previa-${base}.mp4`);
  const antigos = [mov, previa].filter((f) => fs.existsSync(f));
  if (antigos.length) {                                   // nunca sobrescreve: o anterior vai para uma subpasta datada
    const guarda = path.join(destino, `_giro3d anteriores (${agora()})`);
    fs.mkdirSync(guarda, { recursive: true });
    for (const f of antigos) fs.renameSync(f, path.join(guarda, path.basename(f)));
  }
  const log = path.join(pasta, "_giro3d", "render.log");
  const t0 = Date.now();
  sh("npx", ["--yes", `hyperframes@${HF}`, "render", "--format", "mov", "-o", mov], { cwd: w, log });
  sh("ffmpeg", ["-v", "error", "-y", "-loop", "1", "-i", ref, "-i", mov, "-filter_complex",
    "[0:v]scale=1080:1920,setsar=1[bg];[bg][1:v]overlay=format=auto:shortest=1,format=yuv420p[v]",
    "-map", "[v]", "-c:v", "libx264", "-crf", "20", "-r", "30", previa]);
  const falhas = quadrosVazios(mov);
  console.log(`Pronto em ${Math.round((Date.now() - t0) / 1000)} s (${r.luz}, ${r.duracao} s):\n  ${mov}\n  ${previa}`);
  if (falhas.length) {
    console.log(`ATENÇÃO: o modelo sumiu em ${falhas.length} quadro(s) (${falhas.map((q) => `${(q / 30).toFixed(2)} s`).join(", ")}). Renderize de novo; se repetir, veja o README.`);
    process.exitCode = 2;
  } else console.log("Conferido: nenhum quadro com o modelo sumindo.");
}

try {
  const o = args();
  if (o.cmd === "preparar") preparar(o);
  else if (o.cmd === "quadros") quadros(o);
  else if (o.cmd === "render") render(o);
  else console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 8).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
} catch (e) {
  console.error(`erro: ${e.message}`);
  process.exit(1);
}
