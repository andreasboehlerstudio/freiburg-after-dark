import { WORLD_ART, worldArtSectionGeometry } from './world-art.js';
import { LEVELS } from './data.js';
import { LampFlares, practicalLightStrength } from './lamp-flares.js';

export const LIGHT_COLORS = Object.freeze({ amber: '#ffc17a', red: '#ff5969', cyan: '#7cd4ee' });
const KEYS = LEVELS.map(level => level.worldKey || (level.id === 'kajo' ? 'martinstor' : level.id));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// Measured against the eighteen actual PNGs. Coordinates identify visible bulbs
// and lit shop windows in SOURCE space; the same crop as world-art.js maps
// them into the continuous 4600 px world, including the final right crop.
export const SCENE_LIGHT_ART = {
  martinstor: [
    { size: [2170, 725], lights: [
      ['Hirsch / rote Fenster', .125, .625, 'red', 'window'],
      ['Buchhandlung', .29, .63, 'amber', 'window'],
      ['Laterne vor Konrad', .42, .40, 'amber', 'lamp'],
      ['Weinhandlung Konrad', .505, .64, 'amber', 'window'],
      ['Laterne vor Fischer', .678, .416, 'amber', 'lamp'],
      ['Bäckerei Fischer', .77, .64, 'amber', 'window'],
    ] },
    { size: [2172, 724], lights: [
      ['Mode / rote Vitrine', .052, .64, 'red', 'window'],
      ['Laterne am Kaufhaus', .252, .375, 'amber', 'lamp'],
      ['Kaufhaus / rote Vitrine', .327, .66, 'red', 'window'],
      ['Café Bellevue', .665, .65, 'amber', 'window'],
      ['Laterne am Wartehäuschen', .805, .374, 'amber', 'lamp'],
      ['Optik / Schaufenster', .89, .65, 'amber', 'window'],
      ['Blumen / rote Vitrine', .952, .65, 'red', 'window'],
    ] },
    { size: [2170, 725], lights: [
      ['Roter Hirsch', .073, .62, 'red', 'window'],
      ['Laterne am Bäcker', .219, .439, 'amber', 'lamp'],
      ['Wartehäuschen', .327, .62, 'amber', 'window'],
      ['Laterne an der Haltestelle', .402, .477, 'amber', 'lamp'],
      ['Tram / Innenraum', .655, .725, 'amber', 'window'],
      ['Hängelampe vor Martinstor', .735, .357, 'amber', 'lamp'],
      ['Zweite Hängelampe vor Martinstor', .796, .485, 'amber', 'lamp', .65],
      ['Laterne am Tor', .922, .70, 'amber', 'lamp', .65],
    ] },
  ],
  stuehlinger: [
    { size: [2172, 724], lights: [
      ['Zum Kessel / rote Fenster', .127, .59, 'red', 'window'],
      ['Laterne am Kessel', .224, .327, 'amber', 'lamp'],
      ['Kiosk / Leuchtstreifen', .344, .443, 'amber', 'window', .65],
      ['Laterne vor Waschsalon', .694, .29, 'amber', 'lamp'],
      ['Rote Haustür', .77, .62, 'red', 'window'],
      ['Waschsalon / rote Fenster', .88, .60, 'red', 'window'],
    ] },
    { size: [2172, 724], lights: [
      ['Laterne am Viadukt', .081, .32, 'amber', 'lamp'],
      ['Wandlampe am Eingang', .176, .47, 'amber', 'lamp', .65],
      ['Fahrradwerkstatt / Neon', .34, .54, 'cyan', 'window', 1.15, 270],
      ['Rote Werkstatttür', .545, .426, 'red', 'lamp', .8],
      ['Laterne am Bahndamm', .608, .23, 'amber', 'lamp'],
      ['Treppenlicht', .69, .339, 'amber', 'lamp', .7],
    ] },
    { size: [2060, 763], lights: [
      ['Bar / rote Fenster', .075, .56, 'red', 'window'],
      ['Laterne vor Radwerkstatt', .196, .273, 'amber', 'lamp'],
      ['Radwerkstatt / Fenster', .276, .60, 'amber', 'window'],
      ['Wandlampe am Backstein', .43, .50, 'amber', 'lamp', .7],
      ['Laterne an der Radstation', .522, .274, 'amber', 'lamp'],
      ['Radstation / rote Fenster', .61, .59, 'red', 'window'],
      ['Laterne an der Brücke', .823, .465, 'amber', 'lamp', .7],
      ['Laterne am rechten Brückenbogen', .926, .415, 'amber', 'lamp', .65],
      ['Laterne am rechten Weg', .982, .308, 'amber', 'lamp'],
    ] },
  ],
  park: [
    { size: [2172, 724], lights: [
      ['Parklaterne 1', .119, .45, 'amber', 'lamp'],
      ['Parklaterne 2', .383, .45, 'amber', 'lamp'],
      ['Parklaterne 3', .626, .45, 'amber', 'lamp'],
      ['Parklaterne 4', .918, .45, 'amber', 'lamp'],
    ] },
    { size: [2172, 724], lights: [
      ['Weglaterne 1', .051, .432, 'amber', 'lamp'],
      ['Weglaterne 2', .193, .432, 'amber', 'lamp'],
      ['Weglaterne 3', .382, .432, 'amber', 'lamp'],
      ['Weglaterne 4', .619, .432, 'amber', 'lamp'],
      ['Weglaterne 5', .798, .432, 'amber', 'lamp'],
      ['Weglaterne 6', .949, .432, 'amber', 'lamp'],
    ] },
    { size: [2172, 724], lights: [
      ['Laterne vor linkem Parkcafé', .038, .488, 'amber', 'lamp', .85],
      ['Laterne an der Bank', .131, .469, 'amber', 'lamp'],
      ['Laterne am Rasen', .224, .541, 'amber', 'lamp', .8],
      ['Laterne am Querweg', .424, .55, 'amber', 'lamp', .8],
      ['Laterne vor Brunnen', .477, .541, 'amber', 'lamp', .8],
      ['Laterne am hinteren Gartenweg', .343, .58, 'amber', 'lamp', .55],
      ['Laterne am hinteren Querweg', .536, .602, 'amber', 'lamp', .45],
      ['Laterne vor hinterem Pavillon', .611, .586, 'amber', 'lamp', .5],
      ['Laterne am hinteren Kirchweg', .667, .594, 'amber', 'lamp', .45],
      ['Laterne am Kirchplatz', .742, .559, 'amber', 'lamp', .85],
      ['Laterne am rechten Parkausgang', .888, .586, 'amber', 'lamp', .6],
      ['Laterne rechts der Kirche', .977, .545, 'amber', 'lamp'],
    ] },
  ],
  haslach: [
    { size: [2171, 724], lights: [
      ['Bäckerei / Schaufenster', 0.132, 0.552, 'amber', 'window'],
      ['Laterne vor Bäckerei', 0.18, 0.327, 'amber', 'lamp'],
      ['Laterne am Dorfbrunnen', 0.404, 0.327, 'amber', 'lamp'],
      ['Laterne vor Nahkauf', 0.648, 0.329, 'amber', 'lamp'],
      ['Nahkauf / rote Fenster', 0.764, 0.557, 'red', 'window'],
      ['Laterne an der Haltestelle', 0.851, 0.329, 'amber', 'lamp'],
      ['Haltestelle / Lichtstreifen', 0.909, 0.479, 'amber', 'window', 0.65],
    ] },
    { size: [2170, 725], lights: [
      ['Nahkauf / rote Fenster', 0.125, 0.605, 'red', 'window'],
      ['Laterne am alten Dorfhaus', 0.181, 0.341, 'amber', 'lamp'],
      ['Laterne am Übergang', 0.394, 0.371, 'amber', 'lamp'],
      ['Laterne am Wegweiser', 0.67, 0.348, 'amber', 'lamp'],
      ['Radwerkstatt / Glasfront', 0.806, 0.599, 'cyan', 'window', 1.1, 250],
      ['Laterne vor Post', 0.896, 0.352, 'amber', 'lamp'],
      ['Post / rote Fenster', 0.951, 0.619, 'red', 'window'],
    ] },
    { size: [2171, 724], lights: [
      ['Laterne am Wohnblock', 0.166, 0.395, 'amber', 'lamp'],
      ['Laterne am Quartierstreff', 0.45, 0.425, 'amber', 'lamp'],
      ['Quartierstreff / blaue Glasfront', 0.469, 0.625, 'cyan', 'window', 0.85, 220],
      ['Bugginger50 / Eingang', 0.761, 0.617, 'amber', 'window'],
      ['Laterne am Hochhaus', 0.823, 0.395, 'amber', 'lamp'],
    ] },
  ],
  wiehre: [
    { size: [2172, 724], lights: [
      ['Laterne am ersten Vorgarten', 0.12, 0.418, 'amber', 'lamp'],
      ['Laterne an der roten Villa', 0.447, 0.416, 'amber', 'lamp'],
      ['Laterne am dritten Garten', 0.668, 0.416, 'amber', 'lamp'],
      ['Laterne am rechten Wohnhaus', 0.876, 0.421, 'amber', 'lamp'],
      ['Roter Villeneingang', 0.374, 0.528, 'red', 'window', 0.85, 150],
      ['Linkes Wohnfenster', 0.077, 0.502, 'amber', 'window', 0.65, 145],
      ['Rechtes Wohnfenster', 0.912, 0.506, 'amber', 'window', 0.7, 155],
    ] },
    { size: [2172, 724], lights: [
      ['Laterne am Café', 0.12, 0.317, 'amber', 'lamp'],
      ['Laterne vor dem Kinofoyer', 0.43, 0.319, 'amber', 'lamp'],
      ['Laterne am Buchladen', 0.89, 0.315, 'amber', 'lamp'],
      ['Café / warme Fenster', 0.19, 0.523, 'amber', 'window', 0.95, 190],
      ['Kinofoyer / rote Tür', 0.534, 0.541, 'red', 'window', 1, 180],
      ['Buchladen / kühle Fenster', 0.774, 0.548, 'cyan', 'window', 1.05, 220],
    ] },
    { size: [2172, 724], lights: [
      ['Laterne am linken Marktstand', 0.149, 0.375, 'amber', 'lamp'],
      ['Laterne vor dem Bahnhof', 0.495, 0.373, 'amber', 'lamp'],
      ['Laterne am rechten Marktstand', 0.866, 0.374, 'amber', 'lamp'],
      ['Bahnhofscafé / warme Fenster', 0.365, 0.574, 'amber', 'window', 0.95, 190],
      ['Kommunales Kino / rotes Foyer', 0.649, 0.574, 'red', 'window', 1, 215],
      ['Rechter Bahnhofsflügel / Fenster', 0.815, 0.555, 'amber', 'window', 0.65, 160],
    ] },
  ],
  bermuda: [
    { size: [2169, 725], lights: [
      ['Drifter\'s Club / rote Glasfront', 0.208, 0.592, 'red', 'window', 1.05, 225],
      ['Drifter\'s Club / linke Wandlampe', 0.134, 0.513, 'red', 'lamp', 0.6, 145],
      ['Drifter\'s Club / rechte Wandlampe', 0.281, 0.518, 'red', 'lamp', 0.6, 145],
      ['Laterne vor Drifter\'s', 0.084, 0.378, 'amber', 'lamp'],
      ['Laterne am mittleren Altstadthaus', 0.499, 0.38, 'amber', 'lamp'],
      ['Kleine Bar / warme Fenster', 0.551, 0.603, 'amber', 'window', 0.8, 165],
      ['Laterne an der schmalen Gasse', 0.677, 0.487, 'amber', 'lamp', 0.7, 160],
      ['Laterne am rechten Altstadthaus', 0.871, 0.378, 'amber', 'lamp'],
      ['Rechte Bar / warme Fenster', 0.916, 0.611, 'amber', 'window', 0.75, 170],
    ] },
    { size: [2169, 725], lights: [
      ['Weinstube Löwen / Fenster', 0.132, 0.603, 'amber', 'window', 0.9, 185],
      ['Laterne an der Weinstube', 0.061, 0.361, 'amber', 'lamp'],
      ['EXIT / roter Clubeingang', 0.337, 0.623, 'red', 'window', 1.1, 225],
      ['Laterne neben EXIT', 0.427, 0.323, 'amber', 'lamp', 0.7, 160],
      ['AGAR / roter Clubeingang', 0.598, 0.623, 'red', 'window', 1.1, 240],
      ['Laterne neben AGAR', 0.694, 0.388, 'amber', 'lamp'],
      ['Schwarzer Kater / warme Fenster', 0.791, 0.603, 'amber', 'window', 0.9, 215],
      ['Wandlampe am rechten Eingang', 0.891, 0.539, 'amber', 'lamp', 0.65, 145],
    ] },
    { size: [2170, 725], lights: [
      ['Club Dreieck / roter Eingang', 0.128, 0.647, 'red', 'window', 1.1, 230],
      ['Club Dreieck / linke rote Wandlampe', 0.072, 0.516, 'red', 'lamp', 0.6, 145],
      ['Club Dreieck / rechte rote Wandlampe', 0.214, 0.521, 'red', 'lamp', 0.6, 145],
      ['Bar Löwen / warme Fenster', 0.293, 0.617, 'amber', 'window', 0.8, 175],
      ['Laterne vor Café Martin', 0.38, 0.41, 'amber', 'lamp'],
      ['Café Martin / warme Fenster', 0.44, 0.645, 'amber', 'window', 0.85, 170],
      ['Weinhaus Rebling / warme Fenster', 0.575, 0.643, 'amber', 'window', 0.8, 175],
      ['Laterne am Weinhaus', 0.701, 0.539, 'amber', 'lamp', 0.8, 170],
      ['Laterne vor Martinstor', 0.823, 0.611, 'amber', 'lamp', 0.8, 160],
      ['Laterne rechts vom Martinstor', 0.967, 0.571, 'amber', 'lamp', 0.85, 175],
    ] },
  ],
};

export function mapScenePoint(key, section, u, v) {
  const { size } = SCENE_LIGHT_ART[key][section];
  const geometry = worldArtSectionGeometry({ width: size[0], height: size[1] }, WORLD_ART[key][section]);
  const region = v < WORLD_ART[key][section].ground ? geometry.architecture : geometry.floor;
  const { source: s, destination: d } = region;
  const panelX = d.x + (u * size[0] - s.x) / s.width * d.width;
  const y = d.y + (v * size[1] - s.y) / s.height * d.height;
  // Later paintings cover the final 100 px of the preceding painting. Do
  // not relight a lamp that has been cropped out or covered by that overlap.
  const visible = panelX >= (section ? 55 : 0) && panelX < (section < 2 ? 1550 : 1600) && y >= 0 && y <= 720;
  return { key, section, x: section * 1500 + panelX, y, visible };
}

export function mapSceneLight(key, section, light) {
  const [name, u, v, kind, type, strength = 1, radius = type === 'lamp' ? 205 : 180] = light;
  return { ...mapScenePoint(key, section, u, v), name, kind, type,
    radius, verticalRadius: type === 'lamp' ? 460 : 330, strength };
}

const mapped = new Map();
export function sceneLights(level = 0) {
  const key = typeof level === 'string' && SCENE_LIGHT_ART[level] ? level : KEYS[level] || KEYS[0];
  if (!mapped.has(key)) mapped.set(key, SCENE_LIGHT_ART[key].flatMap((section, i) =>
    section.lights.map(light => mapSceneLight(key, i, light)).filter(light => light.visible)));
  return mapped.get(key);
}

/** Smooth compact falloff; outside a practical light's reach the tint is zero. */
export function lightAtPoint(light, x, y) {
  const nx = (x - light.x) / light.radius, ny = (y - light.y) / light.verticalRadius;
  const horizontal = Math.max(0, 1 - nx * nx);
  const vertical = Math.max(0, 1 - ny * ny);
  return clamp(light.strength * horizontal * horizontal * vertical, 0, 1);
}

/** At most two color contributions, independent of camera and facing. */
export function sampleSceneLighting(level, entity) {
  if (!Number.isFinite(entity?.x) || !Number.isFinite(entity?.y)) return [];
  const y = entity.y - Math.max(0, entity.z || 0) - (entity.isBoss ? 138 : 110);
  const colors = {};
  for (const light of sceneLights(level)) {
    const intensity = lightAtPoint(light, entity.x, y);
    if (intensity < .015) continue;
    const side = clamp((light.x - entity.x) / 90, -1, 1);
    const bucket = colors[light.kind] ||= { kind: light.kind, intensity: 0, side: 0 };
    bucket.intensity += intensity;
    bucket.side += side * intensity;
  }
  return Object.values(colors).map(light => ({ ...light, side: light.side / light.intensity,
    intensity: Math.min(.95, light.intensity) })).sort((a, b) => b.intensity - a.intensity).slice(0, 2);
}

function surface(width, height) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
  if (typeof document === 'undefined' || typeof CanvasRenderingContext2D === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height; return canvas;
}

/** Three small reusable gradient textures; no per-frame blur or readback. */
export class SceneLighting {
  constructor() { this.glows = new Map(); }
  glow(kind) {
    if (this.glows.has(kind)) return this.glows.get(kind);
    const canvas = surface(128, 128), c = canvas?.getContext('2d');
    if (!c) return null;
    const color = LIGHT_COLORS[kind];
    const gradient = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, color + 'b8');
    gradient.addColorStop(.22, color + '52');
    gradient.addColorStop(.56, color + '18');
    gradient.addColorStop(1, color + '00');
    c.fillStyle = gradient; c.fillRect(0, 0, 128, 128);
    this.glows.set(kind, canvas); return canvas;
  }
  draw(context, level, camera = 0, { time = 0, reducedMotion = false } = {}) {
    context.save();
    context.globalCompositeOperation = 'screen';
    for (const light of sceneLights(level)) {
      const x = light.x - camera;
      if (x < -light.radius || x > 1280 + light.radius) continue;
      const texture = this.glow(light.kind);
      if (!texture) continue;
      const strength = practicalLightStrength(light, time, reducedMotion);
      const lamp = light.type === 'lamp', rx = lamp ? 37 : 87, ry = lamp ? 37 : 52;
      context.globalAlpha = (lamp ? .34 : .20) * strength;
      context.drawImage(texture, x - rx, light.y - ry, rx * 2, ry * 2);
      // Broad but faint wet paving spill is centered beneath the real source.
      context.globalAlpha = (lamp ? .10 : .13) * strength;
      context.drawImage(texture, x - light.radius * .7, 465, light.radius * 1.4, 154);
    }
    context.restore();
    (this.flares ||= new LampFlares()).draw(context, sceneLights(level), camera, { time, reducedMotion });
  }
}
