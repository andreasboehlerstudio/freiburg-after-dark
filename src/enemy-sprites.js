import { clipSpriteFrame } from './combat-animation.js';
import { enemyMotion, authoredEnemyPose } from './enemy-motion.js';
import { LOCAL_ENEMY_IDS, isLocalEnemy, localEnemyMotion, localEnemyStagger } from './local-enemy-motion.js';

export const ENEMY_ART = Object.freeze({
  hooligan: ['enemies', 0, 'hooligan'], suit: ['enemies', 1, 'suit'],
  runner: ['enemies', 2, 'runner'], extremist: ['enemies', 3, 'extremist'],
  enforcer: ['bosses', 0, 'enforcer'], broker: ['bosses', 1, 'broker'], baron: ['bosses', 3, 'baron'],
  tattoo: ['enemies-night-a', 0, 'tattoo'], clubfighter: ['enemies-night-a', 1, 'clubfighter'],
  civic: ['enemies-night-a', 2, 'civic'], blackbomber: ['enemies-night-a', 3, 'blackbomber'],
  nightowl: ['enemies-night-b', 0, 'nightowl'], scrapper: ['enemies-night-b', 1, 'scrapper'],
  skinny: ['enemies-night-b', 2, 'skinny'], eco: ['enemies-night-b', 3, 'eco'],
  protester: ['enemies-night-b', 4, 'protester'],
  ...Object.fromEntries(LOCAL_ENEMY_IDS.map(id => [id, ['enemies-local-' + id, 0, id]])),
});

export const isPassiveFighter = entity => entity.passive === true || entity.kind === 'passive' || (entity.enemyType || entity.type) === 'protester';
export const hasAuthoredEnemyDown = isLocalEnemy;

function localSpritePose(renderer, entity, sheet, key, image) {
  const character = renderer.enemyMetadata[sheet]?.characters?.[key];
  const motion = localEnemyMotion(entity), frame = character?.frames?.[motion.index];
  const source = frame?.source, anchor = frame?.sourceAnchor;
  if (!source || !anchor || !(character.referenceHeight > 0)) return null;
  const height = Number.isFinite(entity.spriteHeight) && entity.spriteHeight > 0 ? entity.spriteHeight : entity.isBoss ? 250 : 211;
  const scale = height / character.referenceHeight;
  if (![source.x, source.y, source.w, source.h, anchor.x, anchor.y, scale].every(Number.isFinite) || source.w <= 0 || source.h <= 0 || source.x < 0 || source.y < 0 || source.x + source.w > image.width || source.y + source.h > image.height) return null;
  const cellWidth = image.width / 4, cellHeight = image.height / 4;
  const cellX = motion.index % 4 * cellWidth, cellY = Math.floor(motion.index / 4) * cellHeight;
  const crossesCell = source.x < cellX || source.y < cellY || source.x + source.w > cellX + cellWidth || source.y + source.h > cellY + cellHeight;
  if (crossesCell && !frame.clipRects?.some(rect => Array.isArray(rect) && rect.length === 4 && rect.every(Number.isFinite) && rect[2] > 0 && rect[3] > 0)) return null;
  return { image, source, frame, index: motion.index, row: Math.floor(motion.index / 4), height, scale,
    dx: (source.x - anchor.x) * scale, dy: (source.y - anchor.y) * scale,
    dw: source.w * scale, dh: source.h * scale, moving: motion.action === 'walk', passive: false, motion, local: true };
}

/** Fixed skeleton scale and registered foot anchors, including cross-cell crops. */
export function enemySpritePose(renderer, entity) {
  const type = entity.enemyType || entity.type;
  const entry = type === 'enforcer' && entity.isBoss ? ['bosses', 2, 'mafia'] : ENEMY_ART[type];
  if (!entry) return null;
  const [sheet, defaultRow, key] = entry, image = renderer.assets[sheet];
  if (!image) return null;
  if (isLocalEnemy(entity)) return localSpritePose(renderer, entity, sheet, key, image);
  const metadata = renderer.enemyMetadata[sheet] || {};
  const character = metadata.characters?.[key] || metadata.rows?.[key] || metadata[key] || metadata.rows?.[defaultRow];
  const passive = isPassiveFighter(entity);
  const motion = enemyMotion(entity, sheet, key);
  const moving = !passive && !!motion && motion.action === 'walk';
  let index = moving ? 1 : 0;
  if (!passive && entity.state === 'attack' && entity.attackKind !== 'charge') index = entity.attackKind === 'kick' ? 3 : 2;
  if (motion?.guard) index = 0;
  if (!passive && entity.state === 'attack' && entity.attackKind === 'charge' && Math.floor(renderer.time * 10) % 2) index = 2;
  if (passive) index = entity.state === 'hurt' ? 2 : ['dead', 'down'].includes(entity.state) ? 3 : entity.state === 'walk' ? 1 : 0;
  const columns = metadata.columns || 4, rows = metadata.rowsCount || (sheet === 'enemies-night-b' ? 5 : 4);
  const cw = image.width / columns, ch = image.height / rows, row = character?.row ?? defaultRow;
  const cellX = index * cw, cellY = row * ch;
  const frames = character?.frames || [], frame = frames[index], bounds = frame?.bounds || (frame?.w ? frame : null);
  const idle = frames[0]?.bounds || frames[0]?.source || frames[0];
  const height = Number.isFinite(entity.spriteHeight) && entity.spriteHeight > 0 ? entity.spriteHeight : passive ? 120 : entity.isBoss ? 250 : 211;
  const source = frame?.source || { x: cellX + (bounds?.x || 0), y: cellY + (bounds?.y || 0), w: bounds?.w || cw, h: bounds?.h || ch };
  let scale = height / ch, dx = -height * .55, dy = -height, dw = height * 1.1, dh = height;
  if (bounds || frame?.source) {
    scale = height / (character?.referenceHeight || idle?.h || source.h);
    const localX = bounds?.x ?? source.x - cellX, localY = bounds?.y ?? source.y - cellY;
    const anchor = frame.anchor || character?.anchor || { x: cw / 2, y: localY + source.h };
    dx = frame.sourceAnchor ? (source.x - frame.sourceAnchor.x) * scale : (localX - anchor.x) * scale;
    dy = frame.sourceAnchor ? (source.y - frame.sourceAnchor.y) * scale : (localY - anchor.y) * scale;
    dw = source.w * scale; dh = source.h * scale;
  }
  if (![source.x, source.y, source.w, source.h, scale, dx, dy, dw, dh].every(Number.isFinite) || source.w <= 0 || source.h <= 0 || scale <= 0 || source.x < 0 || source.y < 0 || source.x + source.w > image.width || source.y + source.h > image.height) return null;
  return authoredEnemyPose(renderer, entity, { image, source, frame, index, row, height, scale, dx, dy, dw, dh, moving, passive }, sheet, key);
}

export function drawEnemySprite(renderer, entity) {
  if ((entity.enemyType || entity.type) === 'bouncer') return renderer.drawBouncer(entity);
  const pose = enemySpritePose(renderer, entity);
  if (!pose) return false;
  const { image, source: s, frame, scale, dx, dy, dw, dh, passive, motion } = pose, c = renderer.c;
  const progress = !passive && entity.state === 'attack'
    ? motion ? motion.extension || 0 : Math.sin(Math.max(0, Math.min(1, (entity.attackTime || 0) / (entity.attackDuration || .4))) * Math.PI)
    : 0;
  c.save(); c.translate(progress * 3, 0);
  if (pose.local) { const stagger = localEnemyStagger(entity, motion, renderer.motionPreference?.matches); c.translate(stagger.x, 0); c.rotate(stagger.angle); }
  if (!passive && entity.state === 'telegraph') { c.rotate(-.045); c.translate(-5, 0); }
  if (entity.state === 'hurt') { if (!passive) c.rotate(-.085); c.filter = 'brightness(1.4)'; }
  if (!passive && entity.state === 'attack' && entity.attackKind === 'slam') c.scale(1, .91);
  if (entity.invuln > 0 && Math.floor(renderer.time * 20) % 2) c.globalAlpha *= .7;
  c.save(); clipSpriteFrame(c, frame, s, dx, dy, scale);
  renderer.drawLitSprite(entity, image, s.x, s.y, s.w, s.h, dx, dy, dw, dh); c.restore();
  if (progress > .4) {
    c.save(); c.translate(0, entity.isBoss ? -50 : -28); c.scale(entity.isBoss ? 1.35 : 1.15, entity.isBoss ? 1.35 : 1.15);
    renderer.attackArc(entity, progress); c.restore();
  }
  c.restore(); return true;
}
