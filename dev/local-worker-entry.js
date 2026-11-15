// KUN TIL DET LOKALE TESTMILJØ: Worker-indgang for dev/local-server.mjs.
//
// Omslutter den eksisterende web-draft-Worker uændret og tilføjer et valg af kampmotor:
//   /dev/motor11  – nye 3D-kampe i dette testmiljø bruger kampmotor 11 (cookie)
//   /dev/motor10  – tilbage til den normale motor 10
//   /dev/status   – viser den valgte motor (JSON)
// Valget virker kun her: produktionsbygningen (build.mjs) indeholder ikke denne fil,
// og produktionsserveren giver fortsat motor 10, uanset hvad appen beder om.
import draft from '../worker/web-draft.js';
import { LOCAL_TEST_ENGINE_VERSIONS, matchVersionInfo } from '../shared/engine-versions.js';

export const LOCAL_ENGINE11_ADAPTER = 'touchline-local-engine11-adapter';
export const ENGINE_COOKIE = 'touchline-dev-engine';

function selectedEngine(request) {
  const cookie = request.headers.get('Cookie') || '';
  return /(?:^|;\s*)touchline-dev-engine=11(?:;|$)/.test(cookie) ? 11 : 10;
}

function page(engine) {
  const name = engine === 11 ? 'kampmotor 11 (udvikling)' : 'kampmotor 10 (normal)';
  return `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Touchline testmiljø</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b141d;color:#e8edf2;font:16px system-ui,sans-serif}main{max-width:440px;padding:24px}a{display:block;margin:12px 0;padding:14px;border-radius:10px;background:#b6e33a;color:#0b141d;text-align:center;font-weight:700;text-decoration:none}a.alt{background:#1d2a36;color:#e8edf2}small{color:#9fb0c0}</style></head>
<body><main><h1>Touchline testmiljø</h1><p>Nye 3D-kampe bruger nu <b>${name}</b>.</p>
<a href="/play">Åbn spillet</a><a class="alt" href="${engine === 11 ? '/dev/motor10' : '/dev/motor11'}">Skift til ${engine === 11 ? 'motor 10' : 'motor 11'}</a>
<small>Kun lokalt testmiljø med fiktive testkonti. Påvirker ikke produktionen. En igangværende kamp beholder sin motor.</small></main></body></html>`;
}

export default {
  async fetch(request, env, context) {
    if (!LOCAL_TEST_ENGINE_VERSIONS) throw new Error('Testadapteren skal bygges med de lokale versionsregler.');
    const url = new URL(request.url);
    if (url.pathname === '/dev/motor11' || url.pathname === '/dev/motor10') {
      const engine = url.pathname.endsWith('11') ? 11 : 10;
      return new Response(page(engine), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Set-Cookie': `${ENGINE_COOKIE}=${engine}; Path=/; SameSite=Lax; Max-Age=2592000`,
        },
      });
    }
    if (url.pathname === '/dev/status') {
      return Response.json({ engine: selectedEngine(request), matchVersions: matchVersionInfo(), adapter: LOCAL_ENGINE11_ADAPTER }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (url.pathname === '/api/game' && request.method === 'POST' && selectedEngine(request) === 11) {
      const text = await request.text();
      let body = null;
      try { body = JSON.parse(text); } catch {}
      const headers = new Headers(request.headers);
      headers.delete('Content-Length');
      // Kun starten af en ny 3D-kamp ændres; alle andre handlinger sendes uændret videre.
      const next = body && typeof body === 'object' && body.control === 'manual' ? JSON.stringify({ ...body, manualVersion: 11 }) : text;
      const response = await draft.fetch(new Request(request.url, { method: 'POST', headers, body: next }), env, context);
      const copy = new Response(response.body, response);
      copy.headers.set('X-Touchline-Dev-Engine', '11');
      return copy;
    }
    return draft.fetch(request, env, context);
  },
};
