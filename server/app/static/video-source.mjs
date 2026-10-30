const MAX_BYTES = 16 * 1024 * 1024;

// Small bundled episodes use one complete local read in older Android WebViews.
// A Blob source can seek without re-entering the platform's HTTP range/cache path.
export async function prepareLocalVideo(path, signal, {
  fetcher = globalThis.fetch, maxBytes = MAX_BYTES,
  createURL = blob => URL.createObjectURL(blob), revokeURL = url => URL.revokeObjectURL(url),
} = {}) {
  if (!/^\/static\/videos\/[a-z0-9-]+\.mp4(?:\?v=[a-z0-9-]+)?$/.test(path)) throw new Error('Invalid bundled video path');
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const response = await fetcher(path, {cache:'no-store', signal});
  if (!response.ok) throw new Error('Bundled video unavailable');
  // Some HarmonyOS WebViews merge their generated length with the identical
  // intercepted response header. Accept matching decimal copies, never conflicts.
  const lengths = (response.headers.get('Content-Length') || '').split(',').map(value => value.trim());
  const declared = Number(lengths[0]);
  if (lengths.some(value => !/^\d+$/.test(value) || Number(value) !== declared)
      || !Number.isSafeInteger(declared) || declared <= 0 || declared > maxBytes) throw new Error('Bundled video size unavailable or too large');
  const parts = []; let bytes = 0;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    try {
      while (true) {
        if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
        const {done, value} = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes || bytes > declared) throw new Error('Bundled video exceeded its declared size');
        parts.push(value);
      }
    } catch (error) { await reader.cancel().catch(()=>{}); throw error; }
    finally { reader.releaseLock(); }
  } else {
    const data = await response.arrayBuffer(); bytes = data.byteLength;
    if (bytes > maxBytes) throw new Error('Bundled video too large');
    parts.push(data);
  }
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (bytes !== declared) throw new Error('Bundled video read was incomplete');
  const url = createURL(new Blob(parts, {type:'video/mp4'}));
  let released = false;
  return {url, bytes, release() { if (!released) { released=true; revokeURL(url); } }};
}
