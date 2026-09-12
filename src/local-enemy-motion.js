const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const LOCAL_ENEMY_IDS = Object.freeze(['frust', 'helmet', 'concrete', 'tunnel', 'shift', 'eco_guard', 'puffer', 'afterhour', 'selfie', 'finance', 'parking', 'hustle', 'ultra', 'queue', 'business', 'grill', 'festival', 'luxury', 'student', 'complaint']);
export const LOCAL_ENEMY_ASSETS = Object.freeze(LOCAL_ENEMY_IDS.map(id => 'enemies-local-' + id));
const localTypes = new Set(LOCAL_ENEMY_IDS);
export const isLocalEnemy = entity => localTypes.has(typeof entity === 'string' ? entity : entity?.enemyType || entity?.type);
export const LOCAL_ENEMY_GAIT_DISTANCE = 88;

/** Each identity owns all sixteen drawings; no original/counter sheet is shared. */
export function localEnemyMotion(entity) {
  if (!isLocalEnemy(entity)) return null;
  if (entity.state === 'dead' || entity.state === 'down') return { action: 'down', phase: 'down', index: 15 };
  if (entity.state === 'hurt') return { action: 'hurt', phase: 'hurt', index: 13 };
  if (entity.state === 'crouch') return { action: 'crouch', phase: 'crouch', index: 14 };
  if (entity.state === 'walk' && entity.walking && entity.walkSpeed > .01) {
    const distance = Number.isFinite(entity.walkDistance) ? Math.max(0, entity.walkDistance) : 0;
    const progress = distance / LOCAL_ENEMY_GAIT_DISTANCE;
    const phase = Math.floor(progress * 4) % 4;
    return { action: 'walk', phase, index: phase, gait: progress % 1 };
  }
  const kick = entity.attackKind === 'kick';
  const base = kick ? 8 : 4, action = kick ? 'kick' : 'punch';
  if (entity.state === 'telegraph') {
    const duration = entity.attackDuration || entity.telegraph || .7;
    const elapsed = clamp(duration - (entity.attackTime ?? duration), 0, duration);
    const winding = elapsed >= Math.min(.18, duration * .24);
    return { action, phase: winding ? kick ? 'lift' : 'windup' : 'guard', index: base + (winding ? 1 : 0), extension: 0 };
  }
  if (entity.state !== 'attack') return { action: 'idle', phase: 'guard', index: 12, extension: 0 };
  const duration = entity.attackDuration || .38;
  const elapsed = clamp(duration - (entity.attackTime ?? duration), 0, duration);
  const contact = clamp(entity.attackContactTime > 0 ? entity.attackContactTime : .08, 0, duration);
  const struck = entity.didStrike === true || entity.didStrike !== false && elapsed >= contact;
  if (!struck) return { action, phase: kick ? 'lift' : 'windup', index: base + 1, elapsed, extension: 0 };
  if (elapsed < contact + Math.min(.075, (duration - contact) * .3)) return { action, phase: 'contact', index: base + 2, elapsed, extension: 1 };
  if (elapsed < duration * .86) return { action, phase: kick ? 'retract' : 'recover', index: base + 3, elapsed, extension: 0 };
  return { action, phase: 'guard', index: base, elapsed, extension: 0 };
}

/** Grounded, distance-driven weight shifts with unequal lean; no idle clock sway. */
export function localEnemyStagger(entity, motion, reducedMotion = false) {
  const type = entity.enemyType || entity.type;
  if (reducedMotion || !['frust', 'afterhour'].includes(type) || motion?.action !== 'walk') return { x: 0, angle: 0 };
  const samples = [-.019, .009, .027, -.007, -.019];
  const at = motion.gait * 4, index = Math.min(3, Math.floor(at)), t = at - index;
  const smooth = t * t * (3 - 2 * t);
  const angle = samples[index] + (samples[index + 1] - samples[index]) * smooth;
  return { x: angle * (type === 'frust' ? 54 : 68), angle };
}
