// Modelo STLFLIX-CENAS: o motor do shark-vsl (mesma faixa, fontes, gradiente e peças) + peças novas adaptadas das
// cenas do catálogo HyperFrames (Scenes & demos), redesenhadas na identidade das VSLs. Primeira VSL: 2198 (Luan, nov/2026).
// Peças novas (entram no plano por `json: {...}`):
//   notif    — notificação do app STLFLIX caindo com mola (native-notification-pop) e ✓ se desenhando
//   lista    — cards com ícone da campanha montando um a um no nome falado (grid-card-assemble)
//   dinheiro — contador que aterrissa no valor, vira verde, pulsa e solta ícones da campanha (apple-money-count)
// Motor original (shark-vsl): extraído do build.mjs da VSL-Shark,
// sem mudar o HTML, o CSS nem as animações: só as cenas, a pasta, a faixa e a campanha viraram parâmetros.
// O código abaixo NÃO é recuado de propósito: os textos multilinha (HTML, CSS, runtime) vão para os arquivos gerados.
// As cenas vêm do plano-de-cenas.md (ver dsl.mjs). Uso: construir(cenas, { pasta, faixa, campanha, so })
import fs from "node:fs";
import path from "node:path";

// Cores e textos da campanha: 2-design-system/campanhas/<campanha>/campanha.json (ligada na pasta de trabalho).
// Sem o arquivo, valem os da BF26, e o resultado é idêntico ao motor original. A marca STLFLIX (fontes, branco,
// verde-limão de resultado e CTA) não muda com a campanha.
const CAMPANHA_PADRAO = {
  nome: "Black November 2026",
  logo: { arquivo: "logo-kv.png", texto: "Black November · Infinitas possibilidades para viver de impressão 3D" },
  cores: { degrade: ["#8DFB5E", "#2EE6A6", "#22C7F0", "#2F7BFF"], barra: "#2F7BFF", brilho: "#07EF2D" },
};
export function lerCampanha(pasta, campanha) {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(path.join(pasta, campanha, "campanha.json"), "utf8")); } catch {}
  return { ...CAMPANHA_PADRAO, ...c, logo: { ...CAMPANHA_PADRAO.logo, ...(c.logo || {}) }, cores: { ...CAMPANHA_PADRAO.cores, ...(c.cores || {}) } };
}
const rgb = (hex) => { const h = hex.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(","); };
const degrade = (cores) => {                           // 4 cores: 0/32/64/100% como na BF26; outras quantidades, por igual
  const pos = cores.length === 4 ? [0, 32, 64, 100] : cores.map((_, i) => Math.round((100 * i) / Math.max(1, cores.length - 1)));
  return `linear-gradient(90deg, ${cores.map((c, i) => `${c} ${pos[i]}%`).join(", ")})`;
};

export function construir(cenas, { pasta, faixa = {}, campanha = "bf26", so = null } = {}) {
cenas = JSON.parse(JSON.stringify(cenas));            // o pós-processamento marca as peças: não mexe no original
const W = 1080, H = 1920;
const BAND = { top: 130, height: 430, side: 64, ...faixa };   // faixa acima da cabeça do apresentador
const CAMP = lerCampanha(pasta, campanha), DG = CAMP.cores.degrade;
const COR2 = DG[1] || DG[0], COR3 = DG[2] || DG[DG.length - 1];   // brilhos dos efeitos (fx): 2ª e 3ª cor do degradê
// número de resultado ([verde] no plano): o verde → azul da marca em qualquer campanha, salvo "resultado" no campanha.json
const RES = CAMP.cores.resultado || CAMPANHA_PADRAO.cores.degrade;
const NUM_BG = degrade(RES) === degrade(DG) ? "var(--grad-title)" : degrade(RES);
const GAP = 0.6;                                       // intervalo entre cenas no reel (facilita o corte)
for (const s of cenas) if (s.topo) s.fases.forEach((ph, pi) => { for (const e of ph.els) if (e.k === "title") e.imp = { label: ph.els.some((x) => x.k === "label"), icone: ph.els.some((x) => x.k === "ico"), caneta: true }; });   // caneta em todas as batidas (o usuário preferiu assim)

// celular: o vídeo da tela dura até o fim da batida (ou da cena), salvo "vdur" no plano
for (const s of cenas) s.fases.forEach((ph, pi) => { const prox = s.fases[pi + 1]; for (const e of ph.els) if (e.k === "celular") e._fim = prox ? prox.at - 0.35 : s.dur; });

// Frases-tese: o título ganha peso (variable-axis-type do registry, na Sora variável: 200 → 700, palavra-chave 800).
const PESO = new Set([]);   // nesta VSL as frases-tese usam VX() direto
for (const s of cenas) if (PESO.has(s.id)) for (const ph of s.fases) for (const e of ph.els) if (e.k === "title") e.vax = true;

// ───────────────────────── HTML de cada peça ─────────────────────────
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<span class="g">$1</span>');
let UID = 0;   // ids únicos de gradiente SVG por cena
const centavos = (c) => "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CHECK = '<svg class="ck" viewBox="0 0 24 24" width="30" height="30"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#3DDC84" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Quebra explícita em até 2 linhas equilibradas; a palavra-chave (**...**) é uma unidade que nunca se parte.
// Linhas fixas são exigência dos efeitos que mudam a largura das letras (o texto não pode re-quebrar no meio).
function quebraLinhas(text, limite) {
  const unid = [];
  text.split(/\*\*/).forEach((p, i) => {
    if (!p.trim()) return;
    if (i % 2) unid.push({ t: p.trim(), kw: true });
    else p.trim().split(/\s+/).forEach((w) => {
      if (/^[\p{P}]+$/u.test(w) && unid.length) unid[unid.length - 1].pos = (unid[unid.length - 1].pos || "") + w;   // pontuação solta (ex.: aspas) gruda na anterior
      else unid.push({ t: w, kw: false });
    });
  });
  const len = (arr) => arr.map((u) => u.t + (u.pos || "")).join(" ").length;
  let linhas = [unid];
  if (len(unid) > limite && unid.length > 1) {
    let melhor = null;
    for (let i = 1; i < unid.length; i++) { const m = Math.max(len(unid.slice(0, i)), len(unid.slice(i))); if (!melhor || m < melhor.m) melhor = { i, m }; }
    linhas = [unid.slice(0, melhor.i), unid.slice(melhor.i)];
  }
  return { unid, linhas, len };
}
// Frase de impacto (cenas com título no topo): Sora grande, linhas explícitas (cada linha entra
// por conta própria), palavra-chave em gradiente e circulada à mão. O tamanho final é medido no navegador (runtime).
function impHTML(e, at, a) {
  const { unid, linhas, len } = quebraLinhas(e.text, 14);
  const maior = Math.max(...linhas.map(len));
  const teto = e.imp.icone ? (e.imp.label ? 92 : 104) : 140;   // com ícone na batida a frase encolhe para os três caberem na faixa
  const size = Math.min(linhas.length > 1 ? Math.min(teto, e.imp.label ? 100 : 118) : teto, Math.round(900 / (maior * 0.56)));
  const semKw = !unid.some((u) => u.kw) && e.circ !== false;   // sem palavra-chave: a frase toda é circulada, em branco (circ: false desliga)
  const html = linhas.map((l) => {
    const corpo = l.map((u) => (u.kw ? `<span class="kw"><span class="g">${esc(u.t)}</span></span>${esc(u.pos || "")}` : esc(u.t + (u.pos || "")))).join(" ");
    return `<span class="ln"><span class="lt"><span class="tt">${semKw ? `<span class="kw">${corpo}</span>` : corpo}</span></span></span>`;
  }).join("");
  return `<div class="el title imp" data-noanim="1"${e.imp.caneta ? ' data-caneta="1"' : ""} style="font-size:${size}px" ${a(at)}>${html}</div>`;
}

function elHTML(e, at) {
  const a = (t) => `data-at="${(+t).toFixed(2)}"`;
  switch (e.k) {
    case "kicker": return `<div class="el kicker hf-tracking-in" data-noanim="1" ${a(at)}>${esc(e.text)}</div>`;
    case "label": return `<div class="el label" ${a(at)}>${esc(e.text)}</div>`;
    case "title": {
      if (e.imp) return impHTML(e, at, a);
      if (e.vax) {   // frase-tese com peso variável: linhas fixas, cada uma numa caixa que não quebra
        const { linhas } = quebraLinhas(e.text, 16);
        const html = linhas.map((l) => `<span class="vl">${l.map((u) => (u.kw ? `<span class="g">${esc(u.t)}</span>${esc(u.pos || "")}` : esc(u.t + (u.pos || "")))).join(" ")}</span>`).join("");
        return `<div class="el title vax" style="font-size:${e.vpx || 92}px" ${a(at)}>${html}</div>`;
      }
      const strike = e.strikeAt != null ? `<i class="line" ${a(at + e.strikeAt)}></i>` : "";
      return `<div class="el title t-${e.size || "md"}${e.wide ? " wide" : ""}${e.vax ? " vax" : ""}${e.strikeAt != null ? " struck" : ""}" ${a(at)}><span class="tx">${rich(e.text)}${strike}</span></div>`;
    }
    case "num": {
      const cls = `el num n-${e.size || "lg"}${e.grad ? " g" : ""}${e.lime ? " lime" : ""}${e.neg ? " neg" : ""}`;
      if (e.count) {
        const c = e.count;
        return `<div class="${cls}" ${a(at)}><span class="cnt" data-to="${c.to}" data-dec="${c.dec || 0}" data-pre="${esc(c.prefix || "")}" data-suf="${esc(c.suffix || "")}" ${a(at + 0.1)}>${esc((c.prefix || "") + "0" + (c.suffix || ""))}</span></div>`;
      }
      return `<div class="${cls}" ${a(at)}>${esc(e.text)}</div>`;
    }
    case "chips": {
      const step = e.step ?? 0.8, items = [];
      e.items.forEach((t, i) => {
        if (i && e.arrows) items.push(`<span class="arrow it" ${a(at + i * step - 0.15)}>→</span>`);
        const strike = e.strikeAt != null ? `<i class="line" ${a(at + e.strikeAt + i * 0.25)}></i>` : "";
        items.push(`<span class="chip it${e.dim ? " dim" : ""}${e.strikeAt != null ? " struck" : ""}" ${a(at + i * step)}>${e.check ? CHECK : ""}<span>${esc(t)}</span>${strike}</span>`);
      });
      return `<div class="el chips${e.cols === 2 ? " two" : ""}" ${a(at)} data-noanim="1">${items.join("")}</div>`;
    }
    case "row": {
      const step = e.step ?? 1;
      return `<div class="el row" ${a(at)} data-noanim="1">${e.items.map((it, i) => `<div class="cell it" ${a(at + i * step)}><div class="rn">${esc(it.n)}</div><div class="rl">${esc(it.l)}</div></div>`).join("")}</div>`;
    }
    case "people": {
      const step = e.step ?? 1;
      return `<div class="el row people" ${a(at)} data-noanim="1">${e.items.map((it, i) => `<div class="cell it" ${a(at + i * step)}><div class="pn">${esc(it.n)}</div><div class="rl">${esc(it.d)}</div></div>`).join("")}</div>`;
    }
    case "bars": {
      const step = e.step ?? 1;
      return `<div class="el bars" ${a(at)} data-noanim="1">${e.items.map((it, i) => `<div class="bar it" ${a(at + i * step)}><span class="bl">${esc(it.l)}</span><span class="track"><i class="fill${i === 0 ? "" : " alt"}" data-f="${it.f}" ${a(at + i * step + 0.2)}></i></span><span class="bv">${esc(it.v)}</span></div>`).join("")}</div>`;
    }
    case "conta": {
      const step = e.step ?? 2;
      return `<div class="el conta" ${a(at)} data-noanim="1"><div class="cw">${e.lines.map((t, i) => `<div class="cl it" ${a(at + i * step)}>${esc(t)}</div>`).join("")}</div></div>`;
    }
    case "stack": {
      const step = e.step ?? 1;
      return `<div class="el stack${e.small ? " small" : ""}" ${a(at)} data-noanim="1">${e.items.map((it, i) => `<div class="sr it struck" ${a(at + i * step)}><span class="tx"><b>${esc(it.v)}</b>${it.l ? `<em>${esc(it.l)}</em>` : ""}${e.strikeAt ? `<i class="line" ${a(at + e.strikeAt[i])}></i>` : ""}</span></div>`).join("")}</div>`;
    }
    case "dots": return `<div class="el dots" ${a(at)} data-noanim="1">${Array.from({ length: e.n }, (_, i) => `<i class="dot it" ${a(at + i * 0.45)}></i>`).join("")}</div>`;
    case "cta": return `<div class="el cta" ${a(at)}><span class="btn">${esc(e.text)}<i class="shine"></i></span><span class="down">↓</span><i class="tri"></i></div>`;
    case "ico": return `<div class="el ico" data-noanim="1" ${a(at)} style="height:${e.h || 170}px"><img src="${campanha}/${e.nome}.png" alt=""></div>`;
    case "icos": return `<div class="el icos" data-noanim="1" ${a(at)}>${e.nomes.map((nm, i) => `<div class="ico" ${a(at + i * (e.step ?? 0.25))} style="height:${e.h || 120}px"><img src="${campanha}/${nm}.png" alt=""></div>`).join("")}</div>`;
    case "logo": return `<div class="el logo" data-noanim="1" ${a(at)}><img src="${campanha}/${CAMP.logo.arquivo}" alt="${esc(CAMP.logo.texto)}" style="width:${e.w || 940}px"></div>`;
    case "x3d": return `<div class="el x3d" ${a(at)} data-noanim="1">${e.linhas.map(([t, cor, px], i) => `<div class="xl xl-${cor} it" data-t="${esc(t)}" style="font-size:${px}px" ${a(at + i * 0.35)}><span class="xf">${esc(t)}</span></div>`).join("")}</div>`;
    // ── peças novas (catálogo HyperFrames → identidade STLFLIX) ──
    case "notif": return `<div class="el notif" data-noanim="1" ${a(at)} data-check="${e.check ?? 0.6}"><div class="nb"><img class="nap" src="assets/logos/png/logo_STL.png" alt=""><div class="ncp"><div class="nh"><span>${esc(e.app || "STLFLIX")}</span><span class="nag">${esc(e.quando || "agora")}</span></div><div class="nt">${rich(e.titulo)}</div>${e.corpo ? `<div class="nbd">${esc(e.corpo)}</div>` : ""}</div><svg class="nck" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" pathLength="1"/><path d="M14 24.5l7 7L34.5 17" pathLength="1"/></svg></div></div>`;
    case "lista": {
      const step = e.step ?? 1;
      return `<div class="el lista" data-noanim="1" ${a(at)}>${e.items.map((it, i) => `<div class="lc" ${a(at + (it.d ?? i * step))}><i class="lon"></i><div class="lic"><img src="${campanha}/${it.ico}.png" alt=""></div><div class="ltx"><div class="ltt">${rich(it.t)}</div>${it.s ? `<div class="lsb">${esc(it.s)}</div>` : ""}</div></div>`).join("")}</div>`;
    }
    case "dinheiro": {
      const pre = e.pre ?? "R$ ", suf = e.suf || "", de = e.de || 0;
      const ini = esc(pre + de.toLocaleString("pt-BR") + suf);
      return `<div class="el dinheiro" data-noanim="1" ${a(at)} data-de="${de}" data-ate="${e.ate}" data-pre="${esc(pre)}" data-suf="${esc(suf)}" data-dur="${e.dur || 2}" data-icos="${esc((e.icones || ["moeda", "pilha-moedas", "carretel"]).join(","))}" data-camp="${campanha}"><i class="dglow"></i><div class="dnum"><div class="num n-${e.size || "lg"} dw">${ini}</div><div class="num n-${e.size || "lg"} lime dl">${ini}</div></div><div class="dburst"></div></div>`;
    }
    case "checklist": return `<div class="el ckl" data-noanim="1" ${a(at)}><div class="ckc">${e.items.map((it) => `<div class="ckr" ${a(at + it.d)}><svg class="ckb" viewBox="0 0 40 40"><rect class="b" x="3" y="3" width="34" height="34" rx="10"/><rect class="v" x="3" y="3" width="34" height="34" rx="10" pathLength="1"/><path d="M11 20.5l6 6L29.5 13" pathLength="1"/></svg><span class="ckt">${rich(it.t)}</span></div>`).join("")}</div>${e.selo ? `<div class="cks" ${a(at + e.selo.d)}><span>${esc(e.selo.t)}</span></div>` : ""}</div>`;
    case "preco": return `<div class="el preco" data-noanim="1" ${a(at)} data-de="${e.de}" data-n="${e.n}" data-ini="${e.ini}" data-dt="${e.dt || 0.3}"><div class="ptag"><i class="pfuro"></i><span class="pv">${esc(centavos(e.de))}</span></div></div>`;
    case "trilho": {
      const n = e.marcas ?? 5;
      return `<div class="el trilho" data-noanim="1" ${a(at)} data-a="${e.a}" data-b="${e.b}"><div class="trl"><span class="tl0">${rich(e.de)}</span><span class="tl1">${rich(e.ate)}</span></div><div class="ttr"><i class="tfill"></i>${Array.from({ length: n }, (_, i) => `<i class="tmk" data-f="${((i + 1) / (n + 1)).toFixed(3)}" style="left:${((100 * (i + 1)) / (n + 1)).toFixed(2)}%"></i>`).join("")}<i class="tend t0"><b></b></i><i class="tend t1"><b></b></i><i class="tdot"></i></div></div>`;
    }
    case "hub": {
      const hx = 210, hy = 200, nx = 600, k = ++UID;
      const ys = e.items.length === 3 ? [70, 200, 330] : e.items.map((_, i) => 60 + (i * 280) / Math.max(1, e.items.length - 1));
      const cs = ys.map((y) => [hx + 105, hy, hx + 260, hy, nx - 160, y, nx - 12, y]);
      return `<div class="el hub" data-noanim="1" ${a(at)}><svg class="hl" viewBox="0 0 952 400" width="952" height="400"><defs><linearGradient id="hg${k}" gradientUnits="userSpaceOnUse" x1="${hx + 105}" y1="0" x2="${nx}" y2="0">${DG.map((c, i) => `<stop offset="${(i / Math.max(1, DG.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join("")}</linearGradient></defs>${cs.map((c, i) => `<path class="hp" d="M${c[0]} ${c[1]} C ${c[2]} ${c[3]}, ${c[4]} ${c[5]}, ${c[6]} ${c[7]}" data-c="${c.join(",")}" pathLength="1" stroke="url(#hg${k})" ${a(at + e.items[i].d)}/>`).join("")}</svg><div class="hc" style="left:${hx}px;top:${hy}px"><div class="hico"><img src="${campanha}/${e.centro.ico}.png" alt=""></div><span>${esc(e.centro.t)}</span></div>${e.items.map((it, i) => `<div class="hn" style="left:${nx}px;top:${ys[i]}px" ${a(at + it.d + 0.4)}><div class="hico s"><img src="${campanha}/${it.ico}.png" alt=""></div><span>${rich(it.t)}</span></div><i class="hdot"></i>`).join("")}</div>`;
    }
    case "cartao": return `<div class="el cartao" data-noanim="1" ${a(at)}><div class="cc"><span class="cct">${rich(e.texto)}</span>${e.sub ? `<span class="ccs">${esc(e.sub)}</span>` : ""}<i class="ccg"></i></div></div>`;
    case "celular": {   // celular com o B-roll da plataforma na tela (browser-device-stage + physical-exit)
      const pos = e.pos || "centro", esc_ = e.escurecer ?? (pos === "centro" ? 0.6 : 0);
      const resto = e._vlen ? e._vlen - (e.de || 0) - 0.05 : Infinity;   // não passa do fim do vídeo (tela preta)
      const vdur = Math.max(0.5, Math.min(e.vdur ?? (e._fim - at), resto));
      return `<div class="el celular cel-${pos}" data-noanim="1" ${a(at)} data-esc="${esc_}" data-fim="${(at + vdur).toFixed(2)}">${esc_ ? '<i class="cdim"></i>' : ""}<div class="cpos"><div class="cfone"><div class="ctela"><video class="clip" src="brolls/${esc(e.video)}" data-start="${(+at).toFixed(2)}" data-duration="${vdur.toFixed(2)}" data-track-index="3" data-media-start="${e.de || 0}" muted playsinline></video><i class="cgloss"></i></div><i class="cilha"></i></div></div></div>`;
    }
    case "ctatoque": return `<div class="el cta ctt" ${a(at)} data-tap="${e.toque ?? 0.9}"><span class="btn">${esc(e.text)}<i class="shine"></i></span><span class="down">↓</span><i class="tri"></i><i class="rip"></i><i class="tap"></i></div>`;
  }
  throw new Error("peça desconhecida: " + e.k);
}

const CSS = `
__ROOT__ { position: absolute; inset: 0; overflow: hidden; font-family: var(--font-title);
  --grad-title: ${degrade(DG)};
  --accent: ${CAMP.cores.barra}; }   /* Black: só verde → azul (sem violeta/rosa); barrinha no azul da campanha */
.band { position: absolute; left: ${BAND.side}px; right: ${BAND.side}px; top: ${BAND.top}px; height: ${BAND.height}px; }
.phase { font-family: var(--font-title); position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center;
  text-shadow: 0 2px 18px rgba(0,0,0,.55), 0 1px 3px rgba(0,0,0,.5); }
.topo { position: absolute; left: 0; right: 0; top: 24px; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; text-shadow: 0 2px 18px rgba(0,0,0,.55), 0 1px 3px rgba(0,0,0,.5); }
.phase.sob { top: 100px; }
/* título pequeno (topo e dentro das cenas): tracking-in (componente do registry) — Inter em caixa alta, branco, letras se aproximando.
   Verde-lima fica reservado para resultado (números) e CTA. */
.kicker.hf-tracking-in { font: 700 36px/1.2 var(--font-body); text-transform: uppercase; color: #fff;
  letter-spacing: var(--hf-tracking-value, .6em); text-shadow: 0 2px 12px rgba(0,0,0,.6), 0 0 2px rgba(0,0,0,.35); }
/* frase de impacto: Sora, palavra-chave circulada à mão */
.title.imp { font-family: var(--font-title); font-weight: 700; letter-spacing: 0; line-height: 1.12; max-width: 952px; }   /* .title.imp vence o espaçamento negativo do .title (o colorama desenha sem ele) */
.imp .ln { display: block; white-space: nowrap; }
.imp .lt { position: relative; display: inline-block; }
.imp .ln + .ln { margin-top: .16em; }
.imp + .label { margin-top: 30px; }
.imp .kw { position: relative; display: inline-block; }
.imp .circ, .imp .ca-ink { position: absolute; overflow: visible; pointer-events: none; }
.imp .ca-ink path { filter: drop-shadow(0 0 8px rgba(255,255,255,.4)) drop-shadow(0 2px 6px rgba(0,0,0,.45)); }
.imp .ca-pen { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; filter: drop-shadow(0 6px 10px rgba(0,0,0,.45)); }
.imp .circ path { fill: none; stroke: var(--cta); stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1;
  filter: drop-shadow(0 0 8px rgba(184,242,60,.6)); }
/* palavra-chave da frase de impacto: camada branca por cima do gradiente, que some (--branco 1 → 0) */
/* frase-tese: Sora variável, começa fina e ganha peso */
@font-face { font-family: "Plus Jakarta Sans"; src: url("fx/plus-jakarta-sans-variable-latin.woff2") format("woff2"); font-weight: 200 800; font-display: block; }   /* guia BF26: título de impacto */
@font-face { font-family: "Sora Var"; src: url("fx/sora-variable-latin.woff2") format("woff2"); font-weight: 100 800; font-display: block; }
.title.vax { font-family: "Sora Var", var(--font-title); font-weight: 200; font-size: 92px; line-height: 1.1; letter-spacing: 0; max-width: 952px; }
.vax .vl { display: block; white-space: nowrap; }
.imp .g, .vax .g { --branco: 0; background-image: linear-gradient(rgba(255,255,255,var(--branco)), rgba(255,255,255,var(--branco))), var(--grad-title); }
.accent { display: none; width: 140px; height: 10px; border-radius: 5px; background: var(--accent); box-shadow: 0 2px 12px rgba(0,0,0,.4); margin-bottom: 8px; flex: 0 0 auto; }
.kicker { font: 600 34px/1.2 var(--font-body); letter-spacing: .14em; text-transform: uppercase; color: rgba(246,250,254,.85); }
.title { font-weight: 700; color: var(--text); letter-spacing: -.03em; line-height: 1.08; max-width: 952px; }
.t-sm { font-size: 58px; } .t-md { font-size: 74px; } .t-lg { font-size: 100px; } .t-xl { font-size: 150px; }
.wide { letter-spacing: .08em; }
.tx { position: relative; display: inline-block; }
.num { white-space: nowrap; font-weight: 700; color: var(--text); letter-spacing: -.04em; line-height: .95; font-variant-numeric: tabular-nums; }
.num.lime { background: ${NUM_BG}; -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: none;
  filter: drop-shadow(0 0 18px rgba(${rgb(RES[1] || RES[0])},.35)) drop-shadow(0 2px 12px rgba(0,0,0,.45)); }
.num.lime .cnt { background: inherit; -webkit-background-clip: text; background-clip: text; }
.n-lg { font-size: 160px; } .n-md { font-size: 116px; }
.neg { color: var(--no); }
.label { font: 600 42px/1.2 var(--font-body); color: rgba(246,250,254,.88); max-width: 952px; }
.g { background: var(--grad-title); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: none; filter: drop-shadow(0 2px 12px rgba(0,0,0,.45)); }
.num.g .cnt { background: inherit; -webkit-background-clip: text; background-clip: text; }
.chips { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 14px 14px; max-width: 952px; }
.chips.two { display: grid; grid-template-columns: repeat(2, auto); justify-content: center; }
.chip { position: relative; display: inline-flex; align-items: center; gap: 10px; padding: 12px 28px; border-radius: 999px; border: 2px solid rgba(246,250,254,.55);
  font: 600 38px/1.15 var(--font-body); color: var(--text); white-space: nowrap; }
.chip .ck { flex: 0 0 auto; filter: drop-shadow(0 1px 4px rgba(0,0,0,.4)); }
.chip.dim { color: rgba(246,250,254,.7); border-color: rgba(246,250,254,.3); }
.arrow { font: 600 40px var(--font-body); color: rgba(246,250,254,.7); }
.line { position: absolute; left: -4%; right: -4%; top: 52%; height: 4px; border-radius: 2px; background: var(--no); transform-origin: left center; transform: scaleX(0); display: block; }
.row { display: flex; justify-content: center; align-items: flex-start; gap: 52px; }
.cell { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.rn { font: 700 92px/1 var(--font-title); letter-spacing: -.04em; color: var(--text); }
.pn { font: 700 64px/1.05 var(--font-title); letter-spacing: -.03em; color: var(--text); }
.rl { font: 600 34px/1.2 var(--font-body); color: rgba(246,250,254,.85); max-width: 320px; }
.bars { display: flex; flex-direction: column; gap: 22px; width: 900px; }
.bar { display: grid; grid-template-columns: 150px 1fr 170px; align-items: center; gap: 22px; }
.bl { font: 600 36px var(--font-body); color: var(--text); text-align: right; }
.bv { font: 700 56px var(--font-title); color: var(--text); text-align: left; letter-spacing: -.03em; }
.track { position: relative; height: 22px; border-radius: 11px; background: rgba(246,250,254,.18); overflow: hidden; }
.fill { position: absolute; inset: 0; background: var(--text); transform-origin: left center; transform: scaleX(0); display: block; border-radius: 11px; }
.fill.alt { background: var(--grad-title); }
.conta { height: 210px; overflow: hidden; width: 952px; -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 30%, #000 100%); mask-image: linear-gradient(to bottom, transparent 0, #000 30%, #000 100%); }
.cw { display: flex; flex-direction: column; justify-content: flex-end; min-height: 210px; }
.cl { font: 600 44px/70px var(--font-body); color: var(--text); white-space: nowrap; }
.stack { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.sr b { font: 700 74px/1.05 var(--font-title); letter-spacing: -.03em; color: var(--text); }
.sr em { font: 600 34px var(--font-body); font-style: normal; color: rgba(246,250,254,.8); margin-left: 18px; }
.stack.small .sr b { font-size: 54px; }
.dots { display: flex; gap: 22px; margin-top: 8px; }
.dot { display: block; width: 26px; height: 26px; border-radius: 50%; border: 3px solid rgba(246,250,254,.8); }
.cta { display: flex; flex-direction: column; align-items: center; gap: 18px; }
.btn { display: inline-block; padding: 30px 64px; border-radius: 999px; background: var(--grad-title); color: #0d0e14; font: 700 54px/1 var(--font-title); letter-spacing: -.01em; text-shadow: none;
  box-shadow: 0 14px 40px rgba(184,242,60,.35), 0 6px 18px rgba(0,0,0,.4); }
.down { font: 700 64px/1 var(--font-body); color: var(--cta); }
/* ── efeitos da Black (cenas fx) ── */
.shine, .tri { display: none; }
.fx .num.lime { position: relative; }
.fx .down { display: none; }
.fx .tri { display: block; width: 0; height: 0; border-left: 44px solid transparent; border-right: 44px solid transparent; border-top: 56px solid ${COR2};
  filter: drop-shadow(0 0 16px rgba(${rgb(COR2)},.7)) drop-shadow(0 3px 8px rgba(0,0,0,.5)); }
.fx .btn { position: relative; overflow: hidden; box-shadow: 0 0 36px rgba(${rgb(COR2)},.5), 0 0 90px rgba(${rgb(COR3)},.25), 0 6px 18px rgba(0,0,0,.4); }
.fx .shine { display: block; position: absolute; top: -40%; bottom: -40%; left: -40%; width: 30%; transform: skewX(-22deg);
  background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.85), rgba(255,255,255,0)); }
.dust { position: absolute; left: -${BAND.side}px; top: -110px; width: ${W}px; height: 600px; pointer-events: none; }
/* tipo 3D da campanha: camada de trás = extrusão + glow, da frente = gradiente */
/* assets oficiais (kit BF26): objeto com sombra curta e brilho verde só embaixo */
.ico { position: relative; display: flex; justify-content: center; align-items: flex-end; flex: 0 0 auto; }
.ico img { height: 100%; width: auto; display: block; position: relative; z-index: 1; filter: drop-shadow(0 10px 14px rgba(0,0,0,.45)); }
.ico::after { content: ""; position: absolute; left: 50%; bottom: -4%; width: 72%; height: 16%; transform: translateX(-50%); z-index: 0;
  background: radial-gradient(ellipse at center, rgba(${rgb(CAMP.cores.brilho)},.5), rgba(${rgb(CAMP.cores.brilho)},0) 70%); filter: blur(6px); }
.icos { display: flex; justify-content: center; align-items: flex-end; gap: 28px; margin-top: 10px; }
.logo img { display: block; height: auto; filter: drop-shadow(0 16px 26px rgba(0,0,0,.5)); }
.x3d { display: flex; flex-direction: column; align-items: center; gap: 0; }
.xl { position: relative; font-family: "Plus Jakarta Sans", "Sora Var", var(--font-title); font-weight: 800; text-transform: uppercase; line-height: 1.02; letter-spacing: -.02em; white-space: nowrap; }
.xl .xf { position: relative; z-index: 1; display: block; }
.xl::before { content: attr(data-t); position: absolute; left: 0; right: 0; top: 0; text-align: center; z-index: 0; }   /* extrusão: pseudo-elemento atrás da face */
.xl .xf { -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: none; }
.xl-azul::before { color: #1a56d6; text-shadow: 0 1px 0 #1a56d6, 0 2px 0 #1951cc, 0 3px 0 #174cc1, 0 4px 0 #1647b7, 0 5px 0 #1442ac, 0 6px 0 #133da2, 0 7px 0 #123898, 0 8px 0 #10348d, 0 9px 0 #0f2f83, 0 10px 0 #0e2a79, 0 11px 0 #0c256e, 0 12px 0 #0b2064, 0 13px 0 #091b59, 0 14px 0 #08164f, 0 22px 22px rgba(0,0,0,.55), 0 0 60px rgba(46,139,255,.5); }
.xl-azul .xf { background-image: linear-gradient(180deg, #b8f6ff 0%, #5fd6ff 26%, #2f9bff 58%, #1f62ec 100%); }
.xl-verde::before { color: #11a83a; text-shadow: 0 1px 0 #11a83a, 0 2px 0 #10a038, 0 3px 0 #0f9835, 0 4px 0 #0e9133, 0 5px 0 #0d8930, 0 6px 0 #0c812e, 0 7px 0 #0b792b, 0 8px 0 #0a7229, 0 9px 0 #096a26, 0 10px 0 #086224, 0 11px 0 #075a21, 0 12px 0 #06531f, 0 13px 0 #054b1c, 0 14px 0 #04431a, 0 22px 22px rgba(0,0,0,.55), 0 0 60px rgba(7,239,45,.42); }
.xl-verde .xf { background-image: linear-gradient(180deg, #e2ff9e 0%, #8ff76a 26%, #2fe84f 58%, #0fbf3c 100%); }
/* ── peças novas ── */
/* notif: cartão escuro da marca (sem backdrop-filter: o .mov é transparente, não há vídeo atrás para desfocar) */
.notif { width: 952px; display: flex; justify-content: center; text-shadow: none; }
.nb { position: relative; display: flex; align-items: center; gap: 28px; width: 920px; padding: 28px 34px 28px 28px; border-radius: 44px; text-align: left;
  background: linear-gradient(180deg, rgba(30,32,44,.94), rgba(17,18,26,.94)); border: 2px solid rgba(246,250,254,.14);
  box-shadow: 0 26px 60px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.08); opacity: 0; }
.nb::after { content: ""; position: absolute; left: 44px; right: 44px; top: -1px; height: 3px; border-radius: 2px; background: var(--grad-title); opacity: .9; }
.nap { width: 112px; height: 112px; border-radius: 26px; background: #fff; flex: 0 0 auto; object-fit: cover; box-shadow: 0 8px 18px rgba(0,0,0,.4); }
.ncp { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.nh { display: flex; gap: 16px; align-items: baseline; font: 600 26px/1.2 var(--font-body); letter-spacing: .14em; text-transform: uppercase; color: rgba(246,250,254,.62); }
.nag { letter-spacing: 0; text-transform: none; color: rgba(246,250,254,.45); }
.nt { font: 700 54px/1.08 var(--font-title); color: var(--text); letter-spacing: -.02em; white-space: nowrap; }
.nbd { font: 600 32px/1.25 var(--font-body); color: rgba(246,250,254,.78); white-space: nowrap; }
.nck { width: 92px; height: 92px; flex: 0 0 auto; overflow: visible; filter: drop-shadow(0 0 12px rgba(61,220,132,.55)); }
.nck circle, .nck path { fill: none; stroke: var(--ok); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1; }
.nck path { stroke-width: 4.5; }
/* lista: cards da marca, o card que acabou de entrar ganha a borda em gradiente */
.lista { display: flex; flex-direction: column; gap: 14px; width: 952px; text-shadow: none; }
.lc { position: relative; display: flex; align-items: center; gap: 26px; height: 128px; padding: 0 36px 0 24px; border-radius: 32px; text-align: left; opacity: 0;
  background: linear-gradient(180deg, rgba(30,32,44,.9), rgba(17,18,26,.9)); border: 2px solid rgba(246,250,254,.12); box-shadow: 0 18px 44px rgba(0,0,0,.45); }
.lon { position: absolute; inset: -2px; border-radius: 32px; padding: 3px; background: var(--grad-title); opacity: 0;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
.lic { position: relative; width: 108px; height: 104px; flex: 0 0 auto; display: flex; align-items: flex-end; justify-content: center; }
.lic img { height: 100%; width: auto; position: relative; z-index: 1; filter: drop-shadow(0 8px 12px rgba(0,0,0,.45)); }
.lic::after { content: ""; position: absolute; left: 50%; bottom: -4%; width: 76%; height: 18%; transform: translateX(-50%);
  background: radial-gradient(ellipse at center, rgba(${rgb(CAMP.cores.brilho)},.5), rgba(${rgb(CAMP.cores.brilho)},0) 70%); filter: blur(6px); }
.ltx { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ltt { font: 700 54px/1.05 var(--font-title); letter-spacing: -.02em; color: var(--text); white-space: nowrap; }
.lsb { font: 600 30px/1.2 var(--font-body); color: rgba(246,250,254,.72); white-space: nowrap; }
/* dinheiro: conta em branco, aterrissa no verde de resultado com pulso, brilho e ícones da campanha */
.dinheiro { position: relative; display: flex; flex-direction: column; align-items: center; }
.dnum { position: relative; display: inline-grid; z-index: 2; }
.dnum > .num { grid-area: 1 / 1; }
.dl { opacity: 0; }
.dglow { position: absolute; left: 50%; top: 50%; width: 980px; height: 400px; margin: -200px 0 0 -490px; border-radius: 50%; z-index: 0; pointer-events: none; opacity: 0;
  background: radial-gradient(ellipse at center, rgba(${rgb(CAMP.cores.brilho)},.42), rgba(${rgb(COR3)},.12) 45%, rgba(${rgb(COR3)},0) 68%); }
.dburst { position: absolute; left: 50%; top: 50%; width: 0; height: 0; z-index: 1; pointer-events: none; }
.phase:has(.dinheiro) .label, .phase:has(.dinheiro) .kicker { position: relative; z-index: 4; }   /* textos da batida na frente dos ícones (antes e depois do número) */
/* checklist (marker-checklist-card): card da marca, linhas apagadas que acendem e ganham ✓ no nome falado, selo carimbado */
.ckl { position: relative; width: 952px; display: flex; justify-content: center; text-shadow: none; }
.ckc { display: flex; flex-direction: column; gap: 8px; width: 880px; padding: 22px 40px 22px 32px; border-radius: 36px; text-align: left;
  background: linear-gradient(180deg, rgba(30,32,44,.9), rgba(17,18,26,.9)); border: 2px solid rgba(246,250,254,.12); box-shadow: 0 22px 54px rgba(0,0,0,.5); opacity: 0; }
.ckr { display: flex; align-items: center; gap: 22px; height: 64px; opacity: .35; }
.ckb { width: 52px; height: 52px; flex: 0 0 auto; overflow: visible; }
.ckb rect, .ckb path { fill: none; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.ckb .b { stroke: rgba(246,250,254,.4); }
.ckb .v, .ckb path { stroke: var(--ok); stroke-dasharray: 1; stroke-dashoffset: 1; filter: drop-shadow(0 0 6px rgba(61,220,132,.55)); }
.ckb path { stroke-width: 4.5; }
.ckt { font: 700 46px/1.05 var(--font-title); color: var(--text); letter-spacing: -.02em; white-space: nowrap; }
.cks { position: absolute; right: 30px; bottom: 4px; padding: 14px 30px; border-radius: 18px; border: 5px solid ${COR2}; background: rgba(13,14,20,.82);
  font: 800 52px/1 "Plus Jakarta Sans", var(--font-title); letter-spacing: .04em; text-transform: uppercase; opacity: 0;
  box-shadow: 0 0 30px rgba(${rgb(COR2)},.45), 0 10px 26px rgba(0,0,0,.5); }
.cks span { display: block; background: var(--grad-title); -webkit-background-clip: text; background-clip: text; color: transparent; }
/* preco: etiqueta de preço que cai de centavo em centavo (cada queda pisca no vermelho) */
.preco { display: flex; justify-content: center; text-shadow: none; }
.ptag { position: relative; display: flex; align-items: center; gap: 34px; padding: 20px 60px 20px 44px; border-radius: 34px; opacity: 0;
  background: linear-gradient(180deg, rgba(30,32,44,.92), rgba(17,18,26,.92)); border: 2px solid rgba(246,250,254,.14); box-shadow: 0 22px 54px rgba(0,0,0,.5); }
.pfuro { display: block; width: 30px; height: 30px; border-radius: 50%; border: 5px solid rgba(246,250,254,.5); flex: 0 0 auto; }
.pv { display: inline-block; font: 700 140px/1 var(--font-title); letter-spacing: -.04em; color: var(--text); white-space: nowrap; font-variant-numeric: tabular-nums; }
/* trilho (state-chip-rail + tracing-beam): da etapa inicial à final, um feixe de luz percorre o trilho e acende as marcas */
.trilho { width: 952px; display: flex; flex-direction: column; align-items: center; gap: 26px; }
.trl { width: 900px; display: flex; justify-content: space-between; }
.tl0, .tl1 { font: 700 50px/1.05 var(--font-title); color: var(--text); letter-spacing: -.02em; opacity: 0; white-space: nowrap; }
.ttr { position: relative; width: 840px; height: 14px; border-radius: 7px; background: rgba(246,250,254,.2); box-shadow: 0 2px 12px rgba(0,0,0,.4); }
.tfill { position: absolute; inset: 0; display: block; border-radius: 7px; background: var(--grad-title); transform-origin: left center; transform: scaleX(0); box-shadow: 0 0 18px rgba(${rgb(COR2)},.55); }
.tmk { position: absolute; top: 50%; display: block; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: #0d0e14; border: 3px solid rgba(246,250,254,.5); }
.tend { position: absolute; top: 50%; display: block; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; background: #0d0e14; border: 4px solid rgba(246,250,254,.7); }
.tend b { position: absolute; inset: 5px; border-radius: 50%; background: var(--grad-title); opacity: 0; display: block; }
.tend.t0 { left: 0; } .tend.t1 { left: 100%; }
.tdot { position: absolute; top: 50%; left: 0; display: block; width: 28px; height: 28px; margin: -14px 0 0 -14px; border-radius: 50%; background: #fff; opacity: 0;
  box-shadow: 0 0 16px #fff, 0 0 40px ${COR2}; }
/* hub (constellation-hub): o produto no centro, linhas em gradiente desenham até cada caminho com um ponto de luz na ponta */
.hub { position: relative; width: 952px; height: 400px; }
.hl { position: absolute; left: 0; top: 0; overflow: visible; }
.hp { fill: none; stroke-width: 6; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; filter: drop-shadow(0 0 8px rgba(${rgb(COR2)},.5)); }
.hc { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 10px; opacity: 0; }
.hico { position: relative; height: 180px; display: flex; align-items: flex-end; justify-content: center; }
.hico.s { height: 104px; }
.hico img { height: 100%; width: auto; position: relative; z-index: 1; filter: drop-shadow(0 10px 14px rgba(0,0,0,.45)); }
.hico::after { content: ""; position: absolute; left: 50%; bottom: -4%; width: 72%; height: 16%; transform: translateX(-50%);
  background: radial-gradient(ellipse at center, rgba(${rgb(CAMP.cores.brilho)},.5), rgba(${rgb(CAMP.cores.brilho)},0) 70%); filter: blur(6px); }
.hc > span { font: 700 30px/1.2 var(--font-body); color: #fff; text-transform: uppercase; letter-spacing: .14em; white-space: nowrap; }
.hn { position: absolute; display: flex; align-items: center; gap: 20px; opacity: 0; }
.hn > span { font: 700 56px/1 var(--font-title); color: var(--text); letter-spacing: -.02em; white-space: nowrap; }
.hdot { position: absolute; left: 0; top: 0; display: block; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; background: #fff; opacity: 0;
  box-shadow: 0 0 14px #fff, 0 0 34px ${COR2}; }
/* cartao (gloss-sweep): o card pousa com um tranco contido e um reflexo diagonal passa uma vez */
.cartao { display: flex; justify-content: center; text-shadow: none; }
.cc { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 24px 72px 30px; border-radius: 40px; opacity: 0;
  background: linear-gradient(180deg, rgba(30,32,44,.94), rgba(17,18,26,.94)); border: 2px solid rgba(246,250,254,.16);
  box-shadow: 0 26px 60px rgba(0,0,0,.55), 0 0 60px rgba(${rgb(COR3)},.2); }
.cct { font: 700 132px/1 var(--font-title); color: var(--text); letter-spacing: -.04em; white-space: nowrap; font-variant-numeric: tabular-nums; }
.ccs { font: 600 34px/1.2 var(--font-body); color: rgba(246,250,254,.75); }
.ccg { position: absolute; top: -40%; bottom: -40%; left: 0; width: 18%; display: block; background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.5), rgba(255,255,255,0)); }
/* ctatoque (gesture-tap): um toque entra, aperta o botão, solta uma onda e sai */
.ctt { position: relative; }
.tap, .rip { position: absolute; left: calc(50% + 250px); top: 57px; display: block; border-radius: 50%; opacity: 0; pointer-events: none; }
.tap { width: 96px; height: 96px; margin: -48px 0 0 -48px; z-index: 3; background: rgba(255,255,255,.3); border: 4px solid rgba(255,255,255,.92); box-shadow: 0 8px 22px rgba(0,0,0,.45); }
.rip { width: 130px; height: 130px; margin: -65px 0 0 -65px; z-index: 2; border: 5px solid ${COR2}; box-shadow: 0 0 22px rgba(${rgb(COR2)},.6); }
/* celular: posicionado no quadro inteiro (fora da faixa); "centro" escurece o fundo e vira um corte para a tela */
.celular { position: absolute; left: 0; top: 0; width: 0; height: 0; text-shadow: none; }
.cdim { position: absolute; left: -${BAND.side}px; top: -${BAND.top}px; width: ${W}px; height: ${H}px; z-index: -1; display: block; opacity: 0;
  background: radial-gradient(ellipse at 50% 62%, rgba(6,9,20,.55), rgba(6,9,20,.92) 75%); }
.cpos { position: absolute; perspective: 1700px; }
.cel-centro .cpos { left: ${W / 2 - BAND.side}px; top: ${640 - BAND.top}px; }
.cel-direita .cpos { left: ${W - BAND.side - 60 - 200}px; top: ${880 - BAND.top}px; }
.cel-esquerda .cpos { left: ${60 - BAND.side + 200}px; top: ${880 - BAND.top}px; }
.cfone { position: relative; padding: 16px; border-radius: 72px; opacity: 0; transform-style: preserve-3d;
  background: linear-gradient(160deg, #2a2d3a 0%, #12131b 45%, #0b0c12 100%); border: 2px solid rgba(246,250,254,.2);
  box-shadow: 0 0 0 2px rgba(0,0,0,.6), 0 40px 90px rgba(0,0,0,.6), 0 0 80px rgba(${rgb(COR3)},.28), inset 0 1px 0 rgba(255,255,255,.15); }
.cel-centro .ctela { width: 540px; height: 960px; }
.cel-direita .ctela, .cel-esquerda .ctela { width: 368px; height: 654px; }
.cel-direita .cfone, .cel-esquerda .cfone { padding: 12px; border-radius: 54px; }
.ctela { position: relative; overflow: hidden; border-radius: 56px; background: #05060a; }
.cel-direita .ctela, .cel-esquerda .ctela { border-radius: 42px; }
.ctela video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.cgloss { position: absolute; top: -30%; bottom: -30%; left: 0; width: 26%; display: block; opacity: .6;
  background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.45), rgba(255,255,255,0)); }
.cilha { position: absolute; left: 50%; top: 30px; width: 128px; height: 34px; margin-left: -64px; border-radius: 17px; background: #000; display: block; }
.cel-direita .cilha, .cel-esquerda .cilha { top: 22px; width: 92px; height: 26px; margin-left: -46px; }
.dburst img { position: absolute; left: 0; top: 0; width: auto; opacity: 0; filter: drop-shadow(0 10px 14px rgba(0,0,0,.45)); }
`;

// ───────────────────────── runtime (timeline a partir dos data-at) ─────────────────────────
const RUNTIME = `
(function (ID, DUR) {
  // montada depois que as fontes carregam (o ajuste de tamanho e a caneta medem o texto); registra no fim
  var monta = function () {
  var R = document.getElementById("r-" + ID);
  var q = function (s) { return R.querySelectorAll(s); };
  var tl = gsap.timeline({ paused: true });
  var at = function (el) { return parseFloat(el.getAttribute("data-at")); };
  // frase de impacto: mede pela fonte (a cena pode estar oculta agora, então o layout ainda mede zero),
  // ajusta o tamanho, entra com headline-slam + soft-blur-in e a caneta circula a palavra-chave
  var cvm = document.createElement("canvas").getContext("2d");
  var larg = function (txt, px) { cvm.font = "700 " + px + "px Sora"; return cvm.measureText(txt).width; };
  q(".imp").forEach(function (el, n) {
    var t0 = at(el), lts = el.querySelectorAll(".lt"), px = parseFloat(el.style.fontSize), maior = 0;
    lts.forEach(function (lt) { maior = Math.max(maior, larg(lt.textContent.trim(), px)); });
    if (maior > 900) { px = Math.floor(px * 900 / maior); el.style.fontSize = px + "px"; }
    var alt = Math.round(px * 1.12);
    // caneta (cursor-annotate) circula a palavra-chave; o tempo cabe antes da batida sair
    var ph = el.closest(".phase"), saida = ph && ph.getAttribute("data-out") ? parseFloat(ph.getAttribute("data-out")) : DUR - 0.6;
    if (el.getAttribute("data-caneta")) el.querySelectorAll(".kw").forEach(function (kw, i) {
      var ini = t0 + 1.0 + i * 0.15;
      window.caAnotar(kw, { tl: tl, at: ini, budget: saida - 0.1 - ini, w: Math.round(larg(kw.textContent.trim(), px)), h: alt, color: "#FFFFFF", seed: n * 7 + i + 3 });
    });
    // headline-slam (registry): cada linha cai de 1,6× e pousa com expo.out; soft-blur-in (registry): desfocada até pousar
    lts.forEach(function (lt, i) {
      tl.fromTo(lt, { scale: 1.6, opacity: 0, filter: "blur(14px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.5, ease: "expo.out" }, t0 + i * 0.14);
    });
    // pouso da última linha: tremor de 3 quadros (o "impacto" do headline-slam)
    var pouso = t0 + (lts.length - 1) * 0.14 + 0.22, Q = 1 / 30;
    tl.to(el, { x: 7, y: -4, duration: Q, ease: "power2.out" }, pouso);
    tl.to(el, { x: -5, y: 3, duration: Q, ease: "power2.out" }, pouso + Q);
    tl.to(el, { x: 0, y: 0, duration: Q, ease: "power2.out" }, pouso + 2 * Q);
    // a palavra-chave sai do branco para o gradiente verde → azul
    el.querySelectorAll(".g").forEach(function (g) { tl.fromTo(g, { "--branco": 1 }, { "--branco": 0, duration: 0.45, ease: "power1.inOut" }, pouso + 0.25); });
  });
  // variable-axis-type: a frase entra fina e "engorda" (expo.out); a palavra-chave vai mais longe e ganha a cor
  q(".vax").forEach(function (el) {
    var t0 = at(el), vpx = parseFloat(el.style.fontSize) || 92, vmaior = 0;
    // mede cada linha no peso final (800, o mais largo) e reduz o tamanho se precisar — o texto não re-quebra no meio
    el.querySelectorAll(".vl").forEach(function (vl) { cvm.font = '800 ' + vpx + 'px "Sora Var"'; vmaior = Math.max(vmaior, cvm.measureText(vl.textContent).width); });
    if (vmaior > 930) el.style.fontSize = Math.floor(vpx * 930 / vmaior) + "px";
    tl.fromTo(el, { fontWeight: 200 }, { fontWeight: 700, duration: 1.1, ease: "expo.out" }, t0 + 0.35);
    el.querySelectorAll(".g").forEach(function (g) {
      tl.fromTo(g, { fontWeight: 200, "--branco": 1 }, { fontWeight: 800, "--branco": 0, duration: 1.1, ease: "expo.out" }, t0 + 0.55);
    });
  });
  q(".phase").forEach(function (ph) {
    var t0 = parseFloat(ph.getAttribute("data-at")), out = ph.getAttribute("data-out"), slow = ph.getAttribute("data-slow") === "1";
    var bar = ph.querySelector(".accent");
    if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power3.out" }, t0);
    if (out) tl.to(ph, { opacity: 0, y: -24, duration: 0.32, ease: "power2.in" }, parseFloat(out));
    ph.querySelectorAll(".el").forEach(function (el) {
      if (el.getAttribute("data-noanim") === "1") return;
      tl.fromTo(el, { opacity: 0, y: slow ? 34 : 26 }, { opacity: 1, y: 0, duration: slow ? 0.8 : 0.45, ease: "power3.out" }, at(el));
    });
  });
  // tracking-in em todo título pequeno: as letras chegam afastadas e se aproximam até o espaçamento final, subindo de leve
  q(".kicker.hf-tracking-in").forEach(function (kk) {
    tl.fromTo(kk, { opacity: 0, y: 10, "--hf-tracking-value": "0.6em" }, { opacity: 1, y: 0, "--hf-tracking-value": "0.16em", duration: 0.9, ease: "power3.out" }, kk.hasAttribute("data-at") ? at(kk) : 0.3);
  });
  q(".it").forEach(function (el) { tl.fromTo(el, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, at(el)); });
  q(".cnt").forEach(function (el) {
    var to = parseFloat(el.getAttribute("data-to")), dec = parseInt(el.getAttribute("data-dec"), 10), pre = el.getAttribute("data-pre"), suf = el.getAttribute("data-suf");
    var o = { v: 0 };
    var fmt = function (v) { return pre + v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; };
    tl.to(o, { v: to, duration: 1.3, ease: "power2.out", onUpdate: function () { el.textContent = fmt(o.v); } }, at(el));
  });
  q(".line").forEach(function (el) { tl.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power2.inOut" }, at(el)); });
  q(".line").forEach(function (el) { var host = el.closest(".struck"); if (host) tl.to(host, { opacity: 0.55, duration: 0.3 }, at(el) + 0.3); });
  q(".fill").forEach(function (el) { tl.fromTo(el, { scaleX: 0 }, { scaleX: parseFloat(el.getAttribute("data-f")), duration: 1.0, ease: "power3.out" }, at(el)); });
  q(".dot").forEach(function (el) { tl.to(el, { backgroundColor: "#F6FAFE", duration: 0.25 }, at(el) + 0.3); });
  q(".conta").forEach(function (box) {
    var lines = box.querySelectorAll(".cl"), cw = box.querySelector(".cw");
    lines.forEach(function (ln, i) { if (i >= 3) tl.to(cw, { y: -70 * (i - 2), duration: 0.45, ease: "power3.out" }, at(ln) - 0.05); });
  });
  var fx = R.querySelector(".band").classList.contains("fx");
  q(".cta .btn").forEach(function (btn) {
    var t = at(btn.parentNode) + 0.2;
    tl.fromTo(btn, { scale: 0.85 }, { scale: 1, duration: 0.6, ease: "power3.out" }, t);
    if (fx) {
      // seta flutuando em seno até o fim + reflexo varrendo o botão de tempos em tempos
      var tri = btn.parentNode.querySelector(".tri"), sh = btn.querySelector(".shine");
      var reps = Math.max(1, Math.floor((DUR - 0.6 - (t + 0.8)) / 1.1));
      tl.fromTo(tri, { y: 0 }, { y: 24, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: reps }, t + 0.8);
      for (var k = t + 1.0; k < DUR - 1.2; k += 2.8) tl.fromTo(sh, { x: 0, xPercent: 0, skewX: -22 }, { x: 0, xPercent: 520, skewX: -22, duration: 0.8, ease: "power2.inOut" }, k);
      return;
    }
    var down = btn.parentNode.querySelector(".down");
    for (var k2 = 0; k2 < 3; k2++) tl.fromTo(down, { y: 0 }, { y: 14, duration: 0.35, ease: "power2.inOut", yoyo: true, repeat: 1 }, t + 1.2 + k2 * 1.4);
  });
  // ícones e logo: entram com mola (back.out) e flutuam em seno até o fim da cena
  q(".ico, .logo").forEach(function (el, i) {
    var t = at(el), img = el.querySelector("img"), logo = el.classList.contains("logo");
    tl.fromTo(el, { opacity: 0, scale: logo ? 0.82 : 0.55, y: logo ? 0 : 24 }, { opacity: 1, scale: 1, y: 0, duration: logo ? 0.8 : 0.6, ease: logo ? "back.out(1.6)" : "back.out(1.9)" }, t);
    var ini = t + 0.7, voltas = Math.max(0, Math.floor((DUR - 0.6 - ini) / 1.3));
    if (voltas > 0) tl.fromTo(img, { y: 0 }, { y: logo ? -6 : -9, duration: 1.3, ease: "sine.inOut", yoyo: true, repeat: voltas - 1 + (voltas % 2) }, ini + (i % 3) * 0.2);
  });
  // tipo 3D entra com um "pop"
  q(".xl").forEach(function (el) { tl.fromTo(el, { scale: 0.8 }, { scale: 1, duration: 0.75, ease: "back.out(1.8)" }, at(el)); });
  // poeira subindo: posição é função do tempo (determinística), desenhada a cada atualização da timeline
  q(".dust").forEach(function (cv) {
    var de = parseFloat(cv.getAttribute("data-de")), ate = parseFloat(cv.getAttribute("data-ate")), s = parseInt(cv.getAttribute("data-seed"), 10) >>> 0;
    var ctx = cv.getContext("2d"), Wc = cv.width, Hc = cv.height, L = Hc + 160;
    var rnd = function () { s = (s + 0x6D2B79F5) | 0; var r = Math.imul(s ^ (s >>> 15), 1 | s); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
    var P = [];
    for (var i = 0; i < 90; i++) { var big = rnd() < 0.25; P.push({ x: rnd() * Wc, y0: rnd() * L, v: big ? 28 + rnd() * 36 : 45 + rnd() * 80, r: big ? 5 + rnd() * 9 : 1.3 + rnd() * 2.2, big: big, ph: rnd() * 6.283, dr: (rnd() - 0.5) * 26, al: big ? 0.2 + rnd() * 0.2 : 0.55 + rnd() * 0.4 }); }
    var draw = function (t) {
      ctx.clearRect(0, 0, Wc, Hc);
      if (t <= de || t >= ate) return;
      var env = Math.min(1, (t - de) / 1.2, (ate - t) / 0.8);
      ctx.globalCompositeOperation = "lighter";
      for (var i = 0; i < P.length; i++) {
        var p = P[i];
        var y = Hc + 80 - ((p.y0 + p.v * (t - de)) % L);            // sobe e recomeça embaixo
        var x = p.x + Math.sin(p.ph + t * 0.6) * p.dr;
        var edge = Math.max(0, Math.min(1, y / 90, (Hc - 40 - y) / 160)); // some antes de chegar no cabelo do Hugo
        var A = p.al * env * edge * (0.65 + 0.35 * Math.sin(p.ph * 3 + t * 2.4));
        if (A < 0.01) continue;
        if (p.big) {
          var g = ctx.createRadialGradient(x, y, 0, x, y, p.r);
          g.addColorStop(0, "rgba(110,185,255," + A + ")"); g.addColorStop(1, "rgba(40,124,255,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
        } else {
          ctx.fillStyle = "rgba(90,200,255," + (A * 0.22) + ")"; ctx.beginPath(); ctx.arc(x, y, p.r * 3, 0, 6.283); ctx.fill();
          ctx.fillStyle = "rgba(205,240,255," + A + ")"; ctx.beginPath(); ctx.arc(x, y, p.r, 0, 6.283); ctx.fill();
        }
      }
    };
    var o = { t: 0 };
    tl.fromTo(o, { t: 0 }, { t: DUR, duration: DUR, ease: "none", onUpdate: function () { draw(o.t); } }, 0);
    draw(0);
  });
  // ── peças novas ──
  // notif (native-notification-pop): mola subamortecida em forma fechada (posição = função do tempo, seek-safe),
  // pousa em ~0,3 s com ~3% de sobra; depois o círculo e o ✓ se desenham e dão um pulso
  q(".notif").forEach(function (el) {
    var t0 = at(el), nb = el.querySelector(".nb"), OM = 15, ZE = 0.74, OD = OM * Math.sqrt(1 - ZE * ZE), OFF = 620;
    var env = function (t) { return Math.exp(-ZE * OM * t) * (Math.cos(OD * t) + (ZE * OM / OD) * Math.sin(OD * t)); };
    var d = { t: 0 };
    tl.fromTo(nb, { opacity: 0 }, { opacity: 1, duration: 0.01 }, t0);
    tl.fromTo(d, { t: 0 }, { t: 0.9, duration: 0.9, ease: "none", immediateRender: true, onUpdate: function () { gsap.set(nb, { y: -OFF * env(d.t) }); } }, t0);
    var tc = t0 + parseFloat(el.getAttribute("data-check"));
    tl.fromTo(el.querySelector(".nck"), { opacity: 0 }, { opacity: 1, duration: 0.01 }, tc);   // a ponta redonda do traço não aparece antes da hora
    tl.fromTo(el.querySelector(".nck circle"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45, ease: "power2.out" }, tc);
    tl.fromTo(el.querySelector(".nck path"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.32, ease: "power2.out" }, tc + 0.3);
    tl.fromTo(el.querySelector(".nck"), { scale: 1 }, { scale: 1.14, duration: 0.14, ease: "power2.out", yoyo: true, repeat: 1 }, tc + 0.62);
  });
  // lista (grid-card-assemble): cada card sobe e assenta no nome falado, o ícone entra com mola,
  // a borda em gradiente acende no card novo e passa para o próximo
  q(".lista").forEach(function (ls) {
    var cards = ls.querySelectorAll(".lc");
    cards.forEach(function (lc, i) {
      var t = at(lc), on = lc.querySelector(".lon");
      tl.fromTo(lc, { opacity: 0, y: 34, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "power3.out" }, t);
      tl.fromTo(lc.querySelector(".lic"), { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.9)" }, t + 0.12);
      tl.fromTo(on, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power2.out" }, t + 0.15);
      var prox = cards[i + 1];
      if (prox) tl.to(on, { opacity: 0, duration: 0.35, ease: "power2.inOut" }, at(prox) + 0.1);
      var img = lc.querySelector(".lic img"), ini = t + 0.8, voltas = Math.max(0, Math.floor((DUR - 0.6 - ini) / 1.3));
      if (voltas > 0) tl.fromTo(img, { y: 0 }, { y: -7, duration: 1.3, ease: "sine.inOut", yoyo: true, repeat: voltas - 1 + (voltas % 2) }, ini + i * 0.2);
    });
  });
  // dinheiro (apple-money-count): conta em branco, aterrissa no verde de resultado com pulso, brilho e
  // os ícones da campanha saltando em espiral áurea (posições fixas, sem aleatório)
  q(".dinheiro").forEach(function (el, n) {
    var t0 = at(el), de = parseFloat(el.getAttribute("data-de")), ate = parseFloat(el.getAttribute("data-ate")), dur = parseFloat(el.getAttribute("data-dur"));
    var pre = el.getAttribute("data-pre"), suf = el.getAttribute("data-suf"), camp = el.getAttribute("data-camp"), icos = el.getAttribute("data-icos").split(",");
    var w = el.querySelector(".dw"), l = el.querySelector(".dl"), box = el.querySelector(".dnum"), glow = el.querySelector(".dglow"), burst = el.querySelector(".dburst");
    var fmt = function (v) { return pre + Math.round(v).toLocaleString("pt-BR") + suf; };
    var o = { v: de }, land = t0 + dur;
    tl.fromTo(box, { opacity: 0, y: 26, scale: 0.985 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "power2.out" }, t0);
    tl.fromTo(o, { v: de }, { v: ate, duration: dur, ease: "power1.in", onUpdate: function () { w.textContent = l.textContent = fmt(o.v); } }, t0);
    tl.fromTo(l, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: "none" }, land);
    tl.fromTo(w, { opacity: 1 }, { opacity: 0, duration: 0.18, ease: "none" }, land);
    tl.to(box, { scale: 1.08, duration: 0.16, ease: "back.out(2.2)" }, land);
    tl.to(box, { scale: 1, duration: 0.25, ease: "power2.out" }, land + 0.17);
    tl.fromTo(glow, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1.05, duration: 0.12, ease: "none" }, land);
    tl.to(glow, { opacity: 0.45, scale: 1, duration: 0.8, ease: "power1.out" }, land + 0.12);
    // anel ao redor do número (atrás dele) e saída para fora e para cima: nada cobre o valor nem desce no rosto
    var NB = 18;
    for (var i = 0; i < NB; i++) {
      var img = document.createElement("img"), nome = icos[i % icos.length];
      img.src = camp + "/" + nome + ".png"; img.style.height = (nome === "moeda" ? 70 + (i % 3) * 8 : 84 + (i % 3) * 10) + "px";
      burst.appendChild(img);
      // arco de cima e dos lados (de 153° a 387°): nenhum ícone fica embaixo do número nem sobre a legenda
      var ang = Math.PI * (0.85 + 1.3 * i / (NB - 1)) + (i % 3) * 0.05, rx = 470 + (i % 3) * 34, ry = 175 + (i % 3) * 24;
      var x = Math.cos(ang) * rx, y = Math.min(70, Math.sin(ang) * ry);
      var dl = (i % 6) * 0.03, rot = ((i * 43) % 120) - 60;
      tl.fromTo(img, { x: 0, y: 0, xPercent: -50, yPercent: -50, scale: 0.2, opacity: 0, rotation: 0 },
        { x: x, y: y, scale: 1, opacity: 1, rotation: rot, duration: 0.74 + (i % 5) * 0.045, ease: "power4.out" }, land + 0.08 + dl);
      tl.to(img, { x: x * 1.22, y: y * 1.22 - 50, scale: 0.6, opacity: 0, duration: 0.55, ease: "power2.in" }, land + 1.1 + (i % 5) * 0.06);
    }
  });
  var Q3 = 1 / 30, tranco = function (alvo, t) {   // tremor de 3 quadros no pouso (o mesmo do headline-slam)
    tl.to(alvo, { x: 7, y: -4, duration: Q3, ease: "power2.out" }, t);
    tl.to(alvo, { x: -5, y: 3, duration: Q3, ease: "power2.out" }, t + Q3);
    tl.to(alvo, { x: 0, y: 0, duration: Q3, ease: "power2.out" }, t + 2 * Q3);
  };
  // checklist: o card entra com as linhas apagadas; cada uma acende e ganha o ✓ no nome falado; o selo é carimbado
  q(".ckl").forEach(function (el) {
    var t0 = at(el), card = el.querySelector(".ckc");
    tl.fromTo(card, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, t0);
    el.querySelectorAll(".ckr").forEach(function (r) {
      var t = at(r);
      tl.fromTo(r, { opacity: 0.35 }, { opacity: 1, duration: 0.3, ease: "power2.out" }, t - 0.1);
      tl.fromTo(r.querySelector(".v"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.3, ease: "power2.out" }, t - 0.05);
      tl.fromTo(r.querySelector("path"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.28, ease: "power2.out" }, t + 0.2);
    });
    var s = el.querySelector(".cks");
    if (s) {
      var ts = at(s);
      tl.fromTo(s, { opacity: 0, scale: 2.3, rotation: -18 }, { opacity: 1, scale: 1, rotation: -9, duration: 0.3, ease: "power4.in" }, ts);
      tranco(card, ts + 0.3);
    }
  });
  // preco: a etiqueta entra; a cada passo o valor cai 1 centavo, pula de leve e pisca no vermelho (função do tempo, seek-safe)
  q(".preco").forEach(function (el) {
    var t0 = at(el), de = parseFloat(el.getAttribute("data-de")), n = parseInt(el.getAttribute("data-n"), 10), dt = parseFloat(el.getAttribute("data-dt"));
    var ini = t0 + parseFloat(el.getAttribute("data-ini")), pv = el.querySelector(".pv"), tag = el.querySelector(".ptag");
    var fmt = function (c) { return "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    tl.fromTo(tag, { opacity: 0, y: 26, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "power3.out" }, t0);
    var o = { k: 0 };
    tl.fromTo(o, { k: 0 }, { k: n + 0.999, duration: (n + 1) * dt, ease: "none", onUpdate: function () {
      var i = Math.min(n, Math.floor(o.k)), b = i > 0 ? Math.pow(1 - Math.min(1, (o.k - i) * 1.4), 3) : 0;
      pv.textContent = fmt(de - i);
      var c = function (x, y) { return Math.round(x + (y - x) * b); };
      gsap.set(pv, { y: -16 * b, scale: 1 + 0.05 * b, color: "rgb(" + c(246, 255) + "," + c(250, 92) + "," + c(254, 92) + ")" });
    } }, ini);
  });
  // trilho: o trilho aparece; na etapa inicial a ponta acende e o feixe corre até a final, acendendo as marcas no caminho
  q(".trilho").forEach(function (el) {
    var t0 = at(el), A = t0 + parseFloat(el.getAttribute("data-a")), B = t0 + parseFloat(el.getAttribute("data-b")), D = Math.max(0.3, B - A);
    tl.fromTo(el.querySelector(".ttr"), { opacity: 0, scaleX: 0.9 }, { opacity: 1, scaleX: 1, duration: 0.5, ease: "power3.out" }, t0);
    tl.fromTo(el.querySelector(".tl0"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, A - 0.2);
    tl.fromTo(el.querySelector(".t0 b"), { opacity: 0 }, { opacity: 1, duration: 0.2 }, A);
    tl.fromTo(el.querySelector(".t0"), { scale: 1 }, { scale: 1.2, duration: 0.14, ease: "power2.out", yoyo: true, repeat: 1 }, A);
    tl.fromTo(el.querySelector(".tfill"), { scaleX: 0 }, { scaleX: 1, duration: D, ease: "power1.inOut" }, A);
    var dot = el.querySelector(".tdot");
    tl.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.12 }, A);
    tl.fromTo(dot, { left: "0%" }, { left: "100%", duration: D, ease: "power1.inOut" }, A);
    tl.to(dot, { opacity: 0, scale: 2, duration: 0.3, ease: "power2.out" }, B);
    el.querySelectorAll(".tmk").forEach(function (mk) {
      var f = parseFloat(mk.getAttribute("data-f")), u = f < 0.5 ? Math.sqrt(f / 2) : 1 - Math.sqrt((1 - f) / 2);   // inverso do power1.inOut: o feixe passa pela marca nesse instante
      tl.to(mk, { backgroundColor: "#F6FAFE", borderColor: "#FFFFFF", duration: 0.15 }, A + D * u);
    });
    tl.fromTo(el.querySelector(".tl1"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, B - 0.15);
    tl.fromTo(el.querySelector(".t1 b"), { opacity: 0 }, { opacity: 1, duration: 0.2 }, B);
    tl.fromTo(el.querySelector(".t1"), { scale: 1 }, { scale: 1.25, duration: 0.16, ease: "power2.out", yoyo: true, repeat: 1 }, B);
  });
  // hub: o produto entra com mola; cada linha desenha do centro até o caminho com um ponto de luz na ponta (curva calculada, sem medir o SVG)
  q(".hub").forEach(function (el) {
    var t0 = at(el);
    tl.fromTo(el.querySelector(".hc"), { xPercent: -50, yPercent: -50, opacity: 0, scale: 0.6 }, { xPercent: -50, yPercent: -50, opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.7)" }, t0);
    var dots = el.querySelectorAll(".hdot"), nos = el.querySelectorAll(".hn");
    el.querySelectorAll(".hp").forEach(function (p, i) {
      var t = at(p), c = p.getAttribute("data-c").split(",").map(parseFloat), dot = dots[i], o = { u: 0 };
      var bz = function (u, a0, a1, a2, a3) { var v = 1 - u; return v * v * v * a0 + 3 * v * v * u * a1 + 3 * v * u * u * a2 + u * u * u * a3; };
      tl.fromTo(p, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.55, ease: "power2.inOut" }, t);
      tl.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.05 }, t);
      tl.fromTo(o, { u: 0 }, { u: 1, duration: 0.55, ease: "power2.inOut", immediateRender: true, onUpdate: function () {
        gsap.set(dot, { x: bz(o.u, c[0], c[2], c[4], c[6]), y: bz(o.u, c[1], c[3], c[5], c[7]) });
      } }, t);
      tl.to(dot, { opacity: 0, scale: 2.4, duration: 0.3, ease: "power2.out" }, t + 0.55);
      if (nos[i]) tl.fromTo(nos[i], { yPercent: -50, opacity: 0, x: -24, scale: 0.9 }, { yPercent: -50, opacity: 1, x: 0, scale: 1, duration: 0.45, ease: "back.out(1.6)" }, at(nos[i]));
    });
  });
  // cartao: pousa de cima com tranco contido; um reflexo diagonal atravessa uma vez
  q(".cartao").forEach(function (el) {
    var t0 = at(el), cc = el.querySelector(".cc");
    tl.fromTo(cc, { opacity: 0, scale: 1.14, y: -16 }, { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "power3.in" }, t0);
    tranco(cc, t0 + 0.3);
    tl.fromTo(el.querySelector(".ccg"), { xPercent: -150, skewX: -20 }, { xPercent: 640, skewX: -20, duration: 0.9, ease: "power2.inOut" }, t0 + 0.5);
  });
  // ctatoque: o toque chega, aperta o botão (que afunda e volta com mola), solta uma onda e sai
  q(".ctt").forEach(function (el) {
    var tt = at(el) + parseFloat(el.getAttribute("data-tap")), tap = el.querySelector(".tap"), rip = el.querySelector(".rip"), btn = el.querySelector(".btn");
    tl.fromTo(tap, { opacity: 0, x: 170, y: 210, scale: 1 }, { opacity: 1, x: 0, y: 0, duration: 0.5, ease: "power3.out" }, tt - 0.55);
    tl.to(tap, { scale: 0.8, duration: 0.1, ease: "power2.in" }, tt);
    tl.to(btn, { scale: 0.94, duration: 0.1, ease: "power2.in" }, tt);
    tl.to(btn, { scale: 1, duration: 0.4, ease: "back.out(2.6)" }, tt + 0.1);
    tl.to(tap, { scale: 1, duration: 0.2, ease: "power2.out" }, tt + 0.1);
    tl.fromTo(rip, { opacity: 0.85, scale: 0.3 }, { opacity: 0, scale: 2.6, duration: 0.65, ease: "power2.out" }, tt + 0.05);
    tl.to(tap, { opacity: 0, x: 70, y: 80, duration: 0.4, ease: "power2.in" }, tt + 0.55);
  });
  // celular: sobe inclinado e assenta com mola (forma fechada, seek-safe), flutua, um reflexo passa; sai caindo (physical-exit)
  q(".celular").forEach(function (el) {
    var t0 = at(el), fim = parseFloat(el.getAttribute("data-fim")), esc = parseFloat(el.getAttribute("data-esc"));
    var fone = el.querySelector(".cfone"), dim = el.querySelector(".cdim");
    var OM = 9.5, ZE = 0.62, OD = OM * Math.sqrt(1 - ZE * ZE);
    var env = function (t) { return Math.exp(-ZE * OM * t) * (Math.cos(OD * t) + (ZE * OM / OD) * Math.sin(OD * t)); };
    var d = { t: 0 }, ENT = 1.3;
    gsap.set(fone, { xPercent: -50, y: 760, rotationX: 22, rotationY: -16, rotationZ: -4, scale: 0.88 });
    tl.fromTo(fone, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none" }, t0);
    tl.fromTo(d, { t: 0 }, { t: ENT, duration: ENT, ease: "none", immediateRender: true, onUpdate: function () {
      var k = env(d.t);
      gsap.set(fone, { xPercent: -50, y: 760 * k, rotationX: 22 * k, rotationY: -16 * k, rotationZ: -4 * k, scale: 1 - 0.12 * k });
    } }, t0);
    var flut = Math.max(0, fim - 0.7 - (t0 + ENT)), voltas = Math.floor(flut / 1.6), par = voltas - (voltas % 2);   // nº par: termina em repouso antes da saída
    if (par > 0) tl.fromTo(fone, { y: 0, rotationY: 0 }, { y: -10, rotationY: 2.5, duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: par - 1 }, t0 + ENT);
    tl.fromTo(el.querySelector(".cgloss"), { xPercent: -140, skewX: -18 }, { xPercent: 520, skewX: -18, duration: 1.0, ease: "power2.inOut" }, t0 + 0.9);
    if (dim) {
      tl.fromTo(dim, { opacity: 0 }, { opacity: esc / 0.92, duration: 0.45, ease: "power2.out" }, t0);
      tl.to(dim, { opacity: 0, duration: 0.45, ease: "power2.in" }, fim - 0.45);
    }
    tl.to(fone, { y: 260, rotationX: -14, rotationZ: 6, opacity: 0, duration: 0.55, ease: "power3.in" }, fim - 0.6);
  });
  tl.to(R.querySelector(".band"), { opacity: 0, y: -24, duration: 0.45, ease: "power2.in" }, DUR - 0.55);
  window.__timelines[ID] = tl;
  };
  // carrega explicitamente as fontes medidas (cenas ocultas não disparam o download sozinhas)
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load("700 100px Sora"), document.fonts.load('200 100px "Sora Var"'), document.fonts.load('800 100px "Plus Jakarta Sans"')]).then(function () { return document.fonts.ready; }).then(monta, monta);
  else monta();
})(__ID__, __DUR__);
`;

function sceneFile(s) {
  const phases = s.fases.map((ph, pi) => {
    const next = s.fases[pi + 1];
    let t = ph.at;
    const els = ph.els.map((e, ei) => {
      const at = ph.at + (e.d != null ? e.d : ei * 0.15);
      t = Math.max(t, at);
      return elHTML(e, at);
    }).join("\n          ");
    const out = next ? ` data-out="${(next.at - 0.35).toFixed(2)}"` : "";
    return `<div class="phase${s.topo ? " sob" : ""}" data-at="${ph.at}"${out}${ph.slow ? ' data-slow="1"' : ""}>
          ${s.topo || s.barra === false ? "" : '<i class="accent"></i>'}
          ${els}
        </div>`;
  }).join("\n        ");
  const id = `cena-${s.id.toLowerCase()}`;
  return `<!doctype html>
<html lang="pt-BR">
  <head><meta charset="UTF-8" /></head>
  <body>
    <template>
      <link rel="stylesheet" href="assets/tokens.css" />
      <style>${CSS.replace("__ROOT__", "#r-" + id)}</style>
      <!-- ${s.id} · ${esc(s.nome)} · ${s.dur} s — gerado por build.mjs a partir de plano-de-cenas.md -->
      <div id="r-${id}" data-composition-id="${id}" data-width="${W}" data-height="${H}">
        <div class="band${s.fx === false ? "" : " fx"}">
        ${s.poeira ? `<canvas class="dust" width="${W}" height="600" data-de="${s.poeira[0]}" data-ate="${s.poeira[1]}" data-seed="${[...s.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)}"></canvas>` : ""}
        ${s.topo ? `<div class="topo"><i class="accent"></i><div class="kicker hf-tracking-in">${esc(s.topo)}</div></div>` : ""}
        ${phases}
        </div>
      </div>
      <script>${RUNTIME.replace("__ID__", JSON.stringify(id)).replace("__DUR__", String(s.dur))}</script>
    </template>
  </body>
</html>
`;
}

// ───────────────────────── reel (index.html) e lista ─────────────────────────
fs.mkdirSync(path.join(pasta, "compositions"), { recursive: true });
for (const f of fs.readdirSync(path.join(pasta, "compositions"))) if (f.startsWith("cena-")) fs.unlinkSync(path.join(pasta, "compositions", f));
let t = 0;
const hosts = [], tags = [], lista = [];
const SO = so;   // só essas cenas no reel (render por partes / teste)
for (const s of cenas) {
  const id = `cena-${s.id.toLowerCase()}`;
  fs.writeFileSync(path.join(pasta, "compositions", `${id}.html`), sceneFile(s));
  if (SO && !SO.includes(s.id)) continue;
  hosts.push(`      <div id="h-${id}" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${t.toFixed(2)}" data-duration="${s.dur}" data-track-index="1" data-width="${W}" data-height="${H}"></div>`);
  tags.push(`      <div id="tag-${id}" class="tag clip" data-start="${t.toFixed(2)}" data-duration="${s.dur}" data-track-index="2">${s.id} · ${esc(s.nome)}</div>`);
  lista.push({ id: s.id, nome: s.nome, inicio: +t.toFixed(2), dur: s.dur });
  t += s.dur + GAP;
}
const total = +(t - GAP).toFixed(2);
fs.writeFileSync(path.join(pasta, "index.html"), `<!doctype html>
<html lang="pt-BR" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="vendor/gsap.min.js"></script>
    <!-- efeito do registry adaptado (cursor-annotate) — ver fx/ -->
    <script src="fx/hw-pen.js"></script>
    <link rel="stylesheet" href="assets/tokens.css" />
    <style>
      html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: transparent; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; }
      #fundo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .tag { position: absolute; left: 24px; bottom: 24px; font: 600 24px var(--font-body); color: rgba(255,255,255,.7); background: rgba(0,0,0,.45); padding: 6px 12px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <!-- Reel de revisão: as ${cenas.length} cenas em sequência sobre o quadro de referência do Hugo.
         Trilha 0 = referência (só revisão) · Trilha 1 = cenas · Trilha 2 = etiquetas (só revisão) -->
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}">
      <img id="fundo" class="clip" src="referencia-enquadramento.png" data-start="0" data-duration="${total}" data-track-index="0" alt="" />
${hosts.join("\n")}
${tags.join("\n")}
    </div>
    <script>window.__timelines["main"] = gsap.timeline({ paused: true });</script>
  </body>
</html>
`);
fs.writeFileSync(path.join(pasta, SO ? "cenas-teste.json" : "cenas.json"), JSON.stringify({ total, cenas: lista }, null, 1));
return { total, lista };

}
