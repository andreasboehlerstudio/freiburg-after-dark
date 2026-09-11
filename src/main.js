import {LoadingFlow} from './loading-flow.js';
import {Game,HEROES,LEVELS} from './engine.js';
import {combatFrame,clipSpriteFrame} from './combat-animation.js';
import {Renderer} from './renderer.js';
import {AudioEngine} from './audio.js';
import {MenuScene} from './menu-scene.js';
import {LevelCelebration,CELEBRATION_AUTO_CONTINUE} from './level-celebration.js';
const canvas=document.querySelector('#game'),overlay=document.querySelector('#overlay'),toolbar=document.querySelector('#toolbar'),dev=document.querySelector('#dev');
const renderer=new Renderer(canvas),audio=new AudioEngine(),keys=new Set(),menuScene=new MenuScene(document.querySelector("#menu-art")),celebration=new LevelCelebration(canvas);
const params=new URLSearchParams(location.search),isDev=params.has('dev'); const inputSeen={},pressedUntil={}; const proof=document.createElement('a'); proof.id='frame-export'; proof.hidden=true; document.body.appendChild(proof); function exportFrame(){proof.href=canvas.toDataURL('image/jpeg',0.92); proof.download='freiburg-gameplay.jpg';}
const SAVE_KEY=isDev?'fr-after-dark-qa-save':'fr-after-dark-v1-save',SETTINGS_KEY=isDev?'fr-after-dark-qa-settings':'fr-after-dark-v1-settings';
const COLORS={nico:'#e77663',stefan:'#e9a044',torsten:'#a5c89c',andreas:'#7296bf'};
let save={level:0,high:0,wins:0,hero:'andreas',partner:'nico'},settings={volume:.6,musicVolume:.5,effectsVolume:.8,voiceVolume:.75,music:true,shake:!matchMedia('(prefers-reduced-motion: reduce)').matches};
try{save={...save,...JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')};settings={...settings,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch{}
save.level=Math.max(0,Math.min(LEVELS.length-1,Number(save.level)||0));if(!HEROES[save.hero])save.hero='andreas';if(!HEROES[save.partner]||save.partner===save.hero)save.partner=Object.keys(HEROES).find(id=>id!==save.hero);
const persist=()=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}catch{}};
let screen='loading',hero=save.hero,partner=save.partner,selectionStep=0,last=performance.now(),acc=0,fps=0,frames=0,fpsAt=last,previousPad={},testAuto=false,testRate=1,testLog=[];
const loadingFlow=new LoadingFlow();
let menuReady=false,selectionReady=false,pendingLoad=null;
const game=new Game({onEvent:e=>{audio.play(e);if(e.type==='level'){save.level=Math.max(save.level,game.levelIndex);persist()}if(e.type==='victory'){save.wins++;save.high=Math.max(save.high,game.score);save.level=LEVELS.length-1;persist()}if(['wave','arena-clear','level-clear','level','defeat','victory','revive'].includes(e.type)){document.querySelector('#status').textContent=e.type==='level'?game.level?.name:e.type;testLog.push({type:e.type,time:game.time,level:game.levelIndex,x:Math.round(game.player?.x||0),camera:Math.round(game.camera),score:game.score});if(testLog.length>200)testLog.shift()}}});
function portrait(target,id,pose=0){
  const img=renderer.assets[id],meta=renderer.metadata[id];if(!img)return;
  const c=target.getContext('2d');target.width=800;target.height=1000;c.clearRect(0,0,800,1000);
  const frame=meta?.frames?.[pose],columns=meta?.columns||3,rows=meta?.rows||2;
  const cw=img.width/columns,ch=img.height/rows,b=frame?.bounds||frame||{x:0,y:0,w:cw,h:ch};
  const source=frame?.source||{x:(pose%columns)*cw+b.x,y:Math.floor(pose/columns)*ch+b.y,w:b.w,h:b.h};
  const scale=Math.min(740/source.w,970/source.h),dx=400-source.w*scale/2,dy=1000-source.h*scale;
  c.save();clipSpriteFrame(c,frame,source,dx,dy,scale);
  c.drawImage(img,source.x,source.y,source.w,source.h,dx,dy,source.w*scale,source.h*scale);c.restore();
}
function applyAudioSettings(){
 audio.setVolume(settings.volume);
 audio.setMix({music:settings.musicVolume,effects:settings.effectsVolume,voice:settings.voiceVolume});
 audio.setMusic(settings.music);
}
function syncAudio(){
 const menu=['menu','select'].includes(screen)||(game.mode==='menu'&&['settings','controls'].includes(screen));
 audio.update(screen==='loading'?{mode:'loading',levelIndex:game.levelIndex,camera:game.camera}:game,{menu,celebrating:screen==='level-clear',visible:!document.hidden&&document.hasFocus()});
 updateMenuSound();
}
function updateMenuSound(){
 const button=document.querySelector('#menu-sound');if(!button)return;
 const track=audio.tracks.get('menu'),running=audio.ctx?.state==='running';
 const on=!!(settings.music&&running&&track?.playing);
 const failed=!!track?.failed;
 const label=!settings.music?'MUSIK AUS':on?'MUSIK AN':failed?'MUSIK NICHT VERFÜGBAR':'MUSIK AKTIVIEREN';
 if(button.textContent!==label)button.textContent=label;
 button.setAttribute('aria-pressed',String(on));
 button.setAttribute('aria-label',on?'Musik ausschalten':'Musik aktivieren');
 button.title=on?'Startmusik läuft als Loop':failed?'Die Musik konnte nicht geladen werden.':'Startmusik einschalten';
}
async function unlockAudio(){
 applyAudioSettings();syncAudio();
 await audio.unlock();syncAudio();
}
function toggleMenuMusic(){
 const on=settings.music&&audio.ctx?.state==='running'&&audio.tracks.get('menu')?.playing;
 settings.music=!on;applyAudioSettings();persist();
 if(settings.music)void unlockAudio();else syncAudio();
}
function activateAudio(event){
 if(!event.isTrusted||event.repeat||event.target?.closest?.('#menu-sound'))return;
 if(audio.ctx?.state!=='running')void unlockAudio();
}
addEventListener('pointerdown',activateAudio,{capture:true});
addEventListener('keydown',activateAudio,{capture:true});
function setScreen(name,html){screen=name;document.querySelector("#stage").dataset.screen=name;menuScene.setActive(name==='menu'||(game.mode==='menu'&&['settings','controls'].includes(name)));overlay.innerHTML=html;toolbar.hidden=name!=='playing';keys.clear();for(const k in pressedUntil)delete pressedUntil[k];overlay.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>act(b.dataset.action)));overlay.querySelectorAll('canvas[data-hero]').forEach(c=>portrait(c,c.dataset.hero,Number(c.dataset.pose)||0));syncAudio();}
function menu(){if(!menuReady)return;loadingFlow.cancel();pendingLoad=null;celebration.stop();game.setMode('menu');testAuto=false;setScreen('menu',`<section class="cinematic-menu" aria-label="Hauptmenü"><h1 class="sr-only">Freiburg After Dark</h1><canvas class="menu-logo" role="img" aria-label="Freiburg After Dark"></canvas><nav class="cinematic-actions" aria-label="Spielmenü"><button class="cinematic-button is-selected" data-action="choose">Spiel starten</button><button class="cinematic-button" data-action="controls">Steuerung</button><button class="cinematic-button" data-action="settings">Einstellungen</button>${save.level>0?'<button class="cinematic-button continue" data-action="continue">Fortsetzen</button>':''}</nav><div class="start-prompt"><kbd>ENTER</kbd><span>ZUM STARTEN</span></div><button id="menu-sound" class="menu-sound" data-action="menu-music" aria-label="Musik aktivieren" aria-pressed="false">MUSIK AKTIVIEREN</button></section>`);menuScene.drawLogo(overlay.querySelector('.menu-logo'));overlay.querySelectorAll('.cinematic-button').forEach(button=>{const select=()=>{overlay.querySelectorAll('.cinematic-button').forEach(b=>b.classList.toggle('is-selected',b===button));};button.addEventListener('pointerenter',select);button.addEventListener('focus',select);});}

function showLoading(request,error=null){
 const detail=error?(navigator.onLine===false?'Du bist gerade offline. Verbinde dich mit dem Internet und versuche es erneut.':'Ein Teil der Grafiken konnte nicht geladen werden. Versuche es bitte noch einmal. Bereits geladene Bilder bleiben bereit.'):request.detail;
 setScreen('loading',`<section class="loading loading-stage" aria-labelledby="loading-title"><div class="loading-card"><p class="loading-eyebrow">FREIBURG <span>AFTER DARK</span></p><h1 id="loading-title">${error?'Die Nacht wartet.':request.title}</h1><p class="loading-detail" ${error?'role="alert"':'role="status"'}>${detail}</p>${error?'':`<div class="loading-meter"><i class="loading-spinner" aria-hidden="true"></i><progress id="loading-progress" aria-label="Ladefortschritt" value="0" max="100"></progress><span id="loading-count" aria-hidden="true">0 %</span></div><p class="loading-note">Beim nächsten Besuch geht es schneller.</p>`}<div class="actions">${error?'<button class="primary" data-action="retry-load">Erneut versuchen</button>':''}${menuReady?'<button class="secondary" data-action="menu">Zum Hauptmenü</button>':''}</div></div></section>`);
 if(error)overlay.querySelector('[data-action="retry-load"]')?.focus();
}
function updateLoading({completed=0,total=1}={}){
 const progress=overlay.querySelector('#loading-progress'),count=overlay.querySelector('#loading-count');
 if(!progress)return;
 const percent=Math.max(0,Math.min(100,Math.round(completed/Math.max(1,total)*100)));
 progress.value=percent;if(count)count.textContent=percent+' %';
}
function runLoad(request){
 if(loadingFlow.busy)return Promise.resolve(false);
 pendingLoad=request;
 return loadingFlow.run({
  onStart:()=>showLoading(request),load:request.load,onProgress:updateLoading,
  onSuccess:()=>{pendingLoad=null;request.ready();},
  onError:error=>{console.warn('Die Grafiken konnten nicht vollständig geladen werden.',error);showLoading(request,error);},
 });
}
async function loadPlayAssets(level,team,onProgress){
 let graphics={completed:0,total:1},celebrationDone=0;
 const report=()=>onProgress({completed:graphics.completed+celebrationDone,total:graphics.total+1});
 await Promise.all([
  renderer.loadLevel(level,team,progress=>{graphics=progress;report();}),
  celebration.load().then(()=>{celebrationDone=1;report();}),
 ]);
}
function enterPlaying(){
 setScreen('playing','');canvas.focus();last=performance.now();acc=0;
 if(document.hidden||!document.hasFocus())pause();
}

function choose(){if(!selectionReady){if(loadingFlow.busy)return;void runLoad({title:'Dein Team wartet.',detail:'Die Charakterauswahl wird vorbereitet.',load:progress=>renderer.loadSelection(progress),ready:()=>{selectionReady=true;choose();}});return;}const selected=selectionStep?partner:hero;setScreen('select',`<section class="screen selection"><div class="eyebrow">${selectionStep?'02 / Dein Partner kämpft selbstständig':'01 / Dein Held. Dein Kampfstil.'}</div><h1>${selectionStep?'Wähle deinen Sidekick':'Wähle deinen Charakter'}</h1><p class="subline">${selectionStep?'Er folgt dir, greift Gegner an und hilft dir wieder auf die Beine.':'Alle vier Helden sind frei spielbar. Jeder hat eine eigene Spezialattacke.'}</p><div class="roster">${Object.values(HEROES).map(h=>`<button class="card ${selected===h.id?'selected':''}" data-hero-button="${h.id}" style="--accent:${COLORS[h.id]}" ${selectionStep&&h.id===hero?'disabled':''} aria-label="${h.name} wählen" aria-pressed="${selected===h.id}">${selected===h.id?'<span class="badge">'+(selectionStep?'SIDEKICK':'DEIN HELD')+'</span>':''}<canvas data-hero="${h.id}"></canvas><span class="card-copy"><span class="card-name">${h.name}</span><span class="card-special">${h.specialName}</span><span class="card-stats">${Object.entries(h.stats).map(([k,v])=>`${k} ${v}/5`).join(' · ')}</span></span></button>`).join('')}</div><div class="selection-footer"><div class="selection-description">${HEROES[selected].description}</div><div class="actions"><button class="secondary" data-action="back">Zurück</button><button class="primary" data-action="${selectionStep?'start':'partner'}">${selectionStep?'Nacht starten →':'Sidekick wählen →'}</button></div></div></section>`);overlay.querySelectorAll('[data-hero-button]').forEach(b=>b.onclick=()=>{if(selectionStep)partner=b.dataset.heroButton;else{hero=b.dataset.heroButton;if(partner===hero)partner=Object.keys(HEROES).find(id=>id!==hero)}choose()})}
function start(level=0){
 if(loadingFlow.busy)return;
 const chosenHero=hero,chosenPartner=partner,index=Math.max(0,Math.min(LEVELS.length-1,level|0));
 void unlockAudio();
 return runLoad({title:LEVELS[index].name,detail:'Dein Team und dieses Viertel werden vorbereitet.',load:progress=>loadPlayAssets(index,[chosenHero,chosenPartner],progress),ready:()=>{
  hero=chosenHero;partner=chosenPartner;save.hero=hero;save.partner=partner;persist();
  celebration.stop();game.start(hero,partner,index);renderer.retainWorld(index);enterPlaying();
 }});
}
function pause(){if(screen==='loading'||game.mode!=='playing')return;game.pause();setScreen('pause',`<div class="modal-backdrop"><section class="modal"><div class="eyebrow">Eine kurze Verschnaufpause</div><h1>Die Straße wartet.</h1><p class="subline">${LEVELS[game.levelIndex].name} · Abschnitt ${game.arena.index+1} / 4</p><div class="actions"><button class="primary" data-action="resume">Weiterspielen</button><button class="secondary" data-action="restart">Level neu starten</button><button class="secondary" data-action="controls">Steuerung</button><button class="secondary" data-action="settings">Einstellungen</button><button class="secondary" data-action="menu">Hauptmenü</button></div></section></div>`)}
let returnScreen='menu';
function controls(){returnScreen=game.mode==='paused'?'pause':'menu';setScreen('controls',`<div class="modal-backdrop"><section class="modal"><div class="eyebrow">Tastatur & Standard-Gamepad</div><h1>Mach die Straße frei.</h1><div class="control-grid"><div>Bewegen <kbd>WASD / ↑↓←→</kbd></div><div>Schlag / Combo <kbd>J · Pad X</kbd></div><div>Schwerer Tritt <kbd>K · Pad Y</kbd></div><div>Springen <kbd>LEER · Pad A</kbd></div><div>Ausweichen <kbd>SHIFT · Pad B</kbd></div><div>Spezial (45 Energie) <kbd>L · Pad RB</kbd></div><div>Aufheben / Werfen <kbd>E · Pad LB</kbd></div><div>Pause / Vollbild <kbd>ESC / F</kbd></div></div><p class="subline">J für eine dreiteilige Combo mehrfach drücken oder halten. In der Luft J oder K für einen gezielten Sprungtritt. E hebt Fahrräder oder Baseballschläger auf; mit E wirfst du sie. Mit einem Schläger schlägst du per J zu. Gegner müssen auf derselben Höhe und vor dir stehen. Rote Markierungen kündigen Angriffe an: ausweichen oder aus der Linie gehen.</p><p class="small">Dein Sidekick kämpft automatisch. Bei ihm E halten hilft schneller; sonst steht er nach 12 Sekunden auf. Er kann dich zweimal pro Level retten. Sind beide am Boden, endet der Versuch. Essen und Energiedrinks werden beim Darüberlaufen eingesammelt.</p><div class="actions"><button class="primary" data-action="close-sub">Verstanden</button></div></section></div>`)}
function options(){returnScreen=game.mode==='paused'?'pause':'menu';setScreen('settings',`<div class="modal-backdrop"><section class="modal"><div class="eyebrow">Deine Nacht, dein Sound</div><h1>Einstellungen</h1><label class="setting">Lautstärke<input id="volume" aria-label="Lautstärke" type="range" min="0" max="100" value="${Math.round(settings.volume*100)}"></label>${[["musicVolume","Musik"],["effectsVolume","Treffer & Effekte"],["voiceVolume","Kampflaute"]].map(([id,label])=>`<label class="setting">${label}<input id="${id}" aria-label="${label}" type="range" min="0" max="100" value="${Math.round(settings[id]*100)}"></label>`).join('')}<label class="setting">Musik an<input id="music" type="checkbox" ${settings.music?'checked':''}></label><label class="setting">Kamerawackeln bei Treffern<input id="shake" type="checkbox" ${settings.shake?'checked':''}></label><p class="small">Auflösung folgt Fenster und Bildschirm bis 3840 × 2160. F schaltet Vollbild. Bei Fokusverlust pausiert das Spiel automatisch. Einstellungen und freigespielte Level werden auf diesem Gerät gespeichert.</p><div class="actions"><button class="primary" data-action="close-sub">Fertig</button><button class="secondary" data-action="fullscreen">Vollbild</button></div></section></div>`);document.querySelector('#volume').oninput=e=>{settings.volume=Number(e.target.value)/100;audio.setVolume(settings.volume);persist()};for(const id of ['musicVolume','effectsVolume','voiceVolume'])document.querySelector('#'+id).oninput=e=>{settings[id]=Number(e.target.value)/100;audio.setMix({music:settings.musicVolume,effects:settings.effectsVolume,voice:settings.voiceVolume});persist()};for(const id of ['music','shake'])document.querySelector('#'+id).onchange=e=>{settings[id]=e.target.checked;audio.setMusic(settings.music);persist()}}
function result(){const win=game.mode==='victory';save.high=Math.max(save.high,game.score);persist();testAuto=false;setScreen(win?'victory':'defeat',`<div class="modal-backdrop"><section class="modal"><div class="eyebrow">${win?'Sechs Viertel. Gemeinsam geschafft.':'Die Nacht ist noch nicht vorbei.'}</div><h1>${win?'Freiburg atmet auf.':'Einmal tief durchatmen.'}</h1><p class="subline">${win?`${HEROES[hero].name} und ${HEROES[partner].name} haben alle ${LEVELS.length} Viertel befreit.`:'Dein Team ist am Boden. Starte dieses Level mit voller Kraft erneut.'}</p><div class="result-stats"><div><strong>${game.score.toLocaleString('de-DE')}</strong><span>PUNKTE</span></div><div><strong>${Math.floor(game.time/60)}:${String(Math.floor(game.time%60)).padStart(2,'0')}</strong><span>ZEIT</span></div><div><strong>${game.stats.kills||0}</strong><span>GEGNER</span></div></div><div class="actions"><button class="primary" data-action="${win?'new':'restart'}">${win?'Neue Nacht':'Level erneut versuchen'}</button><button class="secondary" data-action="menu">Hauptmenü</button></div></section></div>`)}
function fullscreen(){if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.querySelector('#stage').requestFullscreen().catch(()=>{})}
function showLevelCelebration(){
 if(screen==='level-clear')return;
 celebration.begin(renderer,game);
 const final=game.levelIndex===LEVELS.length-1;
 setScreen('level-clear',`<section class="level-celebration" aria-labelledby="celebration-title" aria-describedby="celebration-subtitle"><header class="celebration-heading"><p class="celebration-location">${game.level.name} · VIERTEL BEFREIT</p><h1 id="celebration-title">CONGRATULATIONS</h1><p id="celebration-subtitle">YOU BEAT THE LEVEL</p></header><p class="sr-only">Drei erwachsene Frauen jubeln deinem Team zu.</p><div class="celebration-footer"><p class="celebration-score"><strong>${game.score.toLocaleString('de-DE')}</strong><span>PUNKTE</span></p><div class="celebration-next"><button class="primary celebration-continue" data-action="next-level" disabled>${final?'Zur Abschlussfeier':'Weiter zum nächsten Viertel'} <span aria-hidden="true">→</span></button><span class="celebration-key">EINEN MOMENT GENIESSEN</span></div><p class="celebration-progress">${String(game.stats.levelsCleared).padStart(2,'0')}<span> / ${String(LEVELS.length).padStart(2,'0')} VIERTEL</span></p></div></section>`);
 document.querySelector('#status').textContent=`Congratulations. You beat the level. ${game.level.name} befreit.`;
}
function continueCelebration(){
 if(loadingFlow.busy||screen!=='level-clear'||!celebration.ready||game.mode!=='level-clear'||document.hidden||!document.hasFocus())return;
 const clearedLevel=game.levelIndex,nextLevel=clearedLevel+1,team=[game.player.heroId,game.partner.heroId];
 const advance=()=>{
  if(game.mode!=='level-clear'||game.levelIndex!==clearedLevel||!game.continueLevel())return;
  celebration.stop();acc=0;last=performance.now();
  if(game.mode==='victory')result();else{renderer.retainWorld(nextLevel);enterPlaying();}
 };
 if(nextLevel>=LEVELS.length){advance();return;}
 return runLoad({title:LEVELS[nextLevel].name,detail:'Das nächste Viertel wird vorbereitet.',load:progress=>loadPlayAssets(nextLevel,team,progress),ready:advance});
}
function act(action){if(loadingFlow.busy&&action!=='menu')return;switch(action){case'retry-load':if(pendingLoad)void runLoad(pendingLoad);break;case'next-level':continueCelebration();break;case'menu-music':toggleMenuMusic();break;case'choose':case'new':selectionStep=0;choose();break;case'partner':selectionStep=1;choose();break;case'back':if(selectionStep){selectionStep=0;choose()}else menu();break;case'start':testAuto=false;start();break;case'continue':start(save.level);break;case'restart':testAuto=false;start(game.levelIndex);break;case'resume':game.resume();setScreen('playing','');canvas.focus();last=performance.now();break;case'menu':menu();break;case'controls':controls();break;case'settings':options();break;case'close-sub':if(returnScreen==='pause'){game.resume();pause()}else menu();break;case'fullscreen':fullscreen();break;}}
const handled=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyJ','KeyK','KeyL','KeyE','Space','ShiftLeft','ShiftRight'];
addEventListener('keydown',e=>{inputSeen[e.code]=(inputSeen[e.code]||0)+1;
 if(screen==='loading'){
  if(handled.includes(e.code)||e.code==='Enter'||e.code==='Escape'||/^F\d+$/.test(e.code))e.preventDefault();
  if(e.code==='Escape'&&!e.repeat&&menuReady)menu();
  else if((e.code==='Enter'||e.code==='Space')&&!e.repeat){
   const focused=document.activeElement;
   if(focused?.matches('button:not(:disabled)')&&overlay.contains(focused))focused.click();
   else if(e.code==='Enter'&&!loadingFlow.busy&&pendingLoad)void runLoad(pendingLoad);
  }
  return;
 }
 if(screen==='level-clear'){
  if(e.code==='Enter'){e.preventDefault();if(!e.repeat)continueCelebration();return;}
  if(e.code==='Space'||e.code==='Escape'||handled.includes(e.code)||['F1','F2','F3','F4','F5','F6','F7'].includes(e.code)){e.preventDefault();return;}
 }
 if(screen==='menu'&&!e.repeat){const buttons=[...overlay.querySelectorAll('.cinematic-button')];if(['ArrowDown','ArrowUp','KeyS','KeyW'].includes(e.code)){e.preventDefault();let i=buttons.indexOf(document.activeElement);if(i<0)i=Math.max(0,buttons.findIndex(b=>b.classList.contains('is-selected')));const direction=['ArrowUp','KeyW'].includes(e.code)?-1:1;buttons[(i+direction+buttons.length)%buttons.length]?.focus();return;}if(e.code==='Enter'&&!buttons.includes(document.activeElement)&&document.activeElement?.id!=='menu-sound'){e.preventDefault();act('choose');return;}}if(isDev&&['F1','F2','F3','F4','F5','F6'].includes(e.code)){e.preventDefault();testAuto=false;start(Number(e.code.slice(1))-1);return}if(isDev&&e.code==='F7'){e.preventDefault();if(screen==='playing'){game.player.hp=0;game.partner.hp=0;}return}if(isDev&&e.code==='F10'){e.preventDefault();exportFrame();return}if(e.code==='Escape'&&!e.repeat){e.preventDefault();if(screen==='playing')pause();else if(screen==='pause')act('resume');else if(screen==='settings'||screen==='controls')act('close-sub');return}if(e.code==='KeyF'&&!e.repeat){fullscreen();return}if(isDev&&e.code==='F8'&&!e.repeat){e.preventDefault();testAuto=!testAuto;return}if(isDev&&e.code==='F9'&&!e.repeat){e.preventDefault();testRate=testRate===1?12:1;return}if(handled.includes(e.code)&&screen==='playing'){e.preventDefault();keys.add(e.code);pressedUntil[e.code]=performance.now()+100}});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();pause();syncAudio()});addEventListener('focus',syncAudio);document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();pause()}syncAudio()});document.querySelector('#pause').onclick=pause;document.querySelector('#fullscreen').onclick=fullscreen;
function input(){const has=(...codes)=>codes.some(k=>keys.has(k)||performance.now()<(pressedUntil[k]||0));const out={x:Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft')),y:Number(has('KeyS','ArrowDown'))-Number(has('KeyW','ArrowUp')),attack:has('KeyJ'),heavy:has('KeyK'),jump:has('Space'),special:has('KeyL'),dodge:has('ShiftLeft','ShiftRight'),revive:has('KeyE'),interact:has('KeyE')};const gp=Array.from(navigator.getGamepads?.()||[]).find(Boolean);if(gp){const p=i=>!!gp.buttons[i]?.pressed;if(p(9)&&!previousPad[9]){if(screen==='playing')pause();else if(screen==='pause')act('resume')}if(screen==='playing'){out.x=Math.abs(gp.axes[0])>.2?gp.axes[0]:p(15)?1:p(14)?-1:out.x;out.y=Math.abs(gp.axes[1])>.2?gp.axes[1]:p(13)?1:p(12)?-1:out.y;for(const [i,k] of [[2,'attack'],[3,'heavy'],[0,'jump'],[1,'dodge'],[5,'special'],[4,'revive'],[4,'interact']])out[k] ||= p(i)}else{const buttons=[...overlay.querySelectorAll('button:not(:disabled)')];let index=buttons.indexOf(document.activeElement);if((p(15)&&!previousPad[15])||(p(13)&&!previousPad[13]))buttons[(index+1)%buttons.length]?.focus();if((p(14)&&!previousPad[14])||(p(12)&&!previousPad[12]))buttons[(index-1+buttons.length)%buttons.length]?.focus();if(p(0)&&!previousPad[0]){if(index<0)buttons[0]?.focus();else buttons[index]?.click()}}previousPad=Object.fromEntries(gp.buttons.map((b,i)=>[i,b.pressed]))}return out;}
function autoInput(){
 const p=game.player;if(p.hp<=0)return{};
 const enemies=game.enemies.filter(e=>e.hp>0);
 if(!enemies.length)return game.obstacleInput(p,{x:p.x+600,y:p.y},{x:1});
 enemies.sort((a,b)=>Math.abs(a.x-p.x)+Math.abs(a.y-p.y)*2-Math.abs(b.x-p.x)-Math.abs(b.y-p.y)*2);
 const e=enemies[0],dx=e.x-p.x,dy=e.y-p.y,facing=Math.sign(dx)||p.facing;
 return game.obstacleInput(p,e,{x:Math.abs(dx)>80||p.facing!==facing?facing:0,y:Math.abs(dy)>20?Math.sign(dy):0,heavy:Math.abs(dx)<112&&Math.abs(dy)<45&&p.facing===facing,special:p.energy>=45&&Math.abs(dx)<175&&Math.abs(dy)<75&&p.facing===facing});
}
function tick(now){
 requestAnimationFrame(tick);
 const dt=Math.min(.1,(now-last)/1000);last=now;
 const cmd=input(),visible=!document.hidden&&document.hasFocus();
 if(screen==='playing'){
  acc+=dt;let guard=0;
  while(acc>=1/60&&guard++<8){
   for(let i=0;i<(isDev?testRate:1)&&game.mode==='playing';i++)game.update(1/60,isDev&&testAuto?autoInput():cmd);
   acc-=1/60;if(game.mode!=='playing')break;
  }
  if(game.mode==='level-clear')showLevelCelebration();
  else if(game.mode==='victory'||game.mode==='defeat')result();
 }else acc=0;
 const shake=game.shake;if(!settings.shake)game.shake=0;
 if(screen==='level-clear'){
  celebration.render(dt,{visible});
  const button=overlay.querySelector('.celebration-continue');
  if(celebration.ready&&button?.disabled){
   button.disabled=false;button.focus({preventScroll:true});
   overlay.querySelector('.celebration-key').textContent='ENTER ZUM WEITERSPIELEN';
  }
  if(isDev&&testAuto&&celebration.time>=CELEBRATION_AUTO_CONTINUE)continueCelebration();
 }else if(menuReady&&!menuScene.canvas.hidden)menuScene.render(dt);
 else if(screen==='loading'||!game.player){const c=canvas.getContext('2d');c.setTransform(1,0,0,1,0,0);c.fillStyle='#070a10';c.fillRect(0,0,canvas.width,canvas.height);}
 else renderer.render(game,dt);
 game.shake=shake;syncAudio();frames++;if(now-fpsAt>700){fps=Math.round(frames*1000/(now-fpsAt));frames=0;fpsAt=now;if(isDev){dev.hidden=!['playing','level-clear'].includes(screen);dev.textContent=JSON.stringify({fps,mode:game.mode,celebration:{active:celebration.active,time:Number(celebration.time.toFixed(2)),ready:celebration.ready},hero:game.player?.heroId,partner:game.partner?.heroId,level:game.levelIndex,arena:game.arena?.index,wave:game.wave,x:Math.round(game.player?.x||0),camera:Math.round(game.camera),hp:Math.round(game.player?.hp||0),partnerHp:Math.round(game.partner?.hp||0),held:game.player?.heldItem?.type||null,props:game.props?.map(p=>({type:p.type,state:p.state,x:Math.round(p.x),y:Math.round(p.y)})),attackKind:game.player?.attackKind,enemies:game.enemies?.filter(e=>e.hp>0).length,score:game.score,combo:game.combo,stats:game.stats,time:Math.round(game.time),buffer:[canvas.width,canvas.height],z:Math.round(game.player?.z||0),walk:{state:game.player?.state,active:game.player?.walking,distance:Math.round(game.player?.walkDistance||0),frame:renderer.walkFrame(game.player||{},hero),partnerDistance:Math.round(game.partner?.walkDistance||0)},combat:{...combatFrame(game.player),ready:!!renderer.assets['combat-'+hero],frames:renderer.combatMetadata[hero]?.frames?.length||0},inputSeen,auto:testAuto,rate:testRate,sound:{context:audio.ctx?.state,menu:audio.menu,celebrating:audio.celebrating,level:audio.level,voices:audio.voiceBuffers.size,errors:audio.errors,tracks:[...audio.tracks.values()].map(t=>({level:t.index,playing:t.playing,paused:t.media.paused,ready:t.media.readyState,loop:t.media.loop,time:Math.round(t.media.currentTime*10)/10}))},events:testLog.slice(-4)})}}}
applyAudioSettings();
void document.fonts?.load('16px "Freiburg Display"').catch(()=>{});
requestAnimationFrame(tick);
void runLoad({title:'Freiburg wird wach.',detail:'Die Nacht wird vorbereitet.',load:progress=>menuScene.load(progress),ready:()=>{menuReady=true;menu();if(settings.music)void unlockAudio();}});
