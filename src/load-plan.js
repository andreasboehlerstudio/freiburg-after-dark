import { HEROES, LEVELS } from './data.js';
import { ENEMY_ART } from './enemy-sprites.js';
import { ENEMY_MOTION_ASSETS, ENEMY_COUNTER_ASSETS } from './enemy-motion.js';
import { LOCAL_ENEMY_ASSETS, isLocalEnemy } from './local-enemy-motion.js';
import { NIGHTLIFE_CAMEO_PLACEMENTS } from './nightlife-cameos.js';
import { WORLD_ART } from './world-art.js';

const groups = { enemies: 'original', bosses: 'bosses', 'enemies-night-a': 'night-a', 'enemies-night-b': 'night-b' };
const kickTypes = new Set(['suit', 'runner', 'civic', 'eco']);
export function selectionPlan() {
  return { images: Object.keys(HEROES), metadata: ['heroes'], worlds: [] };
}
export function levelPlan(levelIndex, heroIds) {
  const level = LEVELS[levelIndex];
  if (!Number.isInteger(levelIndex) || !level || !Array.isArray(heroIds) || heroIds.length < 2 || heroIds.length > 4 || heroIds.some(id => !Object.hasOwn(HEROES, id)) || new Set(heroIds).size !== heroIds.length) throw new Error('Invalid team or level');
  const images = new Set(['props', 'street-car']);
  const metadata = new Set(['heroes', 'walk', 'combat', 'props', 'street-car']);
  for (const cameo of NIGHTLIFE_CAMEO_PLACEMENTS[level.id] || []) {
    images.add(cameo.id === 'ticket' ? 'cameo-ticket' : 'nightlife-cameos'); metadata.add('nightlife-cameos');
  }
  for (const id of heroIds) for (const prefix of ['', 'walk-', 'combat-']) images.add(prefix + id);
  const addEnemy = (type, boss = false) => {
    if (type === 'bouncer') { images.add('bouncer'); metadata.add('bouncer'); return; }
    const entry = type === 'enforcer' && boss ? ['bosses', 2, 'mafia'] : ENEMY_ART[type];
    if (!entry) throw new Error('Unknown enemy artwork: ' + type);
    const [sheet, , key] = entry, group = groups[sheet];
    images.add(sheet); metadata.add(sheet);
    if (isLocalEnemy(type)) return;
    if (type === 'protester') return;
    for (const name of ['steps-' + group, 'counter-' + key]) { images.add(name); metadata.add(name); }
    // Walking uses a registered anchor from motion metadata even without kicks.
    metadata.add('motion-' + group);
    if (kickTypes.has(type)) images.add('motion-' + group);
  };
  for (const type of level.enemyRoster) addEnemy(type);
  // Street residents can occur independently of the combat roster.
  addEnemy('protester');
  addEnemy(level.bossType, true);
  return { images: [...images], metadata: [...metadata], worlds: [level.worldKey] };
}

/** Preserved for the existing animation and world preview pages. */
export function fullPlan() {
  return {
    images: [...LOCAL_ENEMY_ASSETS, ...ENEMY_MOTION_ASSETS, ...ENEMY_COUNTER_ASSETS, ...Object.keys(HEROES).flatMap(id => [id, 'walk-' + id, 'combat-' + id]), 'enemies', 'enemies-night-a', 'enemies-night-b', 'bosses', 'bouncer', 'props', 'street-car', 'nightlife-cameos', 'cameo-ticket'],
    metadata: [...LOCAL_ENEMY_ASSETS, ...ENEMY_MOTION_ASSETS, ...ENEMY_COUNTER_ASSETS, 'heroes', 'enemies', 'enemies-night-a', 'enemies-night-b', 'bosses', 'bouncer', 'props', 'street-car', 'walk', 'combat', 'nightlife-cameos'],
    worlds: Object.keys(WORLD_ART),
  };
}
