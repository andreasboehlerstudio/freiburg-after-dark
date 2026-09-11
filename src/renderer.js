import { resolveCombatPose, clipSpriteFrame } from './combat-animation.js';
import { loadWorldArt, WORLD_ART } from './world-art.js';
import { LEVELS } from './data.js';
import { keyBouncerSheet, drawBouncer } from './bouncer-animation.js';
import { drawWorldProp, drawPropShadow, drawHeldProp } from './world-props.js';
import { drawEditorialHud, drawEditorialNumber } from './editorial-hud.js';
import { FighterLighting } from './fighter-lighting.js';
import { SceneLighting, sampleSceneLighting } from './scene-lighting.js';
import { WorldAmbience } from './world-ambience.js';
import { drawWorldScene } from './world-scene.js';
import { drawEnemySprite, isPassiveFighter } from './enemy-sprites.js';
import { ENEMY_MOTION_ASSETS, ENEMY_COUNTER_ASSETS } from './enemy-motion.js';
import { drawCarShadow, drawStreetCar } from './street-obstacles.js';
import { loadImage, loadJSON, runLoadTasks, yieldForPaint } from './asset-loading.js';
import { selectionPlan, levelPlan, fullPlan } from './load-plan.js';
const W=1280,H=720, INK='#15151f';
const COLORS={nico:'#ef1824',stefan:'#ef1824',torsten:'#ef1824',andreas:'#ef1824'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const hash=n=>{let v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)};

export class Renderer {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.assets={};this.time=0;this.sceneLightingEnabled=true;this.motionPreference=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');this.metadata={};this.walkMetadata={};this.combatMetadata={};this.enemyMetadata={};this.propMetadata={};this.carMetadata={};this.resize();this._resize=()=>this.resize();window.addEventListener('resize',this._resize);}
  resize(){const r=this.canvas.getBoundingClientRect();const ratio=Math.min(window.devicePixelRatio||1,3);this.canvas.width=Math.min(3840,Math.max(1280,Math.round((r.width||1280)*ratio)));this.canvas.height=Math.round(this.canvas.width*9/16);}
  load(){return this.loadResources(fullPlan());}
  loadSelection(onProgress){return this.loadResources(selectionPlan(),onProgress);}
  loadLevel(index,heroIds,onProgress){return this.loadResources(levelPlan(index,heroIds),onProgress);}
  async loadResources(plan,onProgress){
    this.pendingResources ||= new Map();
    this.loadedMetadata ||= new Set();
    const ensure=(key,ready,work)=>{
      if(ready())return Promise.resolve();
      if(this.pendingResources.has(key))return this.pendingResources.get(key);
      const task=Promise.resolve().then(work).finally(()=>this.pendingResources.delete(key));
      this.pendingResources.set(key,task);return task;
    };
    const keyed=new Set([...ENEMY_MOTION_ASSETS,...ENEMY_COUNTER_ASSETS,'bouncer','props','enemies-night-a','enemies-night-b','street-car']);
    await runLoadTasks([
      ...plan.metadata.map(name=>()=>ensure('json:'+name,()=>this.loadedMetadata.has(name),async()=>{
        const data=await loadJSON('../assets/'+name+'.json',import.meta.url);
        if(name==='heroes')this.metadata=data;
        else if(name==='walk')this.walkMetadata=data;
        else if(name==='combat')this.combatMetadata=data;
        else if(name==='props')this.propMetadata=data;
        else if(name==='street-car')this.carMetadata=data;
        else this.enemyMetadata[name]=data;
        this.loadedMetadata.add(name);
      })),
      ...plan.images.map(name=>()=>ensure('image:'+name,()=>!!this.assets[name],async()=>{
        const image=await loadImage('../assets/'+name+'.png',import.meta.url);
        // Give progress and input a paint opportunity between expensive keying passes.
        await yieldForPaint();
        this.assets[name]=keyed.has(name)?keyBouncerSheet(image):image;
      })),
      ...plan.worlds.map(name=>()=>ensure('world:'+name,()=>!!this.assets[name],async()=>{
        this.assets[name]=await loadWorldArt(name);
      })),
    ],onProgress);
    return this;
  }
  retainWorld(index){
    for(const key of Object.keys(WORLD_ART))if(key!==LEVELS[index]?.worldKey)delete this.assets[key];
    this.fighterLighting?.clear();
  }
  reloadAssets(){this.assets={};this.loadedMetadata?.clear();return this.load();}
  render(game,dt=0){this.game=game||{};if(!this.game.mode||this.game.mode==="playing"||this.game.mode==="menu")this.time+=dt||1/60;this.c=this.ctx;const c=this.c;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.clearRect(0,0,W,H);const level=this.levelIndex();const camera=this.game.camera?.x??this.game.camera??0;this.camera=Number(camera)||0;this.drawBackground(level);c.save();const shake=this.game.shake||this.game.screenShake||0;if(shake)c.translate(Math.sin(this.time*95)*Math.min(shake*28,5),Math.cos(this.time*111)*Math.min(shake*20,3));this.drawArena();this.drawWorldObjects();for(const fx of this.game.effects||[])this.effect(fx);c.restore();this.atmosphere(level);this.hud();}
  drawWorldObjects(){
    const entities=this.entities(),props=(this.game.props||[]).filter(prop=>['ground','thrown'].includes(prop.state)),cars=(this.game.obstacles||[]).filter(value=>value.kind==='car');
    for(const car of cars)drawCarShadow(this,car);
    for(const prop of props)drawPropShadow(this,prop);
    for(const entity of entities)this.shadow(entity);
    // Ground-plane Y determines occlusion even while a fighter or prop is airborne.
    const objects=[...cars.map(value=>({kind:'car',value})),...props.map(value=>({kind:'prop',value})),...(this.game.pickups||[]).map(value=>({kind:'pickup',value})),...entities.map(value=>({kind:'entity',value}))];
    objects.sort((a,b)=>(a.value.y||0)-(b.value.y||0));
    for(const {kind,value} of objects){if(kind==='car')drawStreetCar(this,value);else if(kind==='prop')drawWorldProp(this,value);else if(kind==='pickup')this.drawPickup(value);else this.drawEntity(value);}
  }
  levelIndex(){const l=this.game?.level;return this.game?.levelIndex??this.game?.state?.levelIndex??(typeof l==='number'?l:(l?.index??Math.max(0,LEVELS.findIndex(level=>level.id===l?.id))));}
  entities(){const g=this.game;const arr=g.entities||[...this.heroes(),...(g.enemies||[]),...(g.residents||[]).filter(e=>e.hp>0||e.deadTime>0)];return arr.filter(Boolean);}
  heroes(){const g=this.game;if(Array.isArray(g.heroes)&&g.heroes.length)return g.heroes;return [g.player||g.hero,g.sidekick||g.partner].filter(Boolean);}
  path(points,fill,stroke=INK,width=3){const c=this.c;c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.lineJoin='round';c.stroke();}}
  line(points,color,width=2){const c=this.c;c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
  ellipse(x,y,rx,ry,fill,stroke=null,width=2){const c=this.c;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
  label(text,x,y,size=16,color='#fff',align='left',weight=800){const c=this.c;c.font=`${size}px "Freiburg Display",Impact,"Arial Narrow",sans-serif`;c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(String(text).toUpperCase(),x,y);}
  panel(x,y,w,h,color='rgba(13,18,29,.87)'){this.path([[x+5,y],[x+w,y],[x+w-5,y+h],[x,y+h]],color,'rgba(237,223,205,.25)',1);}
  motionReduced(){return this.reducedMotion===true||this.motionPreference?.matches===true;}
  drawBackground(level){const view=drawWorldScene(this,level),camera=view?.camera??this.camera??0,options={time:this.time,reducedMotion:this.motionReduced()};if(view){(this.worldAmbience ||= new WorldAmbience()).draw(this.c,level,camera,options);if(this.sceneLightingEnabled!==false)(this.sceneLighting ||= new SceneLighting()).draw(this.c,level,camera,options);}return view;}
  lightsFor(e){return this.sceneLightingEnabled===false?[]:sampleSceneLighting(this.levelIndex(),e);}
  drawArena(){const a=this.game.arena;if(!a)return;const c=this.c;if(!a.cleared){for(const worldX of [a.left,a.right]){const x=worldX-this.camera;if(x<10||x>W-10)continue;c.save();c.globalAlpha=.45+.15*Math.sin(this.time*4);for(let y=465;y<655;y+=28)this.path([[x-10,y],[x,y+8],[x-10,y+16],[x-4,y+16],[x+6,y+8],[x-4,y]],'#efad69',null);c.restore();}}else{const x=clamp(a.right-this.camera-65,1080,1180);this.label('WEITER',x,370,14,'#f7d58b','center');this.path([[x-15,393],[x+8,393],[x+8,384],[x+27,400],[x+8,416],[x+8,407],[x-15,407]],'#f7d58b',INK,3);}}
  shadow(e){if(e.state==='dead')return;const x=e.x-this.camera,y=e.y;const z=e.z||0;(this.fighterLighting ||= new FighterLighting()).drawContact(this.c,e,x,{wet:true,lights:this.lightsFor(e)});if(e.state==='telegraph'){const p=1-clamp((e.attackTime||0)/Math.max(.1,e.attackDuration||.65),0,1);const slam=e.attackKind==='slam',charge=e.attackKind==='charge';this.ellipse(x+(slam?0:(e.facing||1)*55),y,slam?155:65+20*p,slam?58:20,'rgba(255,63,66,.15)','#ff785c',3);if(charge){const d=e.facing||1;this.path([[x+d*45,y-19],[x+d*200,y-19],[x+d*200,y-34],[x+d*248,y],[x+d*200,y+34],[x+d*200,y+19],[x+d*45,y+19]],'rgba(239,85,71,.30)','#ff9b75',2);}this.label(slam?'BODENWELLE':charge?'ANSTURM':'!',x,y-(e.isBoss?270:(e.spriteHeight||211)+26),e.isBoss?14:29,'#fff0ba','center');}}
  isHero(e){return e.type==='hero'||e.isHero||this.heroes().includes(e)||['nico','stefan','torsten','andreas'].includes(e.heroId||e.id);}
  heroId(e){return e.heroId||e.characterId||e.hero||e.id;}
  drawEntity(e){const x=e.x-this.camera;if(x<-180||x>W+180)return;const c=this.c;c.save();c.translate(x,e.y-(e.z||0));const facing=e.state==='attack'?(e.attackFacing??e.facing??1):(e.facing||1);c.scale(facing,1);if(e.state==='down'||e.state==='dead'){if(!isPassiveFighter(e)){c.translate(0,-11);c.rotate(-Math.PI/2);c.scale(.9,.9);}c.globalAlpha=e.state==='dead'?.35:1;}const hero=this.isHero(e);const id=this.heroId(e);c.save();if(hero&&this.assets[id])this.drawHero(e,id);else if(hero||!this.drawEnemySprite(e))this.drawFighter(e,hero);c.restore();if(hero)drawHeldProp(this,e);c.restore();if(hero&&e.state==='down'){this.label('AM BODEN',x,e.y-65,11,'#d5cfd0','center');}if(!hero&&e.hp>0&&!e.isBoss&&!isPassiveFighter(e)){const w=56;this.bar(x-w/2,e.y-(e.z||0)-(e.spriteHeight||211)-14,w,3,e.hp/(e.maxHp||e.hp),'#d93643');}}
  drawHeroGrip(e,pose){
    const id=this.heroId(e);if(!this.assets[id]||!Number.isFinite(pose.gripX)||!Number.isFinite(pose.gripY))return;
    const c=this.c;c.save();c.beginPath();c.ellipse(pose.gripX,pose.gripY,6,5,0,0,Math.PI*2);c.clip();this.drawHero(e,id);c.restore();
  }
  walkFrame(e,id){const meta=this.walkMetadata[id];const count=meta?.frames?.length||8;const cycle=meta?.cycleDistance||180;return Math.floor((((e.walkDistance||0)%cycle)+cycle)%cycle/cycle*count)%count;}
  drawLitSprite(e,...args){(this.fighterLighting ||= new FighterLighting()).draw(this.c,...args,{facing:e.state==='attack'?(e.attackFacing??e.facing??1):(e.facing||1),lights:this.lightsFor(e)});}
  drawWalk(e,id){
    const img=this.assets['walk-'+id],meta=this.walkMetadata[id];if(!img||!meta?.frames?.length)return false;
    const index=this.walkFrame(e,id),frame=meta.frames[index];
    const columns=meta.columns||4,cw=img.width/columns,ch=img.height/(meta.rows||2);
    const cellX=(index%columns)*cw,cellY=Math.floor(index/columns)*ch;
    const b=frame.bounds||{x:0,y:0,w:cw,h:ch};
    const source=frame.source||{x:cellX+b.x,y:cellY+b.y,w:b.w,h:b.h};
    const localX=frame.bounds?b.x:source.x-cellX,localY=frame.bounds?b.y:source.y-cellY;
    // Preserve one skeleton scale and one ground baseline for the entire cycle.
    // Per-frame bounding-box scaling would erase the down/up and foot-lift poses.
    const anchor=frame.anchor||meta.anchor||{x:cw/2,y:ch};
    const scale=211/(meta.referenceHeight||ch);
    const dx=(localX-anchor.x)*scale,dy=(localY-anchor.y)*scale;
    if(![source.x,source.y,source.w,source.h,dx,dy,scale].every(Number.isFinite)||source.w<=0||source.h<=0||scale<=0||source.x<0||source.y<0||source.x+source.w>img.width||source.y+source.h>img.height)return false;
    const c=this.c;if((e.invuln||0)>0)c.globalAlpha=Math.floor(this.time*18)%2?.63:1;
    c.save();clipSpriteFrame(c,frame,source,dx,dy,scale);
    this.drawLitSprite(e,img,source.x,source.y,source.w,source.h,dx,dy,source.w*scale,source.h*scale);c.restore();
    return true;
  }
  drawHero(e,id){
    if(resolveCombatPose(this,e,id))return;
    const c=this.c,img=this.assets[id];if(!img)return;
    if(e.state==='walk'&&e.walking&&!(e.z>0)&&this.drawWalk(e,id))return;
    let frame=0;
    if(e.state==='attack')frame=(e.attackKind==='heavy'||e.attackKind==='special'||e.comboStep===3||e.attackKind==='finisher')?4:3;
    if(e.z>12)frame=5;if(e.state==='special')frame=4;if(e.state==='hurt')frame=1;
    const meta=this.metadata[id],columns=meta?.columns||3,cw=img.width/columns,ch=img.height/(meta?.rows||2);
    const sx=(frame%columns)*cw,sy=Math.floor(frame/columns)*ch,pose=meta?.frames?.[frame];
    const bounds=pose?.bounds||(pose?.w?pose:null);
    const size=222;let dw=size,dh=size,dx=-size/2,dy=-size+5,scale=size/ch;
    let source=pose?.source||{x:sx+(bounds?.x||0),y:sy+(bounds?.y||0),w:bounds?.w||cw,h:bounds?.h||ch};
    if(bounds||pose?.source){
      const idle=meta.frames[0]?.bounds||meta.frames[0];
      scale=211/(meta.referenceHeight||idle?.h||source.h);
      const localX=bounds?bounds.x:source.x-sx,localY=bounds?bounds.y:source.y-sy;
      const anchor=pose.anchor||meta.anchor;
      const baseline=anchor?.y??(frame===5?(idle?.y||0)+(idle?.h||ch):localY+source.h);
      dx=(localX-(anchor?.x??cw/2))*scale;dy=(localY-baseline)*scale;
      dw=source.w*scale;dh=source.h*scale;
    }
    if(![source.x,source.y,source.w,source.h,dx,dy,dw,dh,scale].every(Number.isFinite)||source.w<=0||source.h<=0||scale<=0||source.x<0||source.y<0||source.x+source.w>img.width||source.y+source.h>img.height)return;
    const attack=e.state==='attack'?Math.sin(clamp((e.attackTime||0)/(e.attackDuration||.4),0,1)*Math.PI):0;
    c.translate(attack*7,0);c.transform(1,0,-attack*.035,1,0,0);
    if(e.state==='hurt')c.rotate(-.08);if(e.state==='dodge'){c.rotate(.20);c.scale(1,.87);}
    if((e.invuln||0)>0)c.globalAlpha=Math.floor(this.time*18)%2?.63:1;
    c.save();clipSpriteFrame(c,pose,source,dx,dy,scale);
    this.drawLitSprite(e,img,source.x,source.y,source.w,source.h,dx,dy,dw,dh);c.restore();
    if(e.state==='attack'&&attack>.35){c.save();c.translate(0,-26);c.scale(1.15,1.15);this.attackArc(e,attack);c.restore();}
  }
  drawBouncer(e){return drawBouncer(this,e);}
  drawEnemySprite(e){return drawEnemySprite(this,e);}
  limb(ax,ay,bx,by,cx,cy,width,color){const points=[];for(const [x,y,xx,yy] of [[ax,ay,bx,by],[bx,by,cx,cy]]){const a=Math.atan2(yy-y,xx-x)+Math.PI/2;const dx=Math.cos(a)*width/2,dy=Math.sin(a)*width/2;this.path([[x+dx,y+dy],[xx+dx*.75,yy+dy*.75],[xx-dx*.75,yy-dy*.75],[x-dx,y-dy]],color,INK,3);}this.ellipse(bx,by,width*.39,width*.39,color);}
  drawFighter(e,hero=false){const c=this.c;const kind=e.enemyType||e.type||'brawler';const boss=e.isBoss;const business=boss||/suit|business|broker|specul|boss|mafia|don/.test(kind);const fast=/runner|punk|knife|rush|hooligan/.test(kind);const skin=['#be8065','#dca282','#96654e','#e3b091'][Math.abs((e.uid||e.spawnId||kind.length).toString().split('').reduce((a,b)=>a+b.charCodeAt(0),0))%4];const color=e.color||(boss?'#aa5366':business?'#53616b':fast?'#a15a51':'#6e7280');const move=e.state==='walk'?Math.sin(this.time*(fast?13:10)+(e.x*.01)):0;const ap=e.state==='attack'?Math.sin(clamp((e.attackTime||0)/(e.attackDuration||.45),0,1)*Math.PI):0;const tele=e.state==='telegraph';c.scale(boss?1.42:kind==='enforcer'?1.34:kind==='runner'?1:1.13,boss?1.36:kind==='runner'?1.11:1.16);c.translate(0,-Math.abs(move)*2);if(e.state==='hurt')c.rotate(-.11);if(e.state==='dodge')c.scale(1,.84);if((e.invuln||0)>0&&Math.floor(this.time*20)%2)c.globalAlpha=.65;
    // Legs articulate independently through hips, knees, booted feet.
    this.limb(-11,-64,-17-move*12,-34,-16-move*20,-5,22,'#32394b');this.path([[-28-move*20,-11],[-8-move*20,-11],[1-move*20,-3],[0-move*20,1],[-30-move*20,1]],'#25232d');
    this.limb(12,-64,20+move*12,-34,18+move*20,-5,23,'#40485b');this.path([[7+move*20,-11],[28+move*20,-11],[39+move*20,-3],[39+move*20,1],[5+move*20,1]],'#22222c');
    this.limb(-23,-124,-39,-94,-27+ap*35,-85,21,color);this.ellipse(-27+ap*35,-85,10,11,skin,INK,2);
    this.path([[-25,-133],[-12,-141],[19,-139],[31,-128],[24,-69],[10,-60],[-22,-65],[-29,-97]],color);this.path([[-24,-126],[-11,-117],[-9,-68],[-22,-66],[-28,-95]],'#00000026',null);
    if(business){this.path([[-11,-138],[4,-127],[17,-138],[12,-78],[-1,-72]],'#d2c9bc',INK,1.5);this.path([[4,-125],[9,-121],[5,-95],[0,-101]],'#bd6761',INK,1);this.line([[-16,-132],[-6,-107],[-15,-99],[-5,-70]],'#1d2833',2);this.line([[22,-131],[14,-106],[19,-99],[13,-69]],'#202934',2);}else{this.label(fast?'STRESS':'KEIN',0,-111,9,'#e6d8bf','center');this.label(fast?'KLUB':'PLAN',0,-100,9,'#e6d8bf','center');this.line([[-20,-75],[20,-75]],'#bdb0a1',3);}
    if(kind==='runner'){this.line([[-20,-123],[-18,-83]],'#d8e6d7',4);this.line([[20,-123],[18,-86]],'#d8e6d7',4);}if(kind==='extremist'){this.line([[2,-130],[1,-76]],'#e4ccb0',2);this.path([[-24,-124],[-4,-124],[-4,-105],[-23,-105]],'#665f4f',INK,1);}if(kind==='hooligan'){this.path([[-18,-135],[18,-135],[17,-125],[-13,-124],[-7,-99],[-18,-98]],'#cbbb99',INK,2);this.line([[-14,-119],[-10,-115]],'#b5544d',4);this.line([[-13,-109],[-9,-105]],'#b5544d',4);} this.path([[-8,-143],[-7,-133],[12,-133],[13,-148]],skin);this.ellipse(2,-158,20,24,skin,INK,3);this.path([[-17,-163],[-16,-179],[-4,-185],[13,-179],[20,-167],[14,-169],[8,-174],[-4,-170],[-10,-160]],business?'#33313a':'#46352f');this.path([[15,-161],[25,-154],[17,-151]],skin,INK,2);this.line([[7,-163],[15,-162]],INK,2);this.ellipse(13,-159,1.8,2,INK);this.line([[9,-146],[18,-147]],'#623e3a',2);this.path([[-9,-150],[-1,-146],[9,-148],[17,-151],[13,-137],[1,-135],[-9,-141]],business?'#47383c':'#5a4038',null);this.line([[12,-142],[18,-143]],'#dca991',1);
    const armX=tele?-1:38+ap*51,armY=tele?-151:-104-ap*24;this.limb(22,-127,tele?42:42+ap*18,tele?-128:-100-ap*25,armX,armY,23,color);this.ellipse(armX+5,armY,12,11,skin,INK,2);this.line([[armX+8,armY-5],[armX+12,armY-3]],'#895d50',1);if(boss){this.path([[armX-2,armY+6],[armX+19,armY+6],[armX+20,armY+31],[armX-6,armY+30]],'#443543');this.line([[armX+3,armY+4],[armX+12,armY+4]],'#b3a198',4);}
    if(ap>.35)this.attackArc(e,ap);
  }
  attackArc(e,p){const c=this.c;c.save();c.globalAlpha=p*.65;c.beginPath();c.ellipse(37,-105,61,47,-.25,-1.15,.72);c.strokeStyle=e.isBoss?'#ff725d':'#ffe4b3';c.lineWidth=8;c.stroke();c.beginPath();c.ellipse(43,-105,64,51,-.25,-1.0,.8);c.strokeStyle='#fff9e8';c.lineWidth=2;c.stroke();c.restore();}
  drawPickup(p){const c=this.c,x=p.x-this.camera,y=p.y;this.ellipse(x,y,19,6,'rgba(0,0,0,.3)');c.save();c.translate(x,y-19+Math.sin(this.time*4+p.x)*4);this.ellipse(0,0,22,22,'rgba(244,197,94,.13)');if(/health|food|heal/.test(p.kind||p.type)){this.path([[-14,-5],[8,-10],[18,1],[12,9],[-14,6]],'#dcb172');this.line([[-8,-2],[12,2]],'#67493c',3);this.label('+',0,-23,18,'#b7e1a3','center');}else{this.path([[-7,-15],[10,-15],[7,15],[-10,15]],'#e8b85c');this.label('E',0,0,14,INK,'center');}c.restore();}
  effect(fx){const c=this.c,x=(fx.x||0)-this.camera,y=(fx.y||0)-(fx.z||0)-(['hit','number','heal'].includes(fx.kind||fx.type)?35:0);let t=clamp((fx.life??.3)/(fx.maxLife||fx.duration||.5),0,1);c.save();c.globalAlpha=Math.min(1,t*2);const kind=fx.kind||fx.type;if(/text|damage|combo|score|revive/.test(kind)||fx.text){drawEditorialNumber(this,fx,x,y,t);}else if(/special|shock|burst/.test(kind)){this.ellipse(x,y,Math.max(5,(1-t)*155),Math.max(5,(1-t)*45),'rgba(0,0,0,0)',fx.color||'#f3d691',7*t);for(let i=0;i<10;i++){let a=i*.628;this.line([[x+Math.cos(a)*30,y-75+Math.sin(a)*20],[x+Math.cos(a)*(40+100*(1-t)),y-75+Math.sin(a)*(20+55*(1-t))]],'#fff4cf',3*t);}}else{const n=9;const points=[];for(let i=0;i<n*2;i++){let a=i*Math.PI/n,r=i%2?9:22+hash(i)*22;points.push([x+Math.cos(a)*r*(1.4-t*.4),y+Math.sin(a)*r*(1.4-t*.4)]);}this.path(points,fx.color||'#ffdd94','#392a33',2);this.ellipse(x,y,8,8,'#fff7dc');for(let i=0;i<5;i++){let a=i*1.25+1;const r=(1-t)*95;this.line([[x+Math.cos(a)*r,y+Math.sin(a)*r],[x+Math.cos(a)*(r+12),y+Math.sin(a)*(r+12)]],'#ffc889',3);}}c.restore();}
  atmosphere(level){const c=this.c,time=this.motionReduced()?0:this.time;for(let i=0;i<64;i++){const x=(hash(i*17)*W-this.camera*.38-time*33+W*100)%W,y=(hash(i+71)*H+time*(290+hash(i)*170))%H;this.line([[x,y],[x-3,y+10+hash(i+8)*10]],"rgba(171,210,229,.13)",.7);}const v=c.createLinearGradient(0,0,0,H);v.addColorStop(0,'rgba(7,12,22,.20)');v.addColorStop(.3,'rgba(7,12,22,0)');v.addColorStop(.88,'rgba(7,12,22,0)');v.addColorStop(1,'rgba(7,12,22,.35)');c.fillStyle=v;c.fillRect(0,0,W,H);for(let i=0;i<24;i++){const x=(hash(i*9)*W-this.camera*.12+time*(4+hash(i)*6)+W*20)%W,y=(hash(i+51)*H+Math.sin(time+i)*6);this.ellipse(x,y,hash(i*3)>.5?1.5:.7,1,'rgba(247,212,153,.23)');}}
  hudPlate(x,y,w,h,red=false){
    this.path([[x+5,y+1],[x+w-3,y],[x+w,y+6],[x+w-4,y+h-5],[x+w,y+h-1],[x+8,y+h],[x,y+h-4],[x+2,y+7]],red?'#e71220':'rgba(5,9,15,.90)',red?'#ff3540':'rgba(225,51,65,.3)',1);
    if(!red){this.c.fillStyle='#ee1624';this.c.fillRect(x+3,y+6,3,h-12);}
  }
  display(text,x,y,size=36,color='#f6f0e6',align='left',maxWidth){
    const c=this.c;c.save();c.font=`${size}px "Freiburg Display",Impact,"Arial Narrow",sans-serif`;c.textAlign=align;c.textBaseline='middle';c.lineJoin='round';c.lineWidth=Math.max(2,size*.085);c.strokeStyle='#090b12';
    if(maxWidth)c.strokeText(String(text).toUpperCase(),x,y,maxWidth);else c.strokeText(String(text).toUpperCase(),x,y);
    c.fillStyle=color;if(maxWidth)c.fillText(String(text).toUpperCase(),x,y,maxWidth);else c.fillText(String(text).toUpperCase(),x,y);c.restore();
  }
  hud(){drawEditorialHud(this);}
  bar(x,y,w,h,p,color,trail=0){
    const c=this.c,ratio=clamp(Number(p)||0,0,1);
    c.save();c.fillStyle='#ded9d330';c.fillRect(x,y,w,h);
    if(trail>ratio){c.fillStyle='#d9aaab85';c.fillRect(x,y,w*clamp(trail,0,1),h);}
    c.fillStyle=color;c.fillRect(x,y,w*ratio,h);c.restore();
  }

}










