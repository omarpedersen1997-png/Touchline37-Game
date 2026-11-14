// APK objects stay in the private Sites R2 binding. Only these Worker routes
// can write them or turn an approved object into a download response.
export const MAX_APK_BYTES = 32 * 1024 * 1024;
export const PRIVATE_APK_HEADERS = Object.freeze({
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
});
const apkName = /^Touchline-\d+\.\d+\.\d+(?:-\d+)?\.apk$/;
const sha256 = /^[a-f0-9]{64}$/;
const missing = () => new Response(null, { status: 404, headers: PRIVATE_APK_HEADERS });
const validSize = size => Number.isSafeInteger(size) && size > 0 && size <= MAX_APK_BYTES;
const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');

// The filename is supplied by server metadata, never by an arbitrary URL path.
export function artifactKey(artifact, fileName) {
  return sha256.test(artifact?.sha256 || '') && apkName.test(fileName || '')
    ? `releases/${artifact.sha256}/${fileName}` : null;
}

// Shared by upload and download, so upload cannot outlive or widen the grant.
export async function approvedPrivateGrant(url, artifact, grant, now, fileName) {
  const parts = url.pathname.split('/');
  const issued = Date.parse(grant?.issuedAt), expires = Date.parse(grant?.expiresAt);
  if (parts.length !== 4 || parts[1] !== 'owner-builds' || parts[3] !== fileName ||
      !/^[A-Za-z0-9_-]{43}$/.test(parts[2]) || !Number.isFinite(now) ||
      !Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued ||
      expires - issued > 86400000 || now < issued || now >= expires ||
      !sha256.test(grant?.tokenHash || '') || !sha256.test(grant?.sha256 || '') ||
      !/^Touchline-\d+\.\d+\.\d+-\d+\.apk$/.test(grant?.fileName || '') ||
      artifact?.versionCode !== grant.versionCode || artifact?.sha256 !== grant.sha256 ||
      (artifact?.bytes !== undefined && artifact.bytes !== grant.bytes)) return false;
  const digest = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts[2])));
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= digest.charCodeAt(i) ^ grant.tokenHash.charCodeAt(i);
  return difference === 0;
}

function byteRange(header, size) {
  if (!header) return { start: 0, end: size - 1, status: 200 };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  let start = 0, end = size - 1;
  if (match[1]) {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : end;
  } else {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1), status: 206 };
}

// This helper performs no public launch decision. The caller must apply its
// existing launch gate before calling it for a public release URL.
export async function storedApkResponse(request, bucket, artifact, storedFileName, options = {}) {
  const headers = { ...PRIVATE_APK_HEADERS, ...options.headers };
  const key = artifactKey(artifact, storedFileName), size = artifact?.bytes;
  const fileName = options.downloadFileName ?? storedFileName;
  if (!key || !validSize(size) || !apkName.test(fileName || '')) return new Response(null, { status: 404, headers });
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
  if (!bucket || typeof bucket.get !== 'function' || typeof bucket.head !== 'function') return new Response(null, { status: 503, headers });
  // HEAD preserves the previous download behavior, including ignoring Range.
  const range = byteRange(request.method === 'HEAD' ? null : request.headers.get('Range'), size);
  if (!range) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
  let object;
  try {
    object = request.method === 'HEAD' ? await bucket.head(key)
      : await bucket.get(key, range.status === 206 ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined);
  } catch {
    return new Response(null, { status: 503, headers });
  }
  if (!object || object.size !== size || object.customMetadata?.sha256 !== artifact.sha256 ||
      (request.method !== 'HEAD' && !object.body)) {
    if (object?.body) await object.body.cancel().catch(() => {});
    return new Response(null, { status: 404, headers });
  }
  Object.assign(headers, {
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Accept-Ranges': 'bytes',
    'Content-Length': String(range.end - range.start + 1),
    ETag: `"${artifact.sha256}"`,
  });
  if (range.status === 206) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
  // R2 supplies the response stream directly; downloads never buffer the APK.
  return new Response(request.method === 'HEAD' ? null : object.body, { status: range.status, headers });
}

async function exactBody(request, size) {
  if (!request.body) return null;
  // One bounded allocation: no arrayBuffer(), tee(), or retained chunk list.
  // WebCrypto can copy this once when hashing; even a 32 MiB APK fits the
  // 128 MiB Worker limit without holding a base64 copy as well.
  const bytes = new Uint8Array(size), reader = request.body.getReader();
  let offset = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return offset === size ? bytes : null;
      if (!(value instanceof Uint8Array) || value.byteLength > size - offset) {
        await reader.cancel();
        return null;
      }
      bytes.set(value, offset);
      offset += value.byteLength;
    }
  } catch {
    await reader.cancel().catch(() => {});
    return null;
  } finally {
    reader.releaseLock();
  }
}

// There is no upload UI and no arbitrary object key. A valid, unexpired
// owner capability may upload only the already approved exact APK.
export async function privateApkUploadRoute(request, url, bucket, artifact, grant, now = Date.now()) {
  if (!url.pathname.startsWith('/owner-builds/') || url.pathname.split('/')[3] !== 'upload.apk') return null;
  if (!await approvedPrivateGrant(url, artifact, grant, now, 'upload.apk') || !validSize(grant?.bytes)) return missing();
  if (request.method !== 'PUT') return new Response(null, { status: 405, headers: { ...PRIVATE_APK_HEADERS, Allow: 'PUT' } });
  if (!bucket || typeof bucket.put !== 'function' || typeof bucket.head !== 'function') return new Response(null, { status: 503, headers: PRIVATE_APK_HEADERS });
  const length = request.headers.get('Content-Length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) !== grant.bytes)) {
    return new Response(null, { status: Number(length) > MAX_APK_BYTES ? 413 : 400, headers: PRIVATE_APK_HEADERS });
  }
  const bytes = await exactBody(request, grant.bytes);
  if (!bytes) return new Response(null, { status: 400, headers: PRIVATE_APK_HEADERS });
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  if (hex(digest) !== grant.sha256) return new Response(null, { status: 422, headers: PRIVATE_APK_HEADERS });
  const key = artifactKey(grant, grant.fileName);
  try {
    const object = await bucket.put(key, bytes.buffer, {
      // A concurrent retry can never replace an existing immutable object.
      onlyIf: { etagDoesNotMatch: '*' },
      sha256: digest,
      httpMetadata: { contentType: 'application/vnd.android.package-archive' },
      customMetadata: { sha256: grant.sha256, bytes: String(grant.bytes), versionCode: String(grant.versionCode) },
    });
    if (!object) {
      const existing = await bucket.head(key);
      if (!existing || existing.size !== grant.bytes || existing.customMetadata?.sha256 !== grant.sha256)
        return new Response(null, { status: 409, headers: PRIVATE_APK_HEADERS });
      return new Response(null, { status: 204, headers: PRIVATE_APK_HEADERS });
    }
    return new Response(null, { status: 201, headers: PRIVATE_APK_HEADERS });
  } catch {
    return new Response(null, { status: 503, headers: PRIVATE_APK_HEADERS });
  }
}
