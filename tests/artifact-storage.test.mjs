import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { artifactKey, MAX_APK_BYTES, privateApkUploadRoute, storedApkResponse } from '../worker/artifact-storage.js';
import { privateApkRoute } from '../worker/private-download.js';

const bytes = Uint8Array.from({ length: 257 }, (_, i) => i % 256);
const digest = value => createHash('sha256').update(value).digest('hex');
const token = 'A'.repeat(43), now = Date.UTC(2026, 10, 12);
const artifact = { versionCode: 24, sha256: digest(bytes) };
const grant = {
  tokenHash: digest(token), issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + 86400000).toISOString(),
  fileName: 'Touchline-1.0.0-24.apk', versionCode: 24, sha256: artifact.sha256, bytes: bytes.length,
};
const url = (name = 'upload.apk', key = token) => new URL(`https://site.test/owner-builds/${key}/${name}`);

// Implements the R2 contract used here, including immutable conditional writes
// and the full object's size on a ranged get, without exposing public URLs.
class Bucket {
  objects = new Map();
  reads = [];
  writes = [];
  async put(key, value, options) {
    this.writes.push({ key, options });
    assert.deepEqual(options.onlyIf, { etagDoesNotMatch: '*' });
    assert.equal(digest(new Uint8Array(value)), Buffer.from(options.sha256).toString('hex'));
    if (this.objects.has(key)) return null;
    const data = new Uint8Array(value).slice();
    const object = { data, size: data.length, customMetadata: { ...options.customMetadata } };
    this.objects.set(key, object);
    return { ...object };
  }
  async head(key) {
    this.reads.push({ method: 'head', key });
    const object = this.objects.get(key);
    return object ? { size: object.size, customMetadata: object.customMetadata } : null;
  }
  async get(key, options) {
    this.reads.push({ method: 'get', key, options });
    const object = this.objects.get(key);
    if (!object) return null;
    const data = options?.range ? object.data.slice(options.range.offset, options.range.offset + options.range.length) : object.data;
    return { size: object.size, customMetadata: object.customMetadata, body: new ReadableStream({ start(controller) { controller.enqueue(data); controller.close(); } }) };
  }
}
async function upload({ bucket = new Bucket(), method = 'PUT', key = token, name = 'upload.apk', body = bytes, headers = {}, at = now, settings = grant, meta = artifact } = {}) {
  const u = url(name, key);
  const request = new Request(u, { method, headers, ...(['GET', 'HEAD'].includes(method) ? {} : { body, duplex: 'half' }) });
  return { bucket, response: await privateApkUploadRoute(request, u, bucket, meta, settings, at) };
}
async function download(bucket, { method = 'GET', headers = {}, settings = grant, meta = artifact, at = now, key = token } = {}) {
  const u = url(settings?.fileName ?? grant.fileName, key);
  return privateApkRoute(new Request(u, { method, headers }), u, bucket, meta, settings, at);
}

test('authenticated upload stores only the approved APK under an immutable content-addressed key', async () => {
  const { bucket, response } = await upload({ headers: { 'Content-Length': String(bytes.length) } });
  assert.equal(response.status, 201);
  assert.match(response.headers.get('Cache-Control'), /private, no-store/);
  assert.match(response.headers.get('X-Robots-Tag'), /noindex/);
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(await response.text(), '');
  assert.equal(bucket.objects.size, 1);
  const key = `releases/${artifact.sha256}/${grant.fileName}`;
  assert.equal(artifactKey(artifact, grant.fileName), key);
  assert.deepEqual(bucket.objects.get(key).data, bytes);
  assert.deepEqual(bucket.objects.get(key).customMetadata, { sha256: artifact.sha256, bytes: '257', versionCode: '24' });
  assert.equal(bucket.writes[0].options.httpMetadata.contentType, 'application/vnd.android.package-archive');
  assert.equal(response.headers.get('Location'), null);
});

test('uploads share the existing exact token, build and 24-hour expiry checks before touching storage', async () => {
  for (const args of [
    { key: 'B'.repeat(43) }, { key: token.slice(1) }, { name: 'upload.apk/extra' },
    { at: now - 1 }, { at: now + 86400000 }, { at: NaN },
    { settings: { ...grant, expiresAt: 'bad' } }, { settings: { ...grant, expiresAt: new Date(now + 86400001).toISOString() } },
    { settings: { ...grant, tokenHash: 'bad' } }, { settings: null },
    { settings: { ...grant, fileName: '../other.apk' } }, { meta: null },
    { meta: { ...artifact, versionCode: 25 } }, { meta: { ...artifact, sha256: 'b'.repeat(64) } },
    { meta: { ...artifact, bytes: bytes.length + 1 } },
  ]) {
    const { bucket, response } = await upload(args);
    assert.equal(response.status, 404, JSON.stringify(args));
    assert.equal(bucket.writes.length, 0);
    assert.equal(bucket.reads.length, 0);
  }
  assert.equal((await upload({ at: now + 86399999 })).response.status, 201);
});

test('upload rejects unsupported methods, declared/body length mismatches and checksum changes without writes', async () => {
  for (const method of ['GET', 'HEAD', 'POST', 'DELETE']) {
    const { bucket, response } = await upload({ method });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'PUT');
    assert.equal(bucket.writes.length, 0);
    assert.equal((await upload({ method, key: 'B'.repeat(43) })).response.status, 404);
  }
  for (const args of [
    { headers: { 'Content-Length': '256' } }, { headers: { 'Content-Length': '258' } },
    { headers: { 'Content-Length': 'invalid' } }, { body: bytes.slice(1) },
    { body: new Uint8Array(258) }, { body: null },
  ]) {
    const { bucket, response } = await upload(args);
    assert.equal(response.status, 400, JSON.stringify(args));
    assert.equal(bucket.writes.length, 0);
  }
  const changed = bytes.slice(); changed[0] ^= 1;
  const result = await upload({ body: changed });
  assert.equal(result.response.status, 422);
  assert.equal(result.bucket.writes.length, 0);
});

test('upload enforces the 32 MiB cap and bounds streamed bodies before hashing or writing', async () => {
  assert.equal(MAX_APK_BYTES, 33554432);
  for (const size of [0, -1, 1.5, NaN, MAX_APK_BYTES + 1]) {
    const { bucket, response } = await upload({ settings: { ...grant, bytes: size } });
    assert.equal(response.status, 404);
    assert.equal(bucket.writes.length, 0);
  }
  assert.equal((await upload({ headers: { 'Content-Length': String(MAX_APK_BYTES + 1) } })).response.status, 413);
  let cancelled = false, pulls = 0;
  const body = new ReadableStream({
    pull(controller) { pulls++; controller.enqueue(new Uint8Array(258)); },
    cancel() { cancelled = true; },
  });
  const { bucket, response } = await upload({ body });
  assert.equal(response.status, 400);
  assert.equal(cancelled, true);
  assert(pulls <= 2);
  assert.equal(bucket.writes.length, 0);
});

test('chunked upload completes validation before the only storage write, and retries never overwrite', async () => {
  let finished = false;
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(bytes.slice(0, 7)); controller.enqueue(bytes.slice(7, 201)); controller.enqueue(bytes.slice(201));
    finished = true; controller.close();
  } });
  const bucket = new Bucket(), originalPut = bucket.put.bind(bucket);
  bucket.put = (...args) => { assert.equal(finished, true); return originalPut(...args); };
  assert.equal((await upload({ body, bucket })).response.status, 201);
  const original = bucket.objects.get(artifactKey(artifact, grant.fileName));
  assert.equal((await upload({ bucket })).response.status, 204);
  assert.equal(bucket.objects.get(artifactKey(artifact, grant.fileName)), original);
  original.customMetadata.sha256 = 'b'.repeat(64);
  assert.equal((await upload({ bucket })).response.status, 409);
  assert.equal(bucket.objects.get(artifactKey(artifact, grant.fileName)), original);
});

test('owner R2 downloads stream exact bytes with existing private headers, HEAD, ranges and authorization', async () => {
  const { bucket } = await upload();
  const full = await download(bucket);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('Content-Type'), 'application/vnd.android.package-archive');
  assert.equal(full.headers.get('Content-Disposition'), `attachment; filename="${grant.fileName}"`);
  assert.equal(full.headers.get('Content-Length'), '257');
  assert.equal(full.headers.get('ETag'), `"${artifact.sha256}"`);
  assert.match(full.headers.get('Cache-Control'), /private, no-store/);
  assert.deepEqual(new Uint8Array(await full.arrayBuffer()), bytes);
  const head = await download(bucket, { method: 'HEAD', headers: { Range: 'bytes=invalid' } });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('Content-Length'), '257');
  assert.equal(await head.text(), '');
  assert.equal(bucket.reads.at(-1).method, 'head');
  for (const [range, start, end] of [['bytes=0-15', 0, 15], ['bytes=240-', 240, 256], ['bytes=-12', 245, 256], ['bytes=250-999', 250, 256], ['bytes=-999', 0, 256]]) {
    const response = await download(bucket, { headers: { Range: range } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('Content-Range'), `bytes ${start}-${end}/257`);
    assert.equal(response.headers.get('Content-Length'), String(end - start + 1));
    assert.deepEqual(bucket.reads.at(-1).options, { range: { offset: start, length: end - start + 1 } });
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes.slice(start, end + 1));
  }
  for (const args of [{ key: 'B'.repeat(43) }, { at: now + 86400000 }, { meta: { ...artifact, versionCode: 25 } }]) {
    const before = bucket.reads.length;
    assert.equal((await download(bucket, args)).status, 404);
    assert.equal(bucket.reads.length, before);
  }
});

test('R2 downloads fail closed for absent, truncated or mismatched objects and invalid ranges', async () => {
  const empty = new Bucket();
  assert.equal((await download(empty)).status, 404);
  for (const change of [object => { object.size--; }, object => { object.customMetadata.sha256 = 'b'.repeat(64); }, object => { object.customMetadata = {}; }]) {
    const { bucket } = await upload();
    change(bucket.objects.get(artifactKey(artifact, grant.fileName)));
    assert.equal((await download(bucket)).status, 404);
    assert.equal((await download(bucket, { method: 'HEAD' })).status, 404);
  }
  const { bucket } = await upload();
  for (const range of ['bytes=257-', 'bytes=10-1', 'bytes=-0', 'bytes=-', 'bytes=0-1,4-5', 'bytes=abc', 'items=0-2', 'bytes=9007199254740992-']) {
    const response = await download(bucket, { headers: { Range: range } });
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get('Content-Range'), 'bytes */257');
  }
  const before = bucket.reads.length;
  assert.equal((await download(bucket, { method: 'PUT' })).status, 405);
  assert.equal(bucket.reads.length, before);
});

test('public helper streams the same private object with a public download filename when its caller opens the gate', async () => {
  const { bucket } = await upload();
  const meta = { ...artifact, bytes: grant.bytes };
  const request = new Request('https://site.test/downloads/touchline.apk');
  const response = await storedApkResponse(request, bucket, meta, grant.fileName, {
    downloadFileName: 'Touchline-1.0.0.apk', headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Disposition'), 'attachment; filename="Touchline-1.0.0.apk"');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  for (const fileName of ['../secret.apk', 'releases/other.apk', 'Touchline-1.0.0.apk\r\nInjected: yes']) {
    assert.equal(artifactKey(artifact, fileName), null);
    assert.equal((await storedApkResponse(request, bucket, meta, fileName)).status, 404);
  }
});

test('upload route leaves downloads and public paths untouched, and storage outages do not mutate release objects', async () => {
  const bucket = new Bucket();
  for (const path of ['/', '/play', '/downloads/touchline.apk', '/api/game', `/owner-builds/${token}/${grant.fileName}`]) {
    const u = new URL('https://site.test' + path);
    assert.equal(await privateApkUploadRoute(new Request(u), u, bucket, artifact, grant, now), null);
  }
  assert.equal(bucket.writes.length, 0);
  assert.equal((await upload({ bucket: null })).response.status, 503);
  assert.equal((await upload({ bucket: { head() {}, put() { throw Error('offline'); } } })).response.status, 503);
  const request = new Request('https://site.test/downloads/touchline.apk');
  assert.equal((await storedApkResponse(request, null, { ...artifact, bytes: grant.bytes }, grant.fileName)).status, 503);
});
