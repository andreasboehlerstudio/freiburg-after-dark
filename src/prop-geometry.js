import { BAT_TIMING } from './data.js';
import { combatFrame } from './combat-animation.js';
import { HERO_GRIPS } from './hero-grips.js';

const clamp01 = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp01(value); return t*t*(3-2*t); };
export const BAT_SHAPE = Object.freeze({ gripX: 10, tipX: 108, halfWidth: 6.1 });
// Measured model extents of assets/props.json, relative to the flight center.
export const PROP_GEOMETRY = {
  bicycle: { ground: 34, centerX: 0, bounds: [-91.193798, -69.647287, 91.193799, 34.724806] },
  bat: { ground: 5, centerX: 46, bounds: [-54.191083, -6.063694, 62.267515, 5.439491] },
};
const geometry = PROP_GEOMETRY;

/** Follows the same source pose, foot registration and local lean as drawHero. */
export function heroGripPose(hero) {
  const meta = HERO_GRIPS[hero.heroId || hero.id];
  if (!meta) return { x: 10, y: -155, rotation: 0, sheet: 'fallback', index: 0 };
  const combat = combatFrame(hero);
  if (combat) {
    const index = combat.index + (combat.action === 'kick' ? 8 : 0);
    let [x, y] = meta.combat[index], rotation = 0;
    if (hero.attackKind === 'jump-kick') {
      const extension = combat.index <= 5 ? 1 : (7-combat.index)/2;
      rotation = -.14*extension;
      [x,y] = [x*Math.cos(rotation)-y*Math.sin(rotation)+9*extension,x*Math.sin(rotation)+y*Math.cos(rotation)+7*extension];
    }
    return { x, y, rotation, sheet: 'combat', index };
  }
  if (hero.state === 'walk' && hero.walking && !(hero.z > 0)) {
    const cycle = meta.cycleDistance, distance = ((hero.walkDistance || 0)%cycle+cycle)%cycle;
    const index = Math.floor(distance/cycle*8), [x,y] = meta.walk[index];
    return { x, y, rotation: 0, sheet: 'walk', index };
  }
  let index = 0;
  if (hero.state === 'attack') index = ['heavy','special','finisher'].includes(hero.attackKind) || hero.comboStep === 3 ? 4 : 3;
  if (hero.z > 12) index = 5;
  if (hero.state === 'special') index = 4;
  if (hero.state === 'hurt') index = 1;
  let [x,y] = meta.base[index], rotation = hero.state === 'hurt' ? -.08 : hero.state === 'dodge' ? .2 : 0;
  if (hero.state === 'dodge') y *= .87;
  [x,y] = [x*Math.cos(rotation)-y*Math.sin(rotation),x*Math.sin(rotation)+y*Math.cos(rotation)];
  const attack = hero.state === 'attack' ? Math.sin(clamp01((hero.attackTime||0)/(hero.attackDuration||.4))*Math.PI) : 0;
  x += attack*7-attack*.035*y;
  return { x, y, rotation, sheet: 'base', index };
}

/** Smooth anticipation, horizontal contact plateau and return to ready angle. */
export function batSwingAngle(elapsed, duration = BAT_TIMING.duration, contact = BAT_TIMING.contact) {
  const end = Math.max(contact+.01,duration), recovery = end-contact;
  const keys = [[0,-1.15],[contact*.42,-1.95],[contact,0],[contact+recovery*.15,0],[contact+recovery*.36,.28],[end,-1.15]];
  const t = Math.max(0,Math.min(end,elapsed));
  for (let i=1;i<keys.length;i++) if(t<=keys[i][0]) {
    const [start,a]=keys[i-1],[stop,b]=keys[i]; return a+(b-a)*smooth((t-start)/(stop-start));
  }
  return -1.15;
}

/** Pose of the original vector drawing in the facing hero's local space. */
export function heldPropPose(hero) {
  const type = hero.heldItem?.type;
  if (!geometry[type]) return null;
  const progress = hero.state === 'attack' && hero.attackDuration > 0
    ? clamp01(1 - hero.attackTime / hero.attackDuration) : 0;
  if (type === 'bicycle') return {
    x: 8 + progress * 45, y: -145 - Math.sin(progress * Math.PI) * 28,
    rotation: -.15 + progress * .4, scale: .92, trail: false,
  };
  const swing = hero.attackKind === 'bat' && hero.state === 'attack';
  const grip = heroGripPose(hero), elapsed = hero.attackDuration-hero.attackTime;
  const readyAngle = grip.sheet === 'walk' || hero.state === 'hurt' ? .45 : -1.15;
  const rotation = (swing ? batSwingAngle(elapsed,hero.attackDuration,hero.attackContactTime||BAT_TIMING.contact) : readyAngle) + grip.rotation;
  return {
    x: grip.x-Math.cos(rotation)*BAT_SHAPE.gripX, y: grip.y-Math.sin(rotation)*BAT_SHAPE.gripX,
    rotation, gripX: grip.x, gripY: grip.y, gripSheet: grip.sheet, gripFrame: grip.index,
    scale: 1, trail: swing && elapsed >= BAT_TIMING.contact*.55 && elapsed < BAT_TIMING.contact+.1,
  };
}

/** Used by the engine and visual QA: reach is the painted tip at contact. */
export function batStrikeReach(hero) {
  const pose = heldPropPose({ ...hero, hp: Math.max(1,hero.hp||1), heldItem:{type:'bat'}, state:'attack', attackKind:'bat',
    z:0,vz:0,attackDuration:BAT_TIMING.duration,attackTime:BAT_TIMING.duration-BAT_TIMING.contact,attackContactTime:BAT_TIMING.contact,didStrike:true });
  return pose.x+Math.cos(pose.rotation)*BAT_SHAPE.tipX*pose.scale;
}

/** The projectile starts at exactly the held object's center and orientation. */
export function releasedPropPose(hero) {
  const type = hero.heldItem?.type, pose = heldPropPose(hero);
  if (!pose) return null;
  const facing = hero.attackFacing ?? hero.facing ?? 1, shape = geometry[type];
  const x = pose.x + Math.cos(pose.rotation) * shape.centerX * pose.scale;
  const y = pose.y + Math.sin(pose.rotation) * shape.centerX * pose.scale;
  return {
    x: hero.x + facing * x, y: hero.y,
    z: (hero.z || 0) - y - shape.ground * pose.scale,
    rotation: facing * pose.rotation, facing, visualScale: pose.scale,
  };
}

export function worldPropPose(prop) {
  const shape = geometry[prop.type], scale = prop.visualScale || 1;
  return {
    x: prop.x, y: prop.y - (prop.z || 0) - shape.ground * scale,
    rotation: prop.rotation || (prop.state === 'ground' && prop.type === 'bat' ? -.1 : 0),
    facing: prop.facing || 1, scale, centerX: shape.centerX,
  };
}

/** Physical height interval follows the same rotated body as the drawing. */
export function propHeightRange(prop) {
  const pose = worldPropPose(prop), [left, top, right, bottom] = geometry[prop.type].bounds;
  const sin = Math.sin(pose.rotation), cos = Math.cos(pose.rotation);
  const offsets = [left, right].flatMap(x => [top, bottom].map(y =>
    (x * pose.facing * sin + y * cos) * pose.scale));
  const center = prop.y - pose.y;
  return { bottom: center - Math.max(...offsets), top: center - Math.min(...offsets) };
}
