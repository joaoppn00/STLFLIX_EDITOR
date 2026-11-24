// Service worker do app STLFLIX EDITOR: não guarda nada (o painel é sempre o do momento).
// Só mostra um aviso amigável quando o app é aberto com o servidor local desligado.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function (e) {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(function () {
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>STLFLIX EDITOR</title>' +
      '<body style="margin:0;display:grid;place-items:center;height:100vh;background:#0d0e14;color:#f6fafe;font:17px/1.6 system-ui,sans-serif;text-align:center">' +
      '<div style="max-width:420px;padding:24px"><img src="/painel/icone-192.png" width="72" height="72" alt="" style="opacity:.9" onerror="this.remove()">' +
      '<h1 style="font-size:22px">O STLFLIX EDITOR está desligado</h1>' +
      '<p style="color:#9a9cab">Feche esta janela e abra pelo ícone <b>STLFLIX EDITOR</b> da área de trabalho ou do menu Iniciar. ' +
      'Ou, numa conversa com o Claude na pasta do kit, peça “Abre o painel”.</p></div></body>',
      { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }));
});
