import { HEAVY_KICK_TIMING } from './data.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (start, end, amount) => start + (end - start) * amount;
const componentClipCache = new WeakMap();

/** Apply an atlas component's absolute scanline rectangles in sprite-local coordinates. */
export function clipSpriteFrame(context, frame, source, dx, dy, scale) {
  if (!Array.isArray(frame?.clipRects)) return;
  const Path = typeof Path2D === 'function' ? Path2D : null;
  const key = `${source.x},${source.y},${dx},${dy},${scale}`;
  let cached = componentClipCache.get(frame);
  if (!cached || cached.key !== key || cached.rectangles !== frame.clipRects || cached.Path !== Path) {
    const rectangles = [];
    for (const rect of frame.clipRects) {
      if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite) || rect[2] <= 0 || rect[3] <= 0) continue;
      rectangles.push([(rect[0] - source.x) * scale + dx, (rect[1] - source.y) * scale + dy, rect[2] * scale, rect[3] * scale]);
    }
    const path = Path ? new Path() : null;
    if (path) for (const rect of rectangles) path.rect(...rect);
    cached = { key, rectangles: frame.clipRects, mapped: rectangles, path, Path };
    componentClipCache.set(frame, cached);
  }
  // The default nonzero rule unions overlapping scanline rectangles. Their
  // optional AA padding stays intact; an explicitly empty list hides the pose.
  if (cached.path) context.clip(cached.path);
  else {
    context.beginPath();
    for (const rect of cached.mapped) context.rect(...rect);
    context.clip();
  }
}

// Seconds from attack start, matching Game.heroUpdate's damage trigger.
// Damage, reach, cooldown and combo rules continue to belong to the engine.
export const COMBAT_CONTACT = Object.freeze({ light: .09, heavy: HEAVY_KICK_TIMING.contact, bat: .12, 'jump-kick': .13 });
export const COMBAT_PHASES = Object.freeze([
  'guard', 'windup', 'drive', 'contact', 'extension', 'follow-through', 'recoil', 'guard-return',
]);

/** Pure chronological pose selection; attackTime is REMAINING engine time. */
export function combatFrame(entity) {
  if (!entity || entity.state !== 'attack' || entity.hp <= 0) return null;
  const airborneAttack = entity.attackKind === 'jump-kick';
  if (!airborneAttack && (entity.z > 0 || entity.vz > 0)) return null;
  const action = ['light', 'bat'].includes(entity.attackKind) ? 'punch' : ['heavy', 'jump-kick'].includes(entity.attackKind) ? 'kick' : null;
  const duration = entity.attackDuration;
  if (!action || !Number.isFinite(duration) || !Number.isFinite(entity.attackTime) || duration <= 0) return null;

  // An explicit contact time can be supplied if the engine later gains an
  // attack definition table. Never infer contact from a visual sine wave.
  const contactTime = Number.isFinite(entity.attackContactTime) ? entity.attackContactTime : COMBAT_CONTACT[entity.attackKind];
  if (contactTime <= 0 || contactTime >= duration) return null;
  const elapsed = clamp(duration - entity.attackTime, 0, duration);
  const progress = elapsed / duration;
  const contactProgress = contactTime / duration;
  // The knee lifts briefly, snaps into contact, then folds promptly. Keep each
  // drawing visible for at least a 60 Hz frame without stretching the punch.
  const starts = action === 'kick' ? [
    0, contactProgress * .18, contactProgress * .65, contactProgress,
    mix(contactProgress, 1, .12), mix(contactProgress, 1, .25),
    mix(contactProgress, 1, .48), mix(contactProgress, 1, .75),
  ] : [
    0, contactProgress * .24, contactProgress * .60, contactProgress,
    mix(contactProgress, 1, .15), mix(contactProgress, 1, .36),
    mix(contactProgress, 1, .59), mix(contactProgress, 1, .83),
  ];
  let index = 0;
  for (let frame = 1; frame < starts.length; frame++) {
    if (progress >= starts[frame]) index = frame;
  }
  // The live engine's flag is authoritative: the fist/boot may not visually
  // contact before the same update which applies damage. Undefined supports
  // deterministic preview tools that only supply duration and remaining time.
  if (entity.didStrike === false) index = Math.min(index, 2);
  else if (entity.didStrike === true) index = Math.max(index, 3);
  return { action, index, phase: COMBAT_PHASES[index], elapsed, progress, contactProgress };
}

/**
 * Metadata follows walk.json: each hero has columns, rows, referenceHeight,
 * a cell-local foot/root anchor and frames with cell-local bounds plus optional
 * absolute source crops. Default atlas order is punch[0..7], kick[8..15].
 * Optional actions.punch/actions.kick arrays contain alternative frame indices.
 * frame.clipRects can isolate a component with absolute image [x,y,w,h] rects.
 *
 * Call BEFORE the legacy attack translate/shear/rotation in Renderer.drawHero.
 * Returns true after drawing; false leaves special, air and missing art intact.
 */
export function resolveCombatPose(renderer, entity, id) {
  const selected = combatFrame(entity);
  if (!selected) return false;
  const image = renderer.assets?.['combat-' + id];
  const meta = renderer.combatMetadata?.[id] || renderer.combatMetadata?.heroes?.[id];
  if (!image || !meta || !Array.isArray(meta.frames) || typeof renderer.drawLitSprite !== 'function') return false;
  const action = meta.actions?.[selected.action];
  const sequence = Array.isArray(action) ? action : action?.frames;
  const index = sequence ? sequence[selected.index] : selected.index + (selected.action === 'kick' ? 8 : 0);
  if (!Number.isInteger(index) || index < 0) return false;
  const frame = meta.frames[index];
  if (!frame) return false;
  const columns = meta.columns || 4;
  const rows = meta.rows || 4;
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns <= 0 || rows <= 0) return false;
  const cellWidth = image.width / columns;
  const cellHeight = image.height / rows;
  const cellX = (index % columns) * cellWidth;
  const cellY = Math.floor(index / columns) * cellHeight;
  const bounds = frame.bounds || { x: 0, y: 0, w: cellWidth, h: cellHeight };
  const source = frame.source || {
    x: cellX + bounds.x, y: cellY + bounds.y, w: bounds.w, h: bounds.h,
  };
  // With an explicit cropped source, the offset still refers to the untrimmed
  // atlas cell. This prevents extended punches and raised kicks being centered
  // or stretched independently of the supporting foot.
  const localX = frame.bounds ? bounds.x : source.x - cellX;
  const localY = frame.bounds ? bounds.y : source.y - cellY;
  const anchor = frame.anchor || meta.anchor || { x: cellWidth / 2, y: cellHeight };
  const referenceHeight = meta.referenceHeight || cellHeight;
  const numbers = [source.x, source.y, source.w, source.h, localX, localY, anchor.x, anchor.y, referenceHeight];
  if (!numbers.every(Number.isFinite) || referenceHeight <= 0 || source.w <= 0 || source.h <= 0 ||
    source.x < 0 || source.y < 0 || source.x + source.w > image.width || source.y + source.h > image.height) return false;
  const scale = 211 / referenceHeight;
  const dx = (localX - anchor.x) * scale;
  const dy = (localY - anchor.y) * scale;
  const context = renderer.c;
  context.save();
  if (entity.attackKind === 'jump-kick') {
    const extension = selected.index <= 5 ? 1 : (7 - selected.index) / 2;
    context.translate(9 * extension, 7 * extension); context.rotate(-.14 * extension);
  }
  clipSpriteFrame(context, frame, source, dx, dy, scale);
  if ((entity.invuln || 0) > 0) context.globalAlpha *= Math.floor((renderer.time || 0) * 18) % 2 ? .63 : 1;
  renderer.drawLitSprite(entity, image, source.x, source.y, source.w, source.h,
    dx, dy, source.w * scale, source.h * scale);
  context.restore();
  return true;
}
