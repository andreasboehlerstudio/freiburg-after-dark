import { LEVELS } from './data.js';
import { propHint } from './world-props.js';

const RED = '#d93643', WHITE = '#eeeae5', GRAY = '#b2b1b7';
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const points = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

function text(c, value, x, y, size = 18, color = WHITE, align = 'left', display = true, maxWidth) {
  c.fillStyle = color;
  c.font = display ? `${size}px "Freiburg Display",Impact,sans-serif` : `${size}px Arial,sans-serif`;
  c.textAlign = align;
  c.textBaseline = 'alphabetic';
  const content = String(value).toUpperCase();
  if (maxWidth) c.fillText(content, x, y, maxWidth);
  else c.fillText(content, x, y);
}

function line(c, x, y, width, color = '#ffffff28', height = 1) {
  c.fillStyle = color;
  c.fillRect(x, y, width, height);
}

function health(c, x, y, width, ratio, height = 5, trail = 0) {
  const fill = width * clamp(ratio);
  line(c, x, y, width, '#ded9d31d', height);
  if (trail > ratio) line(c, x, y, width * clamp(trail), '#d9aaab85', height);
  if (fill > 0) {
    line(c, x, y, fill, RED, height);
    line(c, x + Math.max(0, fill - 1), y, Math.min(1, fill), '#ffc4c5', height);
  }
}

function fade(c, top = false) {
  const gradient = c.createLinearGradient(0, top ? 0 : 540, 0, top ? 175 : 720);
  gradient.addColorStop(0, top ? '#06070bbb' : '#06070b00');
  gradient.addColorStop(1, top ? '#06070b00' : '#06070bd9');
  c.fillStyle = gradient;
  c.fillRect(0, top ? 0 : 540, 1280, top ? 175 : 180);
}

export function drawEditorialHud(renderer) {
  const c = renderer.c, g = renderer.game, heroes = renderer.heroes();
  c.save();
  fade(c, true);
  fade(c);
  renderer.healthTrail ||= new Map();

  heroes.forEach((hero, index) => {
    const coop = g.cooperative, partner = !coop && index > 0;
    const x = coop ? 40 + index * 240 : 40, width = coop ? 210 : 258;
    const baseline = partner ? 106 : 49;
    const y = partner ? 115 : 60, height = partner ? 3 : 5;
    const ratio = clamp(hero.hp / (hero.maxHp || 100));
    const key = hero.uid ?? `hero-${index}`;
    const trail = renderer.healthTrail.get(key) || { value: ratio, time: renderer.time };
    trail.value = ratio >= trail.value ? ratio : Math.max(ratio, trail.value - Math.max(0, renderer.time - trail.time) * .42);
    trail.time = renderer.time;
    renderer.healthTrail.set(key, trail);
    text(c, hero.name || renderer.heroId(hero), x, baseline, partner ? 16 : coop ? 21 : 25, partner ? '#d5cfd0' : WHITE, 'left', true, width - 28);
    text(c, partner ? 'KI' : `${index + 1}P`, x + width, baseline - 1, partner ? 8 : 9, partner ? GRAY : RED, 'right', false);
    health(c, x, y, width, ratio, height, trail.value);
    line(c, x, y + height + 7, width * clamp(hero.energy / (hero.maxEnergy || 100)), '#d4c7bf8f');
    if (coop) text(c, hero.hp <= 0 ? 'AM BODEN · HILFE' : hero.heldItem ? 'GEGENSTAND BEREIT' : 'ENERGIE', x, 87, 8, hero.hp <= 0 ? RED : GRAY, 'left', false, width);
  });
  if (g.cooperative) text(c, `${g.rescues || 0} TEAM-RESERVEN`, 40, 110, 9, GRAY, 'left', false);
  else line(c, 40, 146, 258);

  text(c, points.format(g.score ?? g.state?.score ?? 0), 1238, 50, 29, WHITE, 'right', true, 230);
  text(c, 'PUNKTE', 1238, 68, 9, GRAY, 'right', false);

  const level = g.level || LEVELS[renderer.levelIndex()];
  const wave = g.wave ?? g.state?.wave ?? 1;
  const waves = level?.waves?.[g.arena?.index ?? 0]?.length;
  text(c, `LEVEL ${renderer.levelIndex() + 1} / ${LEVELS.length} · ${level?.name || 'FREIBURG'}`, 42, 668, 14, WHITE, 'left', true, 355);
  text(c, g.arena?.cleared ? 'WEG FREI' : `WELLE ${wave}${waves ? ' / ' + waves : ''}`, 42, 686, 9, GRAY, 'left', false);

  const combo = g.combo ?? g.state?.combo ?? 0;
  const count = typeof combo === 'object' ? combo.count : combo;
  if (renderer.lastCombo !== count) {
    renderer.lastCombo = count;
    renderer.comboPulseAt = renderer.time;
  }
  if (count > 1) {
    const pulse = 1 + Math.max(0, 1 - (renderer.time - renderer.comboPulseAt) / .18) * .04;
    c.save();
    c.translate(1238, 656);
    c.scale(pulse, pulse);
    text(c, String(count).padStart(2, '0'), 0, 0, 37, WHITE, 'right', true, 175);
    c.restore();
    text(c, 'TREFFER', 1238, 673, 9, RED, 'right', false);
  }

  if (g.announcement && g.announcementTime > 0) {
    c.save();
    c.globalAlpha = clamp(g.announcementTime * 2);
    text(c, String(g.announcement).replace(/^\d+\s*·\s*/, ''), 640, g.cooperative ? 127 : 48, 19, WHITE, 'center', true, 450);
    line(c, 625, g.cooperative ? 140 : 61, 30, RED, 2);
    c.restore();
  }

  const boss = renderer.entities().find(entity => entity.isBoss && entity.hp > 0);
  if (boss) {
    text(c, boss.name || 'VIERTELBOSS', 420, 650, 16, WHITE, 'left', true, 355);
    text(c, 'BOSS', 860, 649, 8, RED, 'right', false);
    health(c, 420, 662, 440, boss.hp / (boss.maxHp || 1), 4);
  }

  if (g.mode === 'playing') {
    const down = heroes.filter(hero => hero.hp <= 0).sort((a, b) => (b.rescueProgress || 0) - (a.rescueProgress || 0))[0];
    const live = heroes.find(hero => hero.hp > 0);
    if (down && live && (g.cooperative || down.isPartner || g.rescues > 0)) {
      text(c, g.cooperative ? `${down.playerIndex + 1}P AM BODEN · E / O / LB HALTEN ZUM WIEDERBELEBEN` : down.isPartner ? 'BEIM PARTNER E HALTEN · WIEDERBELEBEN' : 'DEIN PARTNER KOMMT ZUR HILFE', 640, 610, 12, WHITE, 'center', true, 500);
      health(c, 490, 620, 300, down.rescueProgress / (g.cooperative ? 2.4 : down.isPartner ? 12 : 2.8), 2);
    } else if (!down) {
      const hint = propHint(renderer);
      if (hint) {
        text(c, hint, 640, 620, 12, WHITE, 'center', true, 450);
        line(c, 625, 630, 30, RED);
      }
    }
  }
  text(c, 'FREIBURG AFTER DARK', 640, 695, 10, '#c7bdbb9f', 'center');
  c.restore();
}

export function drawEditorialNumber(renderer, fx, x, y, life) {
  const c = renderer.c;
  const baseline = y - (1 - life) * 32;
  c.save();
  c.shadowColor = '#000b';
  c.shadowBlur = 7;
  text(c, fx.text || '', x, baseline, fx.kind === 'number' ? 23 : 18, fx.color === '#ff8d90' ? '#f17178' : WHITE, 'center');
  c.shadowBlur = 0;
  line(c, x - 10, baseline + 8, 20, RED, 2);
  c.restore();
}
