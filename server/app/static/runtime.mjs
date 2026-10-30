import { API_ORIGIN, API_FALLBACK_ORIGIN } from './server-config.mjs';

export const isAndroidCompat = globalThis.location?.origin === 'https://appassets.androidplatform.net';
export const hasNativeBridge = () => isAndroidCompat && typeof globalThis.StarPetNative?.postMessage === 'function';

export function randomId() {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function validApiPath(path) {
  if (!path.startsWith('/api/') || path.includes('\\')) throw new Error('Invalid API path');
}

export function apiUrl(path, native = isAndroidCompat) {
  validApiPath(path);
  if (!native) return path;
  return path === '/api/v1/catalog' ? '/static/catalog.json' : API_ORIGIN + path;
}

async function timedFetch(url, options, fetcher, timeoutMs) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, timeoutMs);
  try { return await fetcher(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', cancel); }
}

// The alternate hostname reaches the same server. Progress revisions and answer request IDs
// make a retry safe even if the first request reached the server before its connection failed.
export async function fetchApiWithFallback(path, options, origins, fetcher = globalThis.fetch, preferred = 0) {
  validApiPath(path);
  if (!origins.length || origins.some(origin => {
    try { const url = new URL(origin); return url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password; }
    catch (_) { return true; }
  })) throw new Error('Invalid API origin');
  const order = [preferred, ...origins.map((_, index) => index).filter(index => index !== preferred)];
  for (let position = 0; position < order.length; position++) {
    const index = order[position];
    if (index < 0 || index >= origins.length) throw new Error('Invalid preferred API origin');
    try {
      const speech = /^\/api\/v1\/practice\/(speaking|conversation)\?/.test(path);
      const response = await timedFetch(origins[index] + path, options, fetcher, speech ? 45000 : position === 0 ? 7000 : 12000);
      return { response, index };
    } catch (error) {
      if (options.signal?.aborted || position === order.length - 1 || !(error instanceof TypeError || error?.name === 'AbortError')) throw error;
    }
  }
  throw new Error('No API origin available');
}

let preferredApiIndex = 0;
export async function apiFetch(path, options = {}) {
  const url = apiUrl(path);
  if (!isAndroidCompat || url === '/static/catalog.json') return timedFetch(url, options, globalThis.fetch, /^\/api\/v1\/practice\/(speaking|conversation)\?/.test(path) ? 45000 : 10000);
  const origins = [API_ORIGIN, API_FALLBACK_ORIGIN].filter(Boolean);
  const result = await fetchApiWithFallback(path, options, origins, globalThis.fetch, preferredApiIndex);
  preferredApiIndex = result.index;
  return result.response;
}

const pending = new Map();
if (hasNativeBridge()) {
  globalThis.StarPetNative.onmessage = event => {
    let message;
    try { message = JSON.parse(event.data); } catch (_) { return; }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id); clearTimeout(request.timeout);
    if (message.ok) request.resolve(message);
    else request.reject(new Error(message.error || '本机功能暂不可用'));
  };
}

export function nativeCall(action, values = {}) {
  if (!hasNativeBridge()) return Promise.reject(new Error('本机功能暂不可用'));
  return new Promise((resolve, reject) => {
    const id = randomId();
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('本机响应超时，请重试')); }, action === 'speakAndWait' ? 45000 : 8000);
    pending.set(id, { resolve, reject, timeout });
    try { globalThis.StarPetNative.postMessage(JSON.stringify({ ...values, id, action })); }
    catch (error) { pending.delete(id); clearTimeout(timeout); reject(error); }
  });
}

export function stopEnglish() {
  globalThis.speechSynthesis?.cancel();
  if (hasNativeBridge()) nativeCall('stopSpeech').catch(() => {});
}
