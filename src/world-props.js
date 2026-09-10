import { heldPropPose, worldPropPose } from './prop-geometry.js';
import { clipSpriteFrame } from './combat-animation.js';
const INK = '#10141b';

function stroke(c, points, color, width) {
  c.beginPath();
  points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
}

/** Small physical props use native vector geometry at any display resolution. */
export function paintProp(c, type, { worn = false, renderer } = {}) {
  const image = renderer?.assets?.props, meta = renderer?.propMetadata;
  const art = meta?.props?.[type] || meta?.[type];
  if (image && art?.source && art.sourceAnchor && art.modelAnchor && art.pixelsPerUnit > 0) {
    const s = art.source, scale = 1/art.pixelsPerUnit;
    const dx = art.modelAnchor.x+(s.x-art.sourceAnchor.x)*scale;
    const dy = art.modelAnchor.y+(s.y-art.sourceAnchor.y)*scale;
    c.save(); clipSpriteFrame(c,art,s,dx,dy,scale);
    c.drawImage(image,s.x,s.y,s.w,s.h,dx,dy,s.w*scale,s.h*scale); c.restore(); return;
  }
  c.save();
  if (type === 'bicycle') {
    for (const x of [-65, 65]) {
      c.beginPath(); c.ellipse(x, 0, 33, 33, 0, 0, Math.PI * 2);
      c.fillStyle = '#17212bcc'; c.fill(); c.strokeStyle = INK; c.lineWidth = 8; c.stroke();
      c.strokeStyle = '#b5c7ca'; c.lineWidth = 2; c.stroke();
      for (let i = 0; i < 10; i++) {
        const a = i * Math.PI / 5;
        stroke(c, [[x, 0], [x + Math.cos(a) * 29, Math.sin(a) * 29]], '#6d7f86', .8);
      }
      c.beginPath(); c.arc(x, 0, 4, 0, Math.PI * 2); c.fillStyle = '#e1e4de'; c.fill();
    }
    const frame = [[-65, 0], [-35, -49], [0, 0], [-65, 0], [32, -48], [0, 0], [32, -48], [65, 0]];
    stroke(c, frame, INK, 10); stroke(c, frame, worn ? '#a35757' : '#df2336', 5);
    stroke(c, [[-35, -49], [32, -48]], INK, 9); stroke(c, [[-35, -49], [32, -48]], '#f1444d', 4);
    stroke(c, [[-35, -48], [-39, -64]], '#a8b6b9', 4);
    stroke(c, [[-53, -65], [-27, -65]], INK, 8);
    stroke(c, [[32, -48], [26, -76], [38, -82], [51, -81]], '#bdc9cb', 5);
    stroke(c, [[41, -81], [53, -81]], INK, 7);
    stroke(c, [[0, 0], [13, 12], [25, 12]], '#cfced0', 4);
    stroke(c, [[-67, -39], [-91, -39]], '#93a3a9', 3);
    stroke(c, [[-87, -38], [-76, -5]], '#93a3a9', 2);
    c.fillStyle = '#ffb052'; c.fillRect(48, -42, 8, 5);
  } else {
    // Handle at the origin, barrel extends along +X: the same pivot works in hand and in flight.
    c.beginPath(); c.moveTo(-6, -4); c.lineTo(22, -4); c.bezierCurveTo(39, -5, 45, -12, 66, -12);
    c.lineTo(97, -12); c.quadraticCurveTo(108, -10, 108, 0); c.quadraticCurveTo(108, 10, 97, 12);
    c.lineTo(66, 12); c.bezierCurveTo(45, 12, 39, 5, 22, 4); c.lineTo(-6, 4); c.closePath();
    const wood = c.createLinearGradient(0, -12, 0, 12);
    wood.addColorStop(0, '#f4d3a0'); wood.addColorStop(.4, '#c99055'); wood.addColorStop(1, '#714530');
    c.fillStyle = wood; c.fill(); c.strokeStyle = INK; c.lineWidth = 3; c.stroke();
    stroke(c, [[43, -4], [95, -5]], '#ecc690', 1.5);
    for (let x = -4; x < 24; x += 5) stroke(c, [[x, -4], [x + 3, 4]], '#35363d', 4);
    stroke(c, [[-7, -6], [-7, 6]], '#dad4c9', 4);
  }
  c.restore();
}

export function drawPropShadow(renderer, prop) {
  if (!['ground', 'thrown'].includes(prop.state)) return;
  const c = renderer.c, x = prop.x - renderer.camera;
  if (x < -180 || x > 1460) return;
  c.save(); c.translate(x, prop.y);
  c.beginPath(); c.ellipse(0, 4, prop.type === 'bicycle' ? 93 : 53, 10, 0, 0, Math.PI * 2);
  c.fillStyle = prop.state === 'thrown' ? '#03060c42' : '#03060c75'; c.fill(); c.restore();
}

export function drawWorldProp(renderer, prop) {
  if (!['ground', 'thrown'].includes(prop.state)) return;
  const c = renderer.c, x = prop.x - renderer.camera;
  if (x < -180 || x > 1460) return;
  const pose = worldPropPose(prop), flying = prop.state === 'thrown';
  c.save(); c.translate(x, pose.y); c.rotate(pose.rotation);
  c.scale(pose.facing * pose.scale, pose.scale); c.translate(-pose.centerX, 0);
  if (flying) {
    c.save(); c.globalAlpha = .16; c.translate(-32, 0); paintProp(c, prop.type, { renderer }); c.restore();
  }
  paintProp(c, prop.type, { renderer }); c.restore();
}

export function drawWorldProps(renderer, flying) {
  for (const prop of renderer.game.props || []) {
    if ((prop.state === 'thrown') !== flying || !['ground', 'thrown'].includes(prop.state)) continue;
    drawPropShadow(renderer, prop); drawWorldProp(renderer, prop);
  }
}

export function drawHeldProp(renderer, hero) {
  const item = hero.heldItem;
  if (!item || hero.hp <= 0) return;
  const c = renderer.c, pose = heldPropPose(hero);
  c.save();
  c.translate(pose.x, pose.y); c.rotate(pose.rotation); c.scale(pose.scale, pose.scale);
  if (pose.trail) {
    c.save(); c.globalAlpha = .18; c.rotate(-.15); paintProp(c, 'bat', { renderer }); c.restore();
  }
  paintProp(c, item.type, { renderer });
  c.restore();
  // Put the original knuckles over the handle; the bat now passes through the
  // closed grip instead of covering it with an unrelated wooden rectangle.
  if (item.type === 'bat') renderer.drawHeroGrip?.(hero, pose);
}

export function propHint(renderer) {
  const { player, partner, mode } = renderer.game;
  if (!player || player.hp <= 0 || mode !== 'playing') return;
  if (partner?.state === 'down' && Math.abs(partner.x - player.x) < 95 && Math.abs(partner.y - player.y) < 55) return;
  const item = player.heldItem;
  const nearby = item || (renderer.game.props || []).find(prop => prop.state === 'ground' && Math.abs(prop.x - player.x) < 90 && Math.abs(prop.y - player.y) < 55);
  if (!nearby) return;
  const text = item ? (item.type === 'bat' ? 'J SCHLAGEN · E WERFEN' : 'E / J FAHRRAD WERFEN') : `E ${nearby.type === 'bat' ? 'BASEBALLSCHLÄGER' : 'FAHRRAD'} AUFHEBEN`;
  return text;
}
