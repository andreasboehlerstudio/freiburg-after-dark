import { clipSpriteFrame } from './combat-animation.js';

/** Convert a deliberately keyed production sheet into an alpha texture once at load time. */
export function keyBouncerSheet(image) {
  const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(image.width, image.height) : document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.drawImage(image, 0, 0);
  const pixels = c.getImageData(0, 0, canvas.width, canvas.height), d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const dominance = g - Math.max(r, b);
    if (g > 130 && dominance > 65) d[i + 3] = 0;
    else if (dominance > 25) d[i + 1] = Math.max(r, b) + 10;
  }
  c.putImageData(pixels, 0, 0);
  return canvas;
}

export function bouncerFrame(entity, time = 0) {
  if (entity.state === 'telegraph') return 3;
  if (entity.state === 'hurt') return 5;
  if (entity.state === 'attack') {
    if (entity.attackKind === 'charge') return Math.floor(time * 12) % 2 ? 1 : 2;
    if (entity.attackKind === 'slam') return entity.didStrike ? 7 : 3;
    if (entity.attackKind === 'kick') return entity.didStrike ? 6 : 3;
    const elapsed = 1 - entity.attackTime / entity.attackDuration;
    return entity.didStrike ? elapsed > .72 ? 5 : 4 : 3;
  }
  if (entity.state === 'walk') return Math.floor(time * 7) % 2 ? 1 : 2;
  return 0;
}

export function drawBouncer(renderer, entity) {
  const image = renderer.assets.bouncer, meta = renderer.enemyMetadata.bouncer;
  if (!image || !meta?.frames?.length) return false;
  const frame = meta.frames[bouncerFrame(entity, renderer.time)], s = frame.source;
  const scale = 268 / meta.referenceHeight;
  const c = renderer.c;
  c.save();
  if (entity.invuln > 0 && Math.floor(renderer.time * 20) % 2) c.globalAlpha *= .7;
  const anchor = frame.anchor || meta.anchor;
  const dx = (frame.bounds.x - anchor.x) * scale;
  const dy = (frame.bounds.y - anchor.y) * scale;
  clipSpriteFrame(c, frame, s, dx, dy, scale);
  renderer.drawLitSprite(entity, image, s.x, s.y, s.w, s.h, dx, dy, s.w * scale, s.h * scale);
  c.restore();
  return true;
}
