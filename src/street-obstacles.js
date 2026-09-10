import { clipSpriteFrame } from './combat-animation.js';
import { LIGHT_COLORS } from './scene-lighting.js';

export const CAR_WIDTHS = Object.freeze({ compact: 300, luxury: 360 });
export function carDamageFrame(car) {
  if (car.hp <= 0) return 2;
  return car.hp <= (car.maxHp || car.hp) * .5 ? 1 : 0;
}

/** A vehicle's three damage states share a scale and ground contact anchor. */
export function carSpritePose(renderer, car) {
  if (car.kind !== 'car') return null;
  const image = renderer.assets['street-car'], metadata = renderer.carMetadata;
  const model = car.model === 'luxury' ? 'luxury' : 'compact';
  const vehicle = metadata?.vehicles?.[model];
  const index = carDamageFrame(car), frame = vehicle?.frames?.[index];
  if (!image || !frame) return null;
  const columns = metadata.columns || 3, rows = metadata.rowsCount || metadata.rows || 2;
  const cw = image.width / columns, ch = image.height / rows, row = vehicle.row ?? (model === 'luxury' ? 1 : 0);
  const b = frame.bounds, source = frame.source || (b && { x: index * cw + b.x, y: row * ch + b.y, w: b.w, h: b.h });
  const idle = vehicle.frames[0], reference = idle.bounds || idle.source;
  if (!source || !reference) return null;
  const scale = CAR_WIDTHS[model] / (vehicle.referenceWidth || reference.w);
  const localX = b?.x ?? source.x - index * cw, localY = b?.y ?? source.y - row * ch;
  const anchor = frame.anchor || vehicle.anchor || { x: cw / 2, y: (idle.bounds?.y ?? idle.source.y - row * ch) + reference.h };
  const absolute = frame.sourceAnchor;
  const dx = (absolute ? source.x - absolute.x : localX - anchor.x) * scale;
  const dy = (absolute ? source.y - absolute.y : localY - anchor.y) * scale;
  if (![source.x, source.y, source.w, source.h, dx, dy, scale].every(Number.isFinite) || scale <= 0 || source.w <= 0 || source.h <= 0 || source.x < 0 || source.y < 0 || source.x + source.w > image.width || source.y + source.h > image.height) return null;
  return { image, frame, source, index, model, scale, dx, dy, dw: source.w * scale, dh: source.h * scale };
}

function visible(renderer, car) {
  const x = car.x - renderer.camera, half = (CAR_WIDTHS[car.model] || CAR_WIDTHS.compact) * .65;
  return Number.isFinite(x) && Number.isFinite(car.y) && x > -half && x < 1280 + half;
}

export function drawCarShadow(renderer, car) {
  if (car.kind !== 'car' || !visible(renderer, car)) return;
  const c = renderer.c, x = car.x - renderer.camera, width = CAR_WIDTHS[car.model] || CAR_WIDTHS.compact;
  const ellipse = (px, y, rx, ry, fill) => { c.beginPath(); c.ellipse(px, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); };
  c.save();
  ellipse(x, car.y + 5, width * .48, 17, '#02050b45');
  ellipse(x, car.y + 2, width * .43, 9, '#01030975');
  for (const sign of [-1, 1]) ellipse(x + sign * width * .3, car.y + 1, width * .075, 4, '#010207b8');
  for (const light of renderer.lightsFor?.(car) || []) {
    if (!LIGHT_COLORS[light.kind]) continue;
    c.save(); c.globalAlpha *= light.intensity * .2;
    ellipse(x + (light.side || 0) * width * .16, car.y + 12, width * .24, 1.4, LIGHT_COLORS[light.kind]); c.restore();
  }
  c.restore();
}

export function drawStreetCar(renderer, car) {
  if (!visible(renderer, car)) return false;
  const pose = carSpritePose(renderer, car);
  if (!pose) return false;
  const c = renderer.c, { image, frame, source: s, scale, dx, dy, dw, dh } = pose;
  c.save(); c.translate(car.x - renderer.camera, car.y);
  clipSpriteFrame(c, frame, s, dx, dy, scale);
  renderer.drawLitSprite(car, image, s.x, s.y, s.w, s.h, dx, dy, dw, dh); c.restore();
  if (car.hp > 0 && car.hp < car.maxHp) renderer.bar(car.x - renderer.camera - 38, car.y + dy - 12, 76, 3, car.hp / car.maxHp, '#d93643');
  return true;
}
