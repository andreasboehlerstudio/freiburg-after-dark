import { clipSpriteFrame } from './combat-animation.js';

const MOVES = [
  ['01', 'BEWEGEN', '<kbd>WASD</kbd><span>/</span><kbd>↑ ← ↓ →</kbd>', 'Stick / Steuerkreuz', 'walk', 2],
  ['02', 'SCHLAG & COMBO', '<kbd>J</kbd>', 'Gamepad X', 'combat', 3],
  ['03', 'SCHWERER TRITT', '<kbd>K</kbd>', 'Gamepad Y', 'combat', 11],
];

/** The briefing reuses decoded menu art and the selected fighter's real frames. */
export class StartTutorial {
  constructor(canvas, renderer, menuScene) {
    this.canvas = canvas; this.renderer = renderer; this.menuScene = menuScene;
    this.active = false; this.dirty = true;
  }
  html() {
    return `<section class="start-tutorial" aria-labelledby="tutorial-title">
      <header class="tutorial-header"><canvas class="tutorial-logo" role="img" aria-label="Freiburg After Dark"></canvas><div><p class="tutorial-eyebrow">BEVOR DIE NACHT BEGINNT</p><h1 id="tutorial-title">DEIN ERSTER SCHLAG.</h1><p class="tutorial-subtitle">Drei Moves. Dann gehört dir die Straße.</p></div></header>
      <div class="tutorial-moves">${MOVES.map(([number, title, keys, pad], i) => `<article class="tutorial-move"><div class="tutorial-move-title"><span>${number}</span><h2>${title}</h2></div><div class="tutorial-key-row">${keys}<small>${pad}</small></div><canvas data-tutorial-pose="${i}" role="img" aria-label="${title.toLowerCase()}: dein gewählter Kämpfer"></canvas></article>`).join('')}</div>
      <div class="tutorial-extras">${[['SPRINGEN','LEERTASTE','A'],['AUSWEICHEN','SHIFT','B'],['SPEZIAL','L','RB · 45 ENERGIE'],['AUFHEBEN / WERFEN','E','LB']].map(([title,key,pad])=>`<div><h3>${title}</h3><p><kbd>${key}</kbd><span>/ ${pad}</span></p></div>`).join('')}</div>
      <footer class="tutorial-footer"><div><p class="tutorial-tip">SPRUNGTRITT: IN DER LUFT J ODER K.</p><p class="tutorial-team">DEIN SIDEKICK KÄMPFT AUTOMATISCH.</p><p class="tutorial-utilities"><button data-action="tutorial-back">← Zurück <span>ESC</span></button><span>IM SPIEL: ESC PAUSE · F VOLLBILD</span></p></div><button class="tutorial-start" data-action="tutorial-start">VERSTANDEN. LOS GEHT’S.<kbd>ENTER / A</kbd></button></footer>
    </section>`;
  }
  begin(heroId, { cooperative = false, humanCount = 1 } = {}) {
    this.heroId = heroId; this.active = true; this.dirty = true;
    this.root = document.querySelector('.start-tutorial');
    if (!this.root) return;
    this.menuScene.drawLogo(this.root.querySelector('.tutorial-logo'));
    this.root.querySelector('.tutorial-team').textContent = cooperative
      ? `${humanCount} SPIELER · ZUSAMMENBLEIBEN · E / LB ZUM WIEDERBELEBEN HALTEN.`
      : 'DEIN SIDEKICK KÄMPFT AUTOMATISCH.';
    this.root.querySelector('[data-action="tutorial-start"]')?.focus({ preventScroll: true });
    this.drawPoses(); this.render(0);
  }
  drawPoses() {
    this.root?.querySelectorAll('[data-tutorial-pose]').forEach(canvas => {
      canvas.width = 800; canvas.height = 640;
      const c = canvas.getContext('2d'); c.scale(2, 2);
      const [, , , , kind, index] = MOVES[Number(canvas.dataset.tutorialPose)];
      const img = this.renderer.assets[kind + '-' + this.heroId];
      const collection = kind === 'walk' ? this.renderer.walkMetadata : this.renderer.combatMetadata;
      const meta = collection?.[this.heroId] || collection?.heroes?.[this.heroId];
      const frame = meta?.frames?.[index];
      if (!img || !frame) return;
      const cw = img.width / meta.columns, ch = img.height / meta.rows;
      const cellX = (index % meta.columns) * cw, cellY = Math.floor(index / meta.columns) * ch;
      const b = frame.bounds || { x: 0, y: 0, w: cw, h: ch };
      const source = frame.source || { x: cellX+b.x, y: cellY+b.y, w: b.w, h: b.h };
      const anchor = frame.anchor || meta.anchor || { x: cw/2, y: ch };
      const scale = Math.min(277/(meta.referenceHeight || ch), 346/source.w);
      const dx = 184 + ((frame.bounds ? b.x : source.x-cellX)-anchor.x)*scale;
      const dy = 307 + ((frame.bounds ? b.y : source.y-cellY)-anchor.y)*scale;
      c.save(); c.translate(196,305); c.scale(95,9);
      const shadow = c.createRadialGradient(0,0,0,0,0,1); shadow.addColorStop(0,'#000b'); shadow.addColorStop(1,'#0000');
      c.fillStyle=shadow; c.beginPath(); c.arc(0,0,1,0,Math.PI*2); c.fill(); c.restore();
      c.save(); clipSpriteFrame(c,frame,source,dx,dy,scale);
      c.drawImage(img,source.x,source.y,source.w,source.h,dx,dy,source.w*scale,source.h*scale); c.restore();
    });
  }
  render(dt, { visible = true } = {}) {
    if (!this.active || !visible) return;
    const signature = `${this.canvas.width}:${this.canvas.height}`;
    if (!this.dirty && signature === this.size) return;
    this.size=signature; this.dirty=false;
    const c = this.canvas.getContext('2d'); c.save();
    c.setTransform(this.canvas.width/1280,0,0,this.canvas.height/720,0,0);
    const background=this.menuScene.assets.background;
    if(background)c.drawImage(background,0,0,1280,720);
    else {c.fillStyle='#090c14';c.fillRect(0,0,1280,720);}
    c.fillStyle='#070a13b5';c.fillRect(0,0,1280,720);
    const shade=c.createLinearGradient(0,0,0,720);shade.addColorStop(0,'#03060beb');shade.addColorStop(.35,'#03060b18');shade.addColorStop(.72,'#03060b40');shade.addColorStop(1,'#03060bf5');c.fillStyle=shade;c.fillRect(0,0,1280,720);c.restore();
  }
  stop() { this.active=false; this.root=null; }
}
