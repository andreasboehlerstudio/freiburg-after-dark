import {LEVELS} from './data.js';
import {LevelCelebration,CELEBRATION_READY} from './level-celebration.js';
import {clipSpriteFrame} from './combat-animation.js';
import {worldSceneGeometry} from './world-scene.js';
import {LampFlares} from './lamp-flares.js';
import {sceneLights} from './scene-lighting.js';
import {chapterLabel} from './level-intro.js';

const W=1280,H=720;
const clamp=value=>Math.max(0,Math.min(1,value));
const ease=value=>1-Math.pow(1-clamp(value),3);
const escape=value=>String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const number=value=>Math.max(0,Number(value)||0);
export const victoryTime=value=>`${String(Math.floor(number(value)/60)).padStart(2,'0')}:${String(Math.floor(number(value)%60)).padStart(2,'0')}`;

/** The displayed result belongs to this district, not the whole saved campaign. */
export function levelResultStats(game,baseline={}){
 const same=baseline.index===game.levelIndex;
 return Object.freeze({score:Math.round(Math.max(0,number(game.score)-(same?number(baseline.score):0))),time:Math.max(0,number(game.time)-(same?number(baseline.time):0)),kills:Math.round(Math.max(0,number(game.stats?.kills)-(same?number(baseline.kills):0)))});
}

export function victoryMotion(index,time,reducedMotion=false){
 const target=[615,850,1080][index],height=[415,430,410][index],arrival=[.12,.3,.46][index];
 if(reducedMotion)return{x:target,y:551,height,alpha:1,rotation:0,pose:[1,0,2][index]};
 const progress=ease((time-arrival)/.82),phase=Math.max(0,time-arrival-.82),step=phase/.34+index*.75,sequence=[0,1,2,1],frame=Math.floor(step);
 return{x:target+(1-progress)*30,y:551+(1-progress)*9-Math.max(0,Math.sin(phase*3.2+index*.7))*.9,height,alpha:1,rotation:Math.sin(phase*2.2+index)*.002,pose:sequence[frame%4]};
}

/** Editorial victory layout reuses the existing nine authored cheer frames. */
export class VictoryScreen extends LevelCelebration{
 constructor(canvas,renderer,menuScene,options){super(canvas,options);this.renderer=renderer;this.menuScene=menuScene;this.flares=new LampFlares();this.nodes={};}
 html(game,stats=levelResultStats(game)){
  const index=game.levelIndex,level=LEVELS[index],next=LEVELS[index+1],label=chapterLabel(level);
  if(!Number.isInteger(index)||!level)throw new RangeError('Unknown completed district');
  return `<section class="victory-screen" aria-labelledby="celebration-title" aria-describedby="celebration-subtitle"><div class="victory-copy"><canvas class="victory-logo" role="img" aria-label="Freiburg After Dark"></canvas><p class="victory-eyebrow">LEVEL ${String(index+1).padStart(2,'0')} / ${String(LEVELS.length).padStart(2,'0')} ABGESCHLOSSEN</p><h1 id="celebration-title" class="${label.length>8?'is-long':''}" aria-label="${escape(level.name)} geschafft"><span>${escape(label)}</span>GESCHAFFT<span class="victory-period">.</span></h1><p id="celebration-subtitle" class="victory-congratulations">CONGRATULATIONS · YOU BEAT THE LEVEL</p><dl class="victory-stats">${[['score','PUNKTE',stats.score.toLocaleString('de-DE')],['time','ZEIT',victoryTime(stats.time)],['kills','GEGNER',String(stats.kills)]].map(([key,title,value])=>`<div><dt>${title}</dt><dd><strong data-victory-stat="${key}" aria-hidden="true">${value}</strong><span class="sr-only">${value}</span></dd></div>`).join('')}</dl></div><p class="sr-only">Drei erwachsene Frauen jubeln deinem Team zu.</p><footer class="victory-footer"><ol class="victory-route" aria-label="Kampagnenfortschritt" style="--level-count:${LEVELS.length}">${LEVELS.map((item,position)=>`<li class="${position<=index?'is-complete':position===index+1?'is-next':''}" style="--route-index:${position}" ${position===index?'aria-current="step"':''}><span class="victory-route-number">${String(position+1).padStart(2,'0')}</span><span class="victory-route-dot" aria-hidden="true">${position<=index?'✓':''}</span><span class="victory-route-name">${escape(chapterLabel(item))}</span><span class="sr-only">${position<=index?'Abgeschlossen':position===index+1?'Nächstes Level':'Kommendes Level'}</span></li>`).join('')}</ol><div class="victory-next"><button class="victory-continue celebration-continue" data-action="next-level" disabled><span>${next?`WEITER NACH ${escape(chapterLabel(next))}`:'ABSCHLUSS ANSEHEN'}</span><kbd>ENTER / A</kbd></button><p class="victory-progress">${index+1} VON ${LEVELS.length} LEVELN GESCHAFFT</p><span class="celebration-key sr-only">EINEN MOMENT GENIESSEN</span></div></footer></section>`;
 }
 begin(renderer,game,stats=levelResultStats(game)){
  this.renderer=renderer;this.level=game.levelIndex;this.levelData=LEVELS[this.level];this.stats=Object.freeze({...stats});
  this.background=renderer.assets[this.levelData.worldKey];this.camera=number(game.camera);this.time=0;this.active=true;this.dirty=true;this.lastStatValues={};
  this.root=document.querySelector('.victory-screen');this.nodes=Object.fromEntries(['score','time','kills'].map(key=>[key,document.querySelector(`[data-victory-stat="${key}"]`)]));
  const logo=document.querySelector('.victory-logo');if(logo)this.menuScene.drawLogo(logo);
  this.render(0);
 }
 get ready(){return this.active&&(this.reducedMotion()||this.time>=CELEBRATION_READY);}
 stop(){super.stop();this.root=null;this.nodes={};}
 updateStats(reduced){
  const progress=reduced?1:ease((this.time-.3)/1.15);
  const values={score:Math.round(this.stats.score*progress).toLocaleString('de-DE'),time:victoryTime(Math.floor(this.stats.time*progress)),kills:String(Math.round(this.stats.kills*progress))};
  for(const[key,value]of Object.entries(values))if(this.nodes[key]&&this.lastStatValues[key]!==value){this.nodes[key].textContent=value;this.lastStatValues[key]=value;}
 }
 render(dt=0,{visible=true}={}){
  if(!this.active)return;
  if(this.root)this.root.dataset.motionPaused=String(!visible);
  if(!visible)return;
  const reduced=!!this.reducedMotion();if(this.root)this.root.dataset.reducedMotion=String(reduced);this.time+=Math.max(0,Math.min(.1,Number(dt)||0));this.updateStats(reduced);
  const signature=`${this.canvas.width}:${this.canvas.height}:${reduced}`;
  if(reduced&&!this.dirty&&this.size===signature)return;
  this.dirty=false;this.size=signature;
  const c=this.canvas.getContext('2d'),drift=reduced?0:(1-Math.cos(this.time*.19))*5,view=worldSceneGeometry(this.background,Math.max(0,this.camera-drift),this.levelData.width);
  c.save();c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.fillStyle='#03070d';c.fillRect(0,0,W,H);
  if(view){const s=view.source;c.drawImage(this.background,s.x,s.y,s.width,s.height,0,0,W,H);this.flares.draw(c,sceneLights(this.levelData.worldKey),view.camera,{time:reduced?0:this.time,reducedMotion:reduced});}
  c.fillStyle='#03060c38';c.fillRect(0,0,W,H);
  const left=c.createLinearGradient(0,0,650,0);left.addColorStop(0,'#020609f5');left.addColorStop(.63,'#020609e8');left.addColorStop(1,'#02060900');c.fillStyle=left;c.fillRect(0,0,650,H);
  const floor=c.createLinearGradient(0,480,0,H);floor.addColorStop(0,'#03060900');floor.addColorStop(.43,'#03060940');floor.addColorStop(.64,'#030609f5');floor.addColorStop(1,'#030609');c.fillStyle=floor;c.fillRect(0,480,W,240);
  if(this.image&&this.metadata)for(const[index,character]of Object.values(this.metadata.characters).sort((a,b)=>a.row-b.row).entries()){
   const motion=victoryMotion(index,this.time,reduced);
   c.save();c.fillStyle='#020408b3';c.beginPath();c.ellipse(motion.x,553,52,8,0,0,Math.PI*2);c.fill();c.restore();
   // One opaque authored pose avoids ghosted faces/limbs between cheer frames.
   const frame=character.frames[motion.pose],s=frame.source,a=frame.sourceAnchor,scale=motion.height/character.referenceHeight;
   c.save();c.globalAlpha=1;c.translate(motion.x,motion.y);c.rotate(motion.rotation);const dx=(s.x-a.x)*scale,dy=(s.y-a.y)*scale;
   clipSpriteFrame(c,frame,s,dx,dy,scale);c.drawImage(this.image,s.x,s.y,s.w,s.h,dx,dy,s.w*scale,s.h*scale);c.restore();
  }
  c.restore();
 }
}
