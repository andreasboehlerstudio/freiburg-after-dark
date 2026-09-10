import { LIGHT_COLORS } from './scene-lighting.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function makeSurface(width, height) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
  if (typeof document === 'undefined' || typeof CanvasRenderingContext2D === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height; return canvas;
}

/**
 * Common night grade plus spatially sampled practical light. Cached crops
 * and directional variants retain the original pose, registration and alpha.
 * A single reusable small canvas blends them before one final sprite draw;
 * source-atop keeps even antialiased fringe alpha unchanged. No pixel reads,
 * blur filters or canvas allocation are needed for a warmed-up pose.
 */
export class FighterLighting {
  constructor({ maxEntries = 96, maxPixels = 8_000_000, maxDimension = 384 } = {}) {
    this.maxEntries = Math.max(1, maxEntries);
    this.maxPixels = Math.max(600_000, maxPixels);
    this.maxDimension = clamp(maxDimension, 128, 512);
    this.supported = typeof OffscreenCanvas === 'function' ||
      (typeof document !== 'undefined' && typeof CanvasRenderingContext2D !== 'undefined');
    this.clear();
  }

  clear() {
    for (const entry of this.entries?.values() || []) this.release(entry);
    if (this.work) this.work.width = this.work.height = 1;
    this.work = null;
    this.entries = new Map(); this.images = new WeakMap();
    this.nextImage = 0; this.pixels = 0;
  }

  release(entry) {
    for (const canvas of [entry.base, ...entry.variants.values()]) canvas.width = canvas.height = 1;
  }

  trim(keep, keepVariant) {
    for (const [key, entry] of this.entries) {
      if (this.entries.size <= this.maxEntries && this.pixels <= this.maxPixels) break;
      if (entry === keep) continue;
      this.entries.delete(key); this.pixels -= entry.pixels; this.release(entry);
    }
    // A large single crop obeys the pixel budget too. A variant already
    // blended into the work canvas can be evicted independently.
    for (const [key, canvas] of keep.variants) {
      if (this.pixels <= this.maxPixels) break;
      if (canvas === keepVariant) continue;
      keep.variants.delete(key);
      const size = keep.width * keep.height;
      keep.pixels -= size; this.pixels -= size;
      canvas.width = canvas.height = 1;
    }
  }

  entry(image, sx, sy, sw, sh) {
    if (!this.supported) return null;
    let id = this.images.get(image);
    if (id === undefined) { id = this.nextImage++; this.images.set(image, id); }
    const key = `${id}:${sx},${sy},${sw},${sh}`;
    const cached = this.entries.get(key);
    if (cached) { this.entries.delete(key); this.entries.set(key, cached); return cached; }
    const scale = Math.min(1, this.maxDimension / Math.max(sw, sh));
    const width = Math.max(1, Math.round(sw * scale)), height = Math.max(1, Math.round(sh * scale));
    const base = makeSurface(width, height), b = base?.getContext('2d');
    if (!b) { this.supported = false; return null; }
    b.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
    b.globalCompositeOperation = 'source-atop';
    b.globalAlpha = .09; b.fillStyle = '#31546d'; b.fillRect(0, 0, width, height);
    b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
    const entry = { base, width, height, variants: new Map(), pixels: width * height };
    this.entries.set(key, entry); this.pixels += entry.pixels; this.trim(entry);
    return entry;
  }

  variant(entry, kind, left) {
    const key = `${kind}:${left ? 'left' : 'right'}`;
    if (entry.variants.has(key)) return entry.variants.get(key);
    const { width, height, base } = entry, color = LIGHT_COLORS[kind];
    const canvas = makeSurface(width, height), c = canvas.getContext('2d');
    c.drawImage(base, 0, 0);
    c.globalCompositeOperation = 'source-atop';
    const wash = c.createLinearGradient(left ? 0 : width, 0, left ? width : 0, height * .2);
    wash.addColorStop(0, color + '7a');
    wash.addColorStop(.38, color + '49');
    wash.addColorStop(1, color + '05');
    c.fillStyle = wash; c.fillRect(0, 0, width, height);

    const edge = makeSurface(width, height), e = edge.getContext('2d');
    e.drawImage(base, 0, 0);
    e.globalCompositeOperation = 'destination-out';
    e.drawImage(base, (left ? 1 : -1) * Math.max(1, Math.round(height * .009)), 0);
    e.globalCompositeOperation = 'source-in'; e.fillStyle = color; e.fillRect(0, 0, width, height);
    e.globalCompositeOperation = 'destination-in';
    const vertical = e.createLinearGradient(0, 0, 0, height);
    vertical.addColorStop(0, '#ffffffa6'); vertical.addColorStop(.2, '#fff');
    vertical.addColorStop(.7, '#ffffffa6'); vertical.addColorStop(1, '#ffffff40');
    e.fillStyle = vertical; e.fillRect(0, 0, width, height);
    c.globalAlpha = .72; c.drawImage(edge, 0, 0); c.globalAlpha = 1;
    edge.width = edge.height = 1;
    entry.variants.set(key, canvas);
    const size = width * height; entry.pixels += size; this.pixels += size;
    this.trim(entry, canvas); return canvas;
  }

  draw(context, image, sx, sy, sw, sh, dx, dy, dw, dh, { facing = 1, lights = [] } = {}) {
    if (![sx, sy, sw, sh, dx, dy, dw, dh].every(Number.isFinite) || sw <= 0 || sh <= 0) return;
    const entry = this.entry(image, sx, sy, sw, sh);
    if (!entry) { context.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh); return; }
    const active = lights.filter(light => LIGHT_COLORS[light.kind] && light.intensity > .015).slice(0, 2);
    if (!active.length) { context.drawImage(entry.base, dx, dy, dw, dh); return; }
    const work = this.work ||= makeSurface(this.maxDimension, this.maxDimension), w = work.getContext('2d');
    const { width, height } = entry;
    w.globalCompositeOperation = 'source-over'; w.globalAlpha = 1;
    w.clearRect(0, 0, width, height); w.drawImage(entry.base, 0, 0);
    w.globalCompositeOperation = 'source-atop';
    for (const light of active) {
      const side = clamp((light.side || 0) * (facing < 0 ? -1 : 1), -1, 1);
      const intensity = clamp(light.intensity, 0, 1);
      const left = intensity * (1 - side) / 2, right = intensity * (1 + side) / 2;
      // Compensate sequential alpha blending so passing beneath a lamp
      // does not dim it or abruptly flip a hard left/right rim.
      if (left > .005) {
        w.globalAlpha = left / Math.max(.001, 1 - right);
        w.drawImage(this.variant(entry, light.kind, true), 0, 0);
      }
      if (right > .005) {
        w.globalAlpha = right; w.drawImage(this.variant(entry, light.kind, false), 0, 0);
      }
    }
    w.globalAlpha = 1; w.globalCompositeOperation = 'source-over';
    context.drawImage(work, 0, 0, width, height, dx, dy, dw, dh);
  }

  /** Ground contact retains fixed feet; only the colored wet spill is local. */
  drawContact(context, entity, screenX, { wet = true, lights = [] } = {}) {
    if (entity.state === 'dead' || !Number.isFinite(screenX) || !Number.isFinite(entity.y)) return;
    const height = Math.max(0, entity.z || 0), grounded = clamp(1 - height / 95, 0, 1);
    const radius = (entity.isBoss ? 49 : 37) + (entity.state === 'down' ? 17 : 0), y = entity.y + 3;
    const ellipse = (x, py, rx, ry, fill) => {
      context.beginPath(); context.ellipse(x, py, rx, ry, 0, 0, Math.PI * 2);
      context.fillStyle = fill; context.fill();
    };
    context.save();
    ellipse(screenX, y + 2, radius + 12 + height * .04, 11, `rgba(3,8,15,${.15 + grounded * .12})`);
    ellipse(screenX, y, radius, 6.5, `rgba(2,5,10,${.1 + grounded * .24})`);
    if (grounded > .05) {
      ellipse(screenX, y - 1, radius * .73, 3.5, `rgba(1,3,7,${grounded * .35})`);
      if (wet) for (const light of lights) {
        if (!LIGHT_COLORS[light.kind]) continue;
        context.save(); context.globalAlpha *= grounded * light.intensity * .25;
        ellipse(screenX + (light.side || 0) * radius * .48, y + 7, radius * .6, 1.2, LIGHT_COLORS[light.kind]);
        context.globalAlpha *= .6;
        ellipse(screenX - (light.side || 0) * radius * .25, y + 11, radius * .35, .7, LIGHT_COLORS[light.kind]);
        context.restore();
      }
    }
    context.restore();
  }
}
