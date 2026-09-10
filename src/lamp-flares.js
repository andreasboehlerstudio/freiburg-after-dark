const COLORS = { amber: '#ffc17a', red: '#ff5969', cyan: '#7cd4ee' };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function surface(width, height) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height; return canvas;
}

/** Slow, tiny variation in the practical, never a flicker/strobe. */
export function practicalLightStrength(light, time = 0, reducedMotion = false) {
  const phase = light.x * .013 + light.y * .009;
  return (light.strength ?? 1) * (reducedMotion ? 1 : 1 + .027 * Math.sin(time * .47 + phase) + .012 * Math.sin(time * .19 + phase * 1.7));
}

/** Keep a flare centered on the actual bulb, with a gentle viewport-edge fade. */
export function lampFlareGeometry(light, camera = 0, time = 0, reducedMotion = false) {
  if (light.type !== 'lamp') return null;
  const x = light.x - camera, strength = practicalLightStrength(light, time, reducedMotion);
  const width = 310 * Math.sqrt(clamp(light.strength ?? 1, .15, 1.2));
  const edge = clamp((x + 48) / 96, 0, 1) * clamp((1328 - x) / 96, 0, 1);
  if (edge < .001 || light.y < 80 || light.y > 690) return null;
  return { x, y: light.y, width, height: 42, alpha: clamp(.72 * strength * edge, 0, .82), kind: light.kind };
}

/** Cached optical streak: broad soft haze, narrow horizontal spear and small
 * vertical diffraction spike. Only three tiny canvases are ever allocated. */
export class LampFlares {
  constructor() { this.textures = new Map(); }
  texture(kind = 'amber') {
    if (this.textures.has(kind)) return this.textures.get(kind);
    const canvas = surface(512, 80), c = canvas?.getContext('2d');
    if (!c) return null;
    const color = COLORS[kind] || COLORS.amber;
    const ellipse = (rx, ry, opacity) => {
      c.save(); c.translate(256, 40); c.scale(rx, ry);
      const glow = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      glow.addColorStop(0, '#fff4e8'); glow.addColorStop(.08, color + 'cf');
      glow.addColorStop(.35, color + '42'); glow.addColorStop(1, color + '00');
      c.globalAlpha = opacity; c.fillStyle = glow; c.fillRect(-1, -1, 2, 2); c.restore();
    };
    ellipse(245, 14, .34); ellipse(256, 2.4, .94);
    ellipse(36, 30, .40); ellipse(3, 39, .30); ellipse(19, 4, .72);
    this.textures.set(kind, canvas); return canvas;
  }
  draw(context, lights, camera = 0, { time = 0, reducedMotion = false } = {}) {
    context.save(); context.globalCompositeOperation = 'screen';
    for (const light of lights) {
      const flare = lampFlareGeometry(light, camera, time, reducedMotion);
      if (!flare) continue;
      const texture = this.texture(flare.kind); if (!texture) continue;
      context.globalAlpha = flare.alpha;
      context.drawImage(texture, flare.x - flare.width / 2, flare.y - flare.height / 2, flare.width, flare.height);
    }
    context.restore();
  }
}

// Measured bulbs in the separate 1672 x 941 menu painting. Normalized source
// coordinates follow its 1290 x 728 destination, including the pointer offset.
export const MENU_LAMP_ART = [
  [.7524, .2508, 1], [.3254, .627, .78], [.9515, .4835, 1],
  [.8337, .5845, .80], [.7584, .6812, .46], [.3774, .7035, .48],
  [.4211, .7418, .30], [.4382, .7577, .24], [.5018, .7428, .26],
  [.5712, .744, .25], [.6945, .7407, .25], [.7488, .7439, .23],
];
export function menuLamps(offset = { x: 0, y: 0 }) {
  return MENU_LAMP_ART.map(([u, v, strength]) => ({
    x: -5 + offset.x * 2 + u * 1290, y: -4 + offset.y * 2 + v * 728,
    type: 'lamp', kind: 'amber', strength,
  }));
}
