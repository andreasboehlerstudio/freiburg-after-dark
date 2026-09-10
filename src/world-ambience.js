import { LEVELS } from './data.js';
import { mapScenePoint } from './scene-lighting.js';

const KEYS = LEVELS.map(level => level.worldKey);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hash = n => { const value = Math.sin(n * 127.1 + 31.7) * 43758.5453; return value - Math.floor(value); };

// Source-space canopy positions reviewed in the actual paintings. Only these
// trees shed an occasional leaf; there are no particles emitted by masonry.
export const TREE_ART = {
  martinstor: [[[.397,.31],[.658,.34]], [[.465,.25]], [[.4,.43],[.708,.43],[.858,.49]]],
  stuehlinger: [[[.257,.33],[.71,.33]], [[.214,.21],[.779,.29]], [[.27,.22]]],
  park: [[[.045,.18],[.325,.18],[.59,.18],[.955,.18]], [[.145,.18],[.22,.18],[.828,.18]], [[.055,.2],[.145,.2],[.285,.2],[.39,.2],[.58,.2],[.9,.3]]],
  haslach: [[[.377,.19],[.854,.19]], [], []],
  wiehre: [[[.025,.16],[.27,.16],[.54,.29],[.71,.16]], [], []],
  bermuda: [[], [], []],
};
const canopyCache = new Map();
export function worldCanopies(level = 0) {
  const key = typeof level === 'string' ? level : KEYS[level] || KEYS[0];
  if (!canopyCache.has(key)) canopyCache.set(key, (TREE_ART[key] || []).flatMap((trees, section) =>
    trees.map(([u, v], index) => ({ ...mapScenePoint(key, section, u, v), seed: section * 31 + index * 7 + 1 }))
      .filter(tree => tree.visible)));
  return canopyCache.get(key);
}

export function ambientLeaves(level, time = 0, reducedMotion = false) {
  if (reducedMotion) return [];
  const leaves = [];
  for (const tree of worldCanopies(level)) for (let index = 0; index < 2; index++) {
    const seed = tree.seed + index * 97, duration = 18 + hash(seed) * 9;
    const phase = ((time / duration + hash(seed + 3)) % 1 + 1) % 1;
    // A quiet interval between leaves; fade completely before a new one starts.
    if (phase > .78) continue;
    const progress = phase / .78;
    const alpha = .53 * Math.min(1, progress * 9, (1 - progress) * 8);
    const y = tree.y + 35 + progress * Math.min(320, 482 - tree.y);
    leaves.push({ x: tree.x + Math.sin(progress * 7 + seed) * 23 + progress * 45 - 22,
      y, alpha, angle: time * .65 + seed, width: 2.3 + hash(seed + 5) * 1.7,
      color: hash(seed + 6) > .45 ? '#aea476' : '#69775c' });
  }
  return leaves;
}

export function mistPatches(level = 0, time = 0, reducedMotion = false) {
  const key = typeof level === 'string' ? level : KEYS[level] || KEYS[0];
  const t = reducedMotion ? 0 : time;
  // Night haze has no invented lamp or vent source: it stays near the curb in
  // world space and drifts slowly without moving any of the architecture.
  return Array.from({ length: 8 }, (_, index) => {
    const seed = index + (KEYS.indexOf(key) + 1) * 31, phase = hash(seed) * 6.28;
    return { x: 260 + index * 610 + Math.sin(t * .075 + phase) * 76,
      y: 467 + hash(seed + 2) * 52 + Math.sin(t * .09 + phase) * 7,
      width: 420 + hash(seed + 4) * 160, height: 34 + hash(seed + 7) * 24,
      alpha: (key === 'park' ? .075 : .055) * (.82 + Math.sin(t * .11 + phase) * .18) };
  });
}

export class WorldAmbience {
  haze() {
    if (this.texture) return this.texture;
    const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(256, 64) :
      typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!canvas) return null;
    canvas.width = 256; canvas.height = 64;
    const c = canvas.getContext('2d'); c.translate(128, 32); c.scale(128, 32);
    const gradient = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, '#afc1cd'); gradient.addColorStop(.3, '#afc1cd91'); gradient.addColorStop(1, '#afc1cd00');
    c.fillStyle = gradient; c.fillRect(-1, -1, 2, 2);
    this.texture = canvas; return canvas;
  }
  draw(context, level, camera = 0, { time = 0, reducedMotion = false } = {}) {
    context.save(); context.globalCompositeOperation = 'screen';
    const texture = this.haze();
    if (texture) for (const mist of mistPatches(level, time, reducedMotion)) {
      const x = mist.x - camera;
      if (x + mist.width / 2 < 0 || x - mist.width / 2 > 1280) continue;
      context.globalAlpha = clamp(mist.alpha, 0, .08);
      context.drawImage(texture, x - mist.width / 2, mist.y - mist.height / 2, mist.width, mist.height);
    }
    context.globalCompositeOperation = 'source-over';
    for (const leaf of ambientLeaves(level, time, reducedMotion)) {
      const x = leaf.x - camera; if (x < -5 || x > 1285) continue;
      context.save(); context.translate(x, leaf.y); context.rotate(leaf.angle);
      context.globalAlpha = leaf.alpha; context.fillStyle = leaf.color;
      context.beginPath(); context.ellipse(0, 0, leaf.width, .8 + Math.abs(Math.sin(leaf.angle)) * .9, 0, 0, Math.PI * 2); context.fill();
      context.restore();
    }
    context.restore();
  }
}
