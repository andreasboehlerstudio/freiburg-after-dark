import { imageURL } from './image-delivery.js';

// Limit actual transfers, never a parent task waiting for its child transfers.
const queue = [];
let active = 0;
function transfer(work) {
  return new Promise((resolve, reject) => {
    queue.push({ work, resolve, reject });
    drain();
  });
}
function drain() {
  while (active < 4 && queue.length) {
    const { work, resolve, reject } = queue.shift();
    active++;
    Promise.resolve().then(work).then(resolve, reject).finally(() => { active--; drain(); });
  }
}
function timed(work, timeoutMs, cancel = () => {}) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('Asset transfer timed out');
      error.name = 'TimeoutError';
      reject(error);
      cancel();
    }, timeoutMs);
  });
  return Promise.race([Promise.resolve().then(work), deadline]).finally(() => clearTimeout(timer));
}
function decode(url, timeoutMs) {
  const image = new Image();
  image.decoding = 'async';
  return timed(async () => {
    image.src = url.href;
    await image.decode();
    return image;
  }, timeoutMs, () => { image.src = ''; });
}

const pendingImages = new Map();
/** Successful decoded sprites belong to their renderer, avoiding a second raw copy. */
export function loadImage(path, baseURL = import.meta.url, { timeoutMs = 45000 } = {}) {
  const original = new URL(path, baseURL), optimized = imageURL(path, baseURL);
  const key = optimized.href;
  if (pendingImages.has(key)) return pendingImages.get(key);
  const task = transfer(async () => {
    try { return await decode(optimized, timeoutMs); }
    catch (error) {
      // Older browsers or a missing delivery file can still use the original.
      // A slow connection should not silently restart a larger transfer.
      if (error.name === 'TimeoutError' || optimized.href === original.href) throw error;
      return decode(original, timeoutMs);
    }
  }).finally(() => pendingImages.delete(key));
  pendingImages.set(key, task);
  return task;
}

const jsonCache = new Map(), pendingJSON = new Map();
export function loadJSON(path, baseURL = import.meta.url, { timeoutMs = 45000 } = {}) {
  const url = new URL(path, baseURL), key = url.href;
  if (jsonCache.has(key)) return Promise.resolve(jsonCache.get(key));
  if (pendingJSON.has(key)) return pendingJSON.get(key);
  const task = transfer(async () => {
    const controller = new AbortController();
    const data = await timed(async () => {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('Asset metadata request failed: ' + response.status);
      const value = await response.json();
      if (!value || typeof value !== 'object') throw new Error('Invalid asset metadata');
      return value;
    }, timeoutMs, () => controller.abort());
    jsonCache.set(key, data);
    return data;
  }).finally(() => pendingJSON.delete(key));
  pendingJSON.set(key, task);
  return task;
}

/** Show the first failure promptly; a retry joins the remaining in-flight resources. */
export async function runLoadTasks(tasks, onProgress = () => {}) {
  let completed = 0;
  const total = tasks.length;
  onProgress({ completed, total });
  return Promise.all(tasks.map(async task => {
    const result = await task();
    onProgress({ completed: ++completed, total });
    return result;
  }));
}

export const yieldForPaint = () => new Promise(resolve => setTimeout(resolve, 0));
