import {getNearbyCameo} from './nightlife-cameos.js';

/** Cameos live on the rear pavement, outside the fighting entity/target list. */
export function cameoGeometry(renderer,cameo){
 const art=renderer.cameoMetadata?.[cameo.id],image=renderer.assets?.[art?.asset||'nightlife-cameos'],source=art?.source;
 if(!image||!source||![source.x,source.y,source.w,source.h,art.height,cameo.x,cameo.y].every(Number.isFinite)||source.w<=0||source.h<=0||art.height<=0)return null;
 if(source.x<0||source.y<0||source.x+source.w>image.width||source.y+source.h>image.height)return null;
 const scale=art.height/source.h,width=source.w*scale,height=art.height,x=cameo.x-(renderer.camera||0),y=cameo.y;
 if(x+width/2<-40||x-width/2>1320)return null;
 const reduced=renderer.motionReduced?.()===true,time=reduced?0:Math.max(0,Number(renderer.time)||0);
 const phase=cameo.id==='betty'?1.7:cameo.id==='trueby'?3.2:0;
 const breath=reduced?0:Math.sin(time*1.45+phase)*.0022,sway=reduced?0:Math.sin(time*.75+phase)*.45;
 return{image,source,x:x+sway,y,width,height,drawHeight:height*(1+breath),shadowWidth:Math.max(20,Math.min(95,width*.4))};
}

export function drawNightlifeCameos(renderer){
 const game=renderer.game,cameos=game?.cameos||[];if(!cameos.length)return;
 const c=renderer.c,heroes=game.cooperative?(game.heroes||[]):[game.player].filter(Boolean);
 const nearby=new Set(heroes.map(hero=>typeof game.getNearbyCameo==='function'?game.getNearbyCameo(hero):getNearbyCameo(game,hero)).filter(Boolean));
 for(const cameo of cameos){
  const geometry=cameoGeometry(renderer,cameo);if(!geometry)continue;
  const{image,source,x,y,width,height,drawHeight,shadowWidth}=geometry;
  c.save();
  c.beginPath();c.ellipse(x,y+2,shadowWidth,6,0,0,Math.PI*2);c.fillStyle='#02060bb0';c.fill();
  // The whole transparent figure and its bike/desk retain one ground anchor.
  c.drawImage(image,source.x,source.y,source.w,source.h,x-width/2,y-drawHeight,width,drawHeight);
  const thanked=cameo.used&&game.mode==='playing'&&game.arena?.cleared&&cameo.arenaIndex===game.arena?.index&&heroes.some(hero=>hero.hp>0&&Math.hypot(cameo.x-hero.x,(cameo.y-hero.y)*1.8)<=110);
  if(nearby.has(cameo)||thanked){
   const labelY=Math.max(68,y-height-26);
   c.font='12px "Freiburg Display",Impact,sans-serif';c.textAlign='center';c.textBaseline='middle';
   const name=String(cameo.name||cameo.id).toUpperCase(),prompt=thanked?'DANKE!':`${game.cooperative?'E / O / LB':'E / LB'} · ${cameo.actionLabel||'BEGRÜSSEN'}`.toUpperCase();
   const boxWidth=Math.min(280,Math.max(130,c.measureText?.(prompt)?.width+28||180,c.measureText?.(name)?.width+28||180));
   const labelX=Math.max(boxWidth/2+8,Math.min(1272-boxWidth/2,x));
   c.fillStyle='#070a10cf';c.fillRect(labelX-boxWidth/2,labelY-13,boxWidth,42);
   c.fillStyle='#f4eee5';c.fillText(name,labelX,labelY);
   c.font='10px Arial,sans-serif';c.fillStyle=thanked?'#beb8ad':'#e6a1a3';c.fillText(prompt,labelX,labelY+17);
  }
  c.restore();
 }
}
