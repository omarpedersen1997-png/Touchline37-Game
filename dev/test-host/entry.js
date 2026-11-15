// Indgang for det særskilte testprojekt. Importeres aldrig af build.mjs.
import testWorker, { isAndroidTestEnvironment } from '../android-test-worker.js';
import {
  assertOnlyTestData, hasTestHostConfiguration, initializeTestDatabase, testDataGuard,
} from './bootstrap.js';

const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

export default {
  async fetch(request, env, context) {
    const path = new URL(request.url).pathname;
    if (!hasTestHostConfiguration(request, env)) {
      return Response.json({ isolated: false, error: 'Testprojektets identitet kunne ikke verificeres.' }, { status: 503, headers: noStore });
    }
    if (path === '/internal/test-initialize') {
      // Slutbygningen afviser også gamle runtimeflag/tokens fra en cached deploy.
      if (typeof __TOUCHLINE_ALLOW_TEST_SETUP__ !== 'undefined' && !__TOUCHLINE_ALLOW_TEST_SETUP__)
        return Response.json({ error: 'Ikke fundet.' }, { status: 404, headers: noStore });
      return initializeTestDatabase(request, env);
    }
    let safe;
    try { safe = await assertOnlyTestData(env.DB); }
    catch { return Response.json({ isolated: false, error: 'Ukendt testdatabase.' }, { status: 503, headers: noStore }); }
    if (path === '/') {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: noStore });
      const ready = safe.initialized && await isAndroidTestEnvironment(env);
      const html = '<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Touchline TEST</title><style>body{margin:0;background:#0b141d;color:#e8edf2;font:17px system-ui;display:grid;min-height:100vh;place-items:center}main{max-width:560px;padding:32px}h1,small{color:#b6e33a}p{line-height:1.6}</style></head><body><main><small>TOUCHLINE · KUN TEST</small><h1>Kampmotor 11</h1><p>' + (ready ? 'Det særskilte testmiljø er klargjort.' : 'Testmiljøet afventer klargøring.') + '</p><p>Brug den separate Android-testapp og en fiktiv testkonto. Dette miljø indeholder ingen produktionskonti.</p></main></body></html>';
      return new Response(request.method === 'HEAD' ? null : html, { headers: {
        ...noStore, 'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      } });
    }
    if (path === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { ...noStore, 'Content-Type': 'text/plain' } });
    // Kun DB og testpepper når normalspillet. Setuphemmeligheder og hostingdata gør ikke.
    return testWorker.fetch(request, {
      DB: testDataGuard(env.DB), AUTH_PEPPER: env.AUTH_PEPPER,
      TOUCHLINE_TEST_ENVIRONMENT: env.TOUCHLINE_TEST_ENVIRONMENT,
    }, context);
  },
};
