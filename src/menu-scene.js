import { loadImage, loadJSON, runLoadTasks } from './asset-loading.js';
import { LampFlares, menuLamps } from './lamp-flares.js';
const W=1280,H=720;
const hash=n=>{const v=Math.sin(n*127.1+31.7)*43758.5453;return v-Math.floor(v)};
export class MenuScene {
  constructor(canvas){
    this.canvas=canvas;this.c=canvas.getContext('2d',{alpha:false});this.assets={};this.time=0;this.frames=0;this.sceneLightingEnabled=true;this.lampFlares=new LampFlares();this.pointer={x:0,y:0};this.offset={x:0,y:0};this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    canvas.parentElement.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();if(!canvas.hidden&&r.width){this.pointer.x=(e.clientX-r.left)/r.width-.5;this.pointer.y=(e.clientY-r.top)/r.height-.5;}});
    canvas.parentElement.addEventListener('pointerleave',()=>{this.pointer.x=0;this.pointer.y=0;});
    this.resize();window.addEventListener('resize',()=>this.resize());
  }
  resize(){const r=this.canvas.parentElement.getBoundingClientRect();this.canvas.width=Math.min(3840,Math.max(1280,Math.round((r.width||1280)*Math.min(devicePixelRatio||1,3))));this.canvas.height=Math.round(this.canvas.width*9/16);}
  async load(onProgress){
    if(this.heroes){onProgress?.({completed:7,total:7});return this;}
    if(this.loading)return this.loading;
    this.loading=(async()=>{
      this.heroImages ||= {};
      await runLoadTasks([
        async()=>{this.heroRecords ||= await loadJSON('../assets/menu/heroes.json',import.meta.url);},
        ...['background','logo'].map(name=>async()=>{
          this.assets[name] ||= await loadImage('../assets/menu/'+(name==='logo'?'logo-alpha':'background-drawn')+'.png',import.meta.url);
        }),
        ...['nico','stefan','torsten','andreas'].map(id=>async()=>{
          const file='hero-'+id+'.png';
          this.heroImages[file] ||= await loadImage('../assets/menu/'+file,import.meta.url);
        }),
      ],onProgress);
      const heroes=this.heroRecords;
      if(!Array.isArray(heroes)||heroes.length!==4||heroes.some(hero=>!this.heroImages[hero.file]))throw Error('Vier Menüfiguren erforderlich');
      this.heroes=heroes;
      this.canvas.dataset.characters=String(heroes.length);
      return this;
    })().finally(()=>{this.loading=null;});
    return this.loading;
  }
  drawLogo(canvas){
    if(!canvas)return;canvas.width=1400;canvas.height=596;const c=canvas.getContext('2d');c.clearRect(0,0,1400,596);
    // Original approved wordmark, with only its surrounding empty space cropped.
    c.drawImage(this.assets.logo,68,206,1400,596,0,0,1400,596);
  }
  setActive(active){this.canvas.hidden=!active;if(active)this.resize();}
  drawHero(hero,index){
    const image=hero.file?this.heroImages[hero.file]:this.assets.heroes;
    const c=this.c,b=hero.source,scale=hero.height/b.h,w=b.w*scale,h=hero.height,x=hero.x+this.offset.x*(4+index*.4),y=hero.y+this.offset.y*2;
    const phase=this.time*(1.45+index*.12)+index*1.7,breath=this.reduced.matches?0:Math.sin(phase),guard=this.reduced.matches?0:Math.sin(phase*.61+index);
    // Contact shadow stays on the ground while the torso and guard move.
    c.save();c.translate(x+w*.52,y+h-2);c.scale(w*.45,10);const shadow=c.createRadialGradient(0,0,.05,0,0,1);shadow.addColorStop(0,'rgba(1,4,9,.7)');shadow.addColorStop(1,'rgba(1,4,9,0)');c.fillStyle=shadow;c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.fill();c.restore();
    // A continuous strip mesh pins the feet and varies chest, shoulder and head
    // movement smoothly, rather than moving the entire cutout up and down.
    const strips=48,point=t=>({x:guard*3.7*Math.pow(1-t,1.6),y:-breath*2.9*Math.pow(1-t,1.5)});
    for(let row=0;row<strips;row++){
      const t=row/strips,tn=(row+1)/strips,a=point(t),z=point(tn),chest=Math.exp(-Math.pow((t-.34)/.2,2)),stretch=1+breath*.008*chest;
      const sourceY=b.y+b.h*t,sourceH=b.h/strips,dy=y+h*t+a.y,dh=h/strips+z.y-a.y;
      c.drawImage(image,b.x,sourceY,b.w,sourceH,x+a.x-w*(stretch-1)*.5,dy,w*stretch,dh+.22);
    }
  }
  rain(front=false){
    const c=this.c,count=front?34:112;c.save();c.strokeStyle=front?'rgba(200,224,237,.2)':'rgba(139,189,211,.15)';c.lineWidth=front?.8:.6;c.beginPath();
    for(let i=0;i<count;i++){const seed=i+(front?400:0),speed=front?560:350,x=(hash(seed)*1380-this.time*27+this.offset.x*4+13800)%1380-50,y=(hash(seed+82)*900+this.time*speed)%900-90,length=front?18:10;c.moveTo(x,y);c.lineTo(x-1.9,y+length);}c.stroke();c.restore();
  }
  render(dt){
    if(this.canvas.hidden||!this.heroes)return;if(!this.reduced.matches&&!document.hidden)this.time+=Math.min(dt,.05);this.frames++;
    this.offset.x+=(this.pointer.x-this.offset.x)*Math.min(1,dt*4);this.offset.y+=(this.pointer.y-this.offset.y)*Math.min(1,dt*4);if(this.reduced.matches)this.offset={x:0,y:0};
    const c=this.c;c.setTransform(this.canvas.width/W,0,0,this.canvas.height/H,0,0);c.drawImage(this.assets.background,-5+this.offset.x*2,-4+this.offset.y*2,W+10,H+8);
    const left=c.createLinearGradient(0,0,580,0);left.addColorStop(0,'rgba(2,5,10,.18)');left.addColorStop(1,'rgba(2,5,10,0)');c.fillStyle=left;c.fillRect(0,0,580,H);
    this.rain();if(this.sceneLightingEnabled!==false)this.lampFlares.draw(c,menuLamps(this.offset),0,{time:this.time,reducedMotion:this.reduced.matches});
    // Back figures first, crouching figure last, all independently animated.
    for(const index of [1,2,0,3])this.drawHero(this.heroes[index],index);
    this.rain(true);
    if(this.frames%20===0){this.canvas.dataset.sceneTime=this.time.toFixed(3);this.canvas.dataset.motion=this.reduced.matches?'reduced':'animated';this.canvas.dataset.frames=String(this.frames);}
  }
}
