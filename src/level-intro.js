import { LEVELS } from './data.js';
import { worldSceneGeometry } from './world-scene.js';
import { LampFlares } from './lamp-flares.js';
import { sceneLights } from './scene-lighting.js';

const SHORT = {kajo:'KAJO',stuehlinger:'STÜHLINGER',park:'KIRCHPLATZ',dreisam:'DREISAM',haslach:'HASLACH',wiehre:'WIEHRE',bermuda:'BERMUDA'};
const TITLES = {kajo:'KAISER-JOSEPH-STRASSE',stuehlinger:'STÜHLINGER',park:'STÜHLINGER KIRCHPLATZ',dreisam:'DREISAM BEI NACHT',haslach:'HASLACH / WEINGARTEN',wiehre:'WIEHRE · ALTER WIEHREBAHNHOF',bermuda:'BERMUDA-DREIECK'};
const GOALS = {kajo:'Besiege Dr. Rendite.',stuehlinger:'Besiege den Paten vom Hinterhof.',park:'Besiege den Beton-Baron.',dreisam:'Besiege den Brückenwächter.',haslach:'Besiege den Pförtner.',wiehre:'Besiege den Nachtkassierer.',bermuda:'Besiege die Mähne.'};
export const chapterLabel=level=>SHORT[level?.id]||level?.name||'';
const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

/** A chapter gate using the already loaded long background, without extra art. */
export class LevelIntro {
  constructor(canvas, renderer, menuScene) {
    this.canvas=canvas;this.renderer=renderer;this.menuScene=menuScene;this.active=false;this.time=0;this.flares=new LampFlares();this.reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  }
  html(levelIndex) {
    const level=LEVELS[levelIndex];if(!Number.isInteger(levelIndex)||!level)throw new RangeError('Unknown chapter');
    const next=LEVELS[levelIndex+1];
    return `<section class="level-intro" aria-labelledby="level-intro-title"><header class="level-intro-header"><canvas class="level-intro-logo" role="img" aria-label="Freiburg After Dark"></canvas><button data-action="level-back" class="level-intro-back">← Zurück <span>ESC</span></button></header><div class="level-intro-place"><p>${escape(level.landmark)}</p><h1 id="level-intro-title" class="${(TITLES[level.id]||level.name).length>24?'is-long':''}">${escape(TITLES[level.id]||level.name)}</h1></div><ol class="level-route" aria-label="Kampagnenfortschritt" style="--level-count:${LEVELS.length}">${LEVELS.map((item,index)=>`<li class="${index<levelIndex?'is-complete':index===levelIndex?'is-current':''}" style="--route-index:${index}" ${index===levelIndex?'aria-current="step"':''}><span class="level-route-number">${String(index+1).padStart(2,'0')}</span><span class="level-route-dot" aria-hidden="true">${index<levelIndex?'✓':''}</span><span class="level-route-name">${escape(SHORT[item.id]||item.name)}</span><span class="sr-only">${index<levelIndex?'Abgeschlossen':index===levelIndex?'Aktuelles Level':'Kommendes Level'}</span></li>`).join('')}</ol><footer class="level-intro-footer"><div class="level-intro-counter"><strong>${String(levelIndex+1).padStart(2,'0')}</strong><span>VON ${String(LEVELS.length).padStart(2,'0')}<br>LEVELN</span></div><div class="level-intro-goal"><p>DEIN ZIEL</p><h2>${escape(GOALS[level.id]||`Besiege ${level.boss}.`)}</h2><span>${next?`DANACH: ${escape(next.name.toUpperCase())}`:'DAS FINALE · EROBERE DIE NACHT.'}</span></div><button class="level-intro-start" data-action="level-start">LEVEL STARTEN<small>ENTER / A</small></button></footer></section>`;
  }
  begin(levelIndex) {
    if(!Number.isInteger(levelIndex)||!LEVELS[levelIndex])throw new RangeError('Unknown chapter');
    this.levelIndex=levelIndex;this.active=true;this.dirty=true;this.time=0;this.root=document.querySelector('.level-intro');
    this.menuScene.drawLogo(document.querySelector('.level-intro-logo'));
    document.querySelector('[data-action="level-start"]')?.focus({preventScroll:true});
    this.render(0);
  }
  render(dt,{visible=true}={}) {
    if(!this.active)return;
    if(this.root)this.root.dataset.motionPaused=String(!visible);
    if(!visible)return;
    const signature=`${this.canvas.width}:${this.canvas.height}:${!!this.reduced?.matches}`;
    if(this.reduced?.matches&&!this.dirty&&this.size===signature)return;
    if(!this.reduced?.matches)this.time+=Math.min(.05,Math.max(0,dt||0));
    this.dirty=false;this.size=signature;
    const level=LEVELS[this.levelIndex],image=this.renderer.assets[level.worldKey];
    const drift=this.reduced?.matches?0:Math.sin(this.time*.18)*10;
    const view=worldSceneGeometry(image,1660+drift,level.width),c=this.canvas.getContext('2d');
    c.save();c.setTransform(this.canvas.width/1280,0,0,this.canvas.height/720,0,0);
    c.fillStyle='#060910';c.fillRect(0,0,1280,720);
    if(view){const s=view.source;c.drawImage(image,s.x,s.y,s.width,s.height,0,0,1280,720);}
    if(view)this.flares.draw(c,sceneLights(level.worldKey),view.camera,{time:this.time,reducedMotion:!!this.reduced?.matches});
    const shade=c.createLinearGradient(0,0,0,520);shade.addColorStop(0,'#02050a60');shade.addColorStop(.45,'#02050a08');shade.addColorStop(.78,'#02050a18');shade.addColorStop(1,'#02050ae0');c.fillStyle=shade;c.fillRect(0,0,1280,520);
    c.restore();
  }
  stop(){this.active=false;this.root=null;}
}
