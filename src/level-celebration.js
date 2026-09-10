import { keyBouncerSheet } from './bouncer-animation.js';
import { clipSpriteFrame } from './combat-animation.js';

const W=1280,H=720;
export const CELEBRATION_READY=1.6;
export const CELEBRATION_AUTO_CONTINUE=3.2;
const clamp=value=>Math.max(0,Math.min(1,value));
const ease=value=>1-Math.pow(1-clamp(value),3);

/** Three separate adult character rows retain one scale and a ground anchor. */
export function celebrationMotion(index,time,reducedMotion=false){
 const arrival=[.05,.24,.12][index],target=[370,640,910][index];
 const progress=reducedMotion?1:ease((time-arrival)/1.15);
 const phase=Math.max(0,time-arrival-1.15),sequence=[0,1,2,1];
 return {
  x:[-240,-430,1510][index]+(target-[-240,-430,1510][index])*progress,
  y:610-(reducedMotion?0:Math.max(0,Math.sin(phase*5+index*.8))*3),
  pose:progress<1?0:sequence[Math.floor(phase/(reducedMotion?.85:.24)+index)%sequence.length],
  height:[310,330,315][index],rotation:reducedMotion?0:Math.sin(phase*3.4+index)*.008,
 };
}

export class LevelCelebration {
 constructor(canvas,{reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false}={}){
  this.canvas=canvas;this.reducedMotion=reducedMotion;this.active=false;this.time=0;
  this.image=null;this.metadata=null;this.background=null;
 }
 async load(){
  const image=new Image(),url=new URL('../assets/celebration.png',import.meta.url);
  image.src=url.href;
  const [response]=await Promise.all([fetch(new URL('../assets/celebration.json',import.meta.url)),image.decode()]);
  if(!response.ok)throw new Error('Siegesfeier-Metadaten fehlen.');
  const metadata=await response.json(),characters=Object.values(metadata.characters||{});
  if(characters.length!==3)throw new Error('Die Siegesfeier benötigt drei Figuren.');
  for(const character of characters){
   if(character.frames?.length!==3||!(character.referenceHeight>0))throw new Error('Jubelposen fehlen.');
   for(const frame of character.frames){
    const s=frame.source,a=frame.sourceAnchor;
    if(!s||!a||![s.x,s.y,s.w,s.h,a.x,a.y].every(Number.isFinite)||s.w<=0||s.h<=0||s.x<0||s.y<0||s.x+s.w>image.width||s.y+s.h>image.height)throw new Error('Ungültige Jubelpose.');
   }
  }
  this.image=keyBouncerSheet(image);this.metadata=metadata;return this;
 }
 begin(renderer,game){
  // Draw the actual cleared street once, without the combat HUD or exit arrow.
  // No simulation step or camera movement occurs while the gate is open.
  const c=renderer.ctx;renderer.c=c;renderer.game=game;renderer.camera=Number(game.camera)||0;
  c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);
  c.clearRect(0,0,W,H);renderer.drawBackground(game.levelIndex);
  renderer.drawWorldObjects();renderer.atmosphere(game.levelIndex);
  this.background=document.createElement('canvas');
  this.background.width=this.canvas.width;this.background.height=this.canvas.height;
  this.background.getContext('2d').drawImage(this.canvas,0,0);
  this.time=0;this.active=true;this.level=game.levelIndex;
 }
 get ready(){return this.active&&this.time>=CELEBRATION_READY;}
 stop(){this.active=false;this.background=null;}
 render(dt=0,{visible=true}={}){
  if(!this.active||!this.background)return;
  if(visible)this.time+=Math.max(0,Math.min(.1,Number(dt)||0));
  const c=this.canvas.getContext('2d'),t=this.time,reduced=this.reducedMotion();
  c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);
  c.drawImage(this.background,0,0,W,H);
  c.fillStyle='#03081166';c.fillRect(0,0,W,H);
  const shade=c.createLinearGradient(0,0,0,H);
  shade.addColorStop(0,'#03070ced');shade.addColorStop(.34,'#03070c70');
  shade.addColorStop(.65,'#03070c00');shade.addColorStop(1,'#03070cf0');
  c.fillStyle=shade;c.fillRect(0,0,W,H);
  const glow=c.createRadialGradient(640,480,15,640,480,420);
  glow.addColorStop(0,'#dd1e3726');glow.addColorStop(1,'#dd1e3700');
  c.fillStyle=glow;c.fillRect(180,250,920,420);
  for(const [index,character] of Object.values(this.metadata.characters).sort((a,b)=>a.row-b.row).entries()){
   const motion=celebrationMotion(index,t,reduced),frame=character.frames[motion.pose];
   const s=frame.source,a=frame.sourceAnchor,scale=motion.height/character.referenceHeight;
   c.save();c.translate(motion.x,610);c.fillStyle='#02040aac';c.beginPath();c.ellipse(0,1,47,8,0,0,Math.PI*2);c.fill();c.restore();
   c.save();c.translate(motion.x,motion.y);c.rotate(motion.rotation);
   const dx=(s.x-a.x)*scale,dy=(s.y-a.y)*scale;
   clipSpriteFrame(c,frame,s,dx,dy,scale);
   c.drawImage(this.image,s.x,s.y,s.w,s.h,dx,dy,s.w*scale,s.h*scale);c.restore();
  }
  // A brief red-and-white confetti burst, then the street and cheering remain calm.
  if(!reduced&&t>.6&&t<3.6){
   c.save();c.globalAlpha=Math.min(1,(3.6-t)*1.2);
   for(let i=0;i<26;i++){
    const age=t-.6,seed=Math.sin(i*12.93)*.5+.5;
    const x=640+(seed-.5)*780+Math.sin(i*2.3)*age*30,y=220+(i%7)*13+age*65+age*age*12;
    c.save();c.translate(x,y);c.rotate(age*(i%2?1:-1)+i);c.fillStyle=i%3?'#e52c40':'#eeeae5';c.fillRect(-2,-1,4,2);c.restore();
   }
   c.restore();
  }
 }
}
