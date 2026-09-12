import {LoadingFlow} from './loading-flow.js';
import {migrateCampaignSave,CAMPAIGN_SAVE_VERSION} from './campaign-save.js';
import {Game,HEROES,LEVELS} from './engine.js';
import {combatFrame,clipSpriteFrame} from './combat-animation.js';
import {Renderer} from './renderer.js';
import {AudioEngine} from './audio.js';
import {MenuScene} from './menu-scene.js';
import {StartTutorial} from './start-tutorial.js';
import {LevelIntro} from './level-intro.js';
import {CoopLobby,GamepadInput,connectedPads} from './local-coop-input.js';
import {VictoryScreen,levelResultStats} from './victory-screen.js';
const canvas=document.querySelector('#game'),overlay=document.querySelector('#overlay'),toolbar=document.querySelector('#toolbar'),dev=document.querySelector('#dev');
const renderer=new Renderer(canvas),audio=new AudioEngine(),keys=new Set(),heldKeys=new Set(),blockedKeys=new Set(),menuScene=new MenuScene(document.querySelector("#menu-art")),celebration=new VictoryScreen(canvas,renderer,menuScene),tutorial=new StartTutorial(canvas,renderer,menuScene),levelIntro=new LevelIntro(canvas,renderer,menuScene);
const params=new URLSearchParams(location.search),isDev=params.has('dev'); const inputSeen={},pressedUntil={}; const proof=document.createElement('a'); proof.id='frame-export'; proof.hidden=true; document.body.appendChild(proof); function exportFrame(){proof.href=canvas.toDataURL('image/jpeg',0.92); proof.download='freiburg-gameplay.jpg';}
const SAVE_KEY=isDev?'fr-after-dark-qa-save':'fr-after-dark-v1-save',SETTINGS_KEY=isDev?'fr-after-dark-qa-settings':'fr-after-dark-v1-settings';
const COLORS={nico:'#e77663',stefan:'#e9a044',torsten:'#a5c89c',andreas:'#7296bf'};
let save={level:0,high:0,wins:0,hero:'andreas',partner:'nico'},settings={volume:.6,musicVolume:.5,effectsVolume:.8,voiceVolume:.75,music:true,shake:!matchMedia('(prefers-reduced-motion: reduce)').matches};
try{save={...save,...migrateCampaignSave(JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'),LEVELS)};settings={...settings,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch{}
save.level=Math.max(0,Math.min(LEVELS.length-1,Number(save.level)||0));if(!HEROES[save.hero])save.hero='andreas';if(!HEROES[save.partner]||save.partner===save.hero)save.partner=Object.keys(HEROES).find(id=>id!==save.hero);
const persist=()=>{save.campaignVersion=CAMPAIGN_SAVE_VERSION;save.levelId=LEVELS[save.level].id;try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}catch{}};
let screen='loading',hero=save.hero,partner=save.partner,selectionStep=0,last=performance.now(),acc=0,fps=0,frames=0,fpsAt=last,testAuto=false,testRate=1,testLog=[];
const loadingFlow=new LoadingFlow(),coopLobby=new CoopLobby(Object.keys(HEROES)),padInput=new GamepadInput();
const gamepads=()=>navigator.getGamepads?.()||[];
let chosenMode='solo',requestedLevel=0,activeSession=null,lobbyFingerprint='',lobbyNotice='',disconnectFingerprint='',controllerReturn='playing';
let menuReady=false,selectionReady=false,pendingLoad=null,pendingTutorial=null,pendingIntro=null,introGeneration=0,screenGeneration=0;
let levelBaseline={index:0,score:0,time:0,kills:0};
const game=new Game({onEvent:e=>{audio.play(e);if(e.type==='level'){levelBaseline={index:game.levelIndex,score:game.score,time:game.time,kills:game.stats.kills||0};save.level=Math.max(save.level,game.levelIndex);persist()}if(e.type==='victory'){save.wins++;save.high=Math.max(save.high,game.score);save.level=LEVELS.length-1;persist()}if(['wave','arena-clear','level-clear','level','defeat','victory','revive'].includes(e.type)){document.querySelector('#status').textContent=e.type==='level'?game.level?.name:e.type;testLog.push({type:e.type,time:game.time,level:game.levelIndex,x:Math.round(game.player?.x||0),camera:Math.round(game.camera),score:game.score});if(testLog.length>200)testLog.shift()}}});
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
 const menu=['menu','mode','coop','select','tutorial','level-intro'].includes(screen)||(game.mode==='menu'&&['settings','controls'].includes(screen));
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
function setScreen(name,html){const generation=++screenGeneration;if(screen==='level-clear'&&name!=='level-clear')celebration.stop();if(screen==='level-intro'&&name!=='level-intro'){levelIntro.stop();pendingIntro=null;introGeneration++;}if(screen==='tutorial'&&name!=='tutorial'){tutorial.stop();pendingTutorial=null;}screen=name;document.querySelector("#stage").dataset.screen=name;menuScene.setActive(['menu','mode','coop'].includes(name)||(game.mode==='menu'&&['settings','controls'].includes(name)));overlay.innerHTML=html;toolbar.hidden=name!=='playing';keys.clear();for(const k in pressedUntil)delete pressedUntil[k];overlay.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{if(generation===screenGeneration)act(b.dataset.action);}));overlay.querySelectorAll('canvas[data-hero]').forEach(c=>portrait(c,c.dataset.hero,Number(c.dataset.pose)||0));syncAudio();}
function menu(){if(!menuReady)return;loadingFlow.cancel();pendingLoad=null;activeSession=null;celebration.stop();game.setMode('menu');testAuto=false;setScreen('menu',`<section class="cinematic-menu" aria-label="Hauptmenü"><h1 class="sr-only">Freiburg After Dark</h1><canvas class="menu-logo" role="img" aria-label="Freiburg After Dark"></canvas><nav class="cinematic-actions" aria-label="Spielmenü"><button class="cinematic-button is-selected" data-action="choose">Spiel starten</button><button class="cinematic-button" data-action="controls">Steuerung</button><button class="cinematic-button" data-action="settings">Einstellungen</button>${save.level>0?`<button class="cinematic-button continue" data-action="continue">Fortsetzen · Level ${save.level+1}/${LEVELS.length}</button>`:''}</nav><div class="start-prompt"><kbd>ENTER</kbd><span>ZUM STARTEN</span></div><p class="menu-campaign-info">${LEVELS.length} LEVEL · EINE NACHT</p><button id="menu-sound" class="menu-sound" data-action="menu-music" aria-label="Musik aktivieren" aria-pressed="false">MUSIK AKTIVIEREN</button></section>`);menuScene.drawLogo(overlay.querySelector('.menu-logo'));overlay.querySelectorAll('.cinematic-button').forEach(button=>{const select=()=>{overlay.querySelectorAll('.cinematic-button').forEach(b=>b.classList.toggle('is-selected',b===button));};button.addEventListener('pointerenter',select);button.addEventListener('focus',select);});}

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
 // A held confirmation key must be released before it can become a game action.
 blockedKeys.clear();for(const code of heldKeys)blockedKeys.add(code);
 padInput.blockHeld(gamepads());
 setScreen('playing','');canvas.focus();last=performance.now();acc=0;
 if(activeSession?.cooperative&&coopLobby.missing(gamepads(),activeSession.bindings).length)showControllerLost();
 else if(document.hidden||!document.hasFocus())pause();
}

function choose(){if(!selectionReady){if(loadingFlow.busy)return;void runLoad({title:'Dein Team wartet.',detail:'Die Charakterauswahl wird vorbereitet.',load:progress=>renderer.loadSelection(progress),ready:()=>{selectionReady=true;choose();}});return;}const selected=selectionStep?partner:hero;setScreen('select',`<section class="screen selection"><div class="eyebrow">${selectionStep?'02 / Dein Partner kämpft selbstständig':'01 / Dein Held. Dein Kampfstil.'}</div><h1>${selectionStep?'Wähle deinen Sidekick':'Wähle deinen Charakter'}</h1><p class="subline">${selectionStep?'Er folgt dir, greift Gegner an und hilft dir wieder auf die Beine.':'Alle vier Helden sind frei spielbar. Jeder hat eine eigene Spezialattacke.'}</p><div class="roster">${Object.values(HEROES).map(h=>`<button class="card ${selected===h.id?'selected':''}" data-hero-button="${h.id}" style="--accent:${COLORS[h.id]}" ${selectionStep&&h.id===hero?'disabled':''} aria-label="${h.name} wählen" aria-pressed="${selected===h.id}">${selected===h.id?'<span class="badge">'+(selectionStep?'SIDEKICK':'DEIN HELD')+'</span>':''}<canvas data-hero="${h.id}"></canvas><span class="card-copy"><span class="card-name">${h.name}</span><span class="card-special">${h.specialName}</span><span class="card-stats">${Object.entries(h.stats).map(([k,v])=>`${k} ${v}/5`).join(' · ')}</span></span></button>`).join('')}</div><div class="selection-footer"><div class="selection-description">${HEROES[selected].description}</div><div class="actions"><button class="secondary" data-action="back">Zurück</button><button class="primary" data-action="${selectionStep?'start':'partner'}">${selectionStep?'Nacht starten →':'Sidekick wählen →'}</button></div></div></section>`);overlay.querySelectorAll('[data-hero-button]').forEach(b=>b.onclick=()=>{if(selectionStep)partner=b.dataset.heroButton;else{hero=b.dataset.heroButton;if(partner===hero)partner=Object.keys(HEROES).find(id=>id!==hero)}choose()})}
function modeScreen(level=0){
 requestedLevel=Math.max(0,Math.min(LEVELS.length-1,level|0));activeSession=null;game.setMode('menu');testAuto=false;
 setScreen('mode',`<section class="mode-screen" aria-labelledby="mode-title"><p class="eyebrow">${requestedLevel?`WEITER IN LEVEL ${requestedLevel+1} / ${LEVELS.length}`:'DEINE NACHT. DEIN TEAM.'}</p><h1 id="mode-title">Gemeinsam durch Freiburg.</h1><p class="subline">Wähle, wer heute mit dir auf die Straße geht.</p><div class="mode-choices"><button class="mode-choice" data-action="solo"><span class="mode-count">1 SPIELER + SIDEKICK</span><strong>Solo</strong><span>Du spielst deinen Helden. Dein Partner kämpft automatisch an deiner Seite.</span></button><button class="mode-choice" data-action="coop"><span class="mode-count">2–4 SPIELER · LOKAL</span><strong>Couch-Koop</strong><span>Bis zu vier Gamepads an einem Bildschirm. Spieler 1 kann auch die Tastatur nutzen.</span></button></div><div class="actions"><button class="secondary" data-action="menu">Zurück</button></div></section>`);
 overlay.querySelector('[data-action="solo"]')?.focus({preventScroll:true});
}
function openCoop({reset=false,notice=''}={}){
 chosenMode='coop';testAuto=false;game.setMode('menu');lobbyNotice=notice;
 if(reset)coopLobby.reset();
 if(!selectionReady){void runLoad({title:'Euer Team wartet.',detail:'Die Charakterauswahl wird vorbereitet.',load:progress=>renderer.loadSelection(progress),ready:()=>{selectionReady=true;drawCoopLobby();}});return;}
 drawCoopLobby();
}
function coopSignature(){return JSON.stringify({slots:coopLobby.slots,pads:connectedPads(gamepads()).map(entry=>entry.index)});}
function drawCoopLobby(){
 const focusAction=document.activeElement?.dataset?.action,pads=gamepads(),missing=coopLobby.missing(pads),missingSlots=new Set(missing.map(slot=>slot.playerIndex));
 const available=connectedPads(pads).filter(entry=>!coopLobby.slots.some(slot=>slot.kind==='gamepad'&&slot.padIndex===entry.index));
 const count=coopLobby.slots.length,ready=coopLobby.canStart&&!missing.length;
 setScreen('coop',`<section class="coop-screen" aria-labelledby="coop-title"><p class="eyebrow">COUCH-KOOP · LEVEL ${requestedLevel+1} / ${LEVELS.length}</p><h1 id="coop-title">Eine Straße. Euer Team.</h1><p class="subline">Jeder steuert seine eigene Figur. Verbindet zwei bis vier Spieler und wählt eure Helden.</p><div class="coop-roster">${Array.from({length:4},(_,index)=>{
  const slot=coopLobby.slots[index];
  if(!slot)return `<article class="coop-slot"><div class="coop-slot-label">SPIELER ${index+1}</div><div class="coop-slot-empty"><strong>+</strong><span>Controller anschließen</span><kbd>A</kbd><span>ZUM BEITRETEN</span></div></article>`;
  return `<article class="coop-slot is-joined ${missingSlots.has(index)?'is-missing':''}"><div class="coop-slot-label">SPIELER ${index+1}<button class="coop-remove" data-action="coop-remove:${index}" aria-label="Spieler ${index+1} entfernen">×</button></div><canvas class="coop-portrait" data-hero="${slot.heroId}" role="img" aria-label="${HEROES[slot.heroId].name}"></canvas><div class="coop-hero-choice"><button class="coop-cycle" data-action="coop-prev:${index}" aria-label="Vorige Figur für Spieler ${index+1}">‹</button><strong>${HEROES[slot.heroId].name.split(' ')[0]}</strong><button class="coop-cycle" data-action="coop-next:${index}" aria-label="Nächste Figur für Spieler ${index+1}">›</button></div><p class="coop-controller">${slot.kind==='keyboard'?'TASTATUR':missingSlots.has(index)?`GAMEPAD ${slot.padIndex+1} FEHLT`:`GAMEPAD ${slot.padIndex+1} VERBUNDEN`}</p></article>`;
 }).join('')}</div><div class="coop-tools"><button class="coop-keyboard" data-action="coop-keyboard" aria-pressed="${coopLobby.keyboard}">${coopLobby.keyboard?'✓ Spieler 1 spielt mit Tastatur':'Spieler 1: Tastatur verwenden'} <span aria-hidden="true">· T</span></button><div class="coop-available">${count<4?available.map(entry=>`<button data-action="coop-add:${entry.index}">Gamepad ${entry.index+1} hinzufügen</button>`).join(''):''}</div></div><p class="coop-notice" role="status">${lobbyNotice|| (missing.length?'Ein zugewiesener Controller fehlt. Bitte wieder verbinden oder den Spieler entfernen.':'')}</p><p class="coop-hint">A beitreten · ← / → Figur wählen · B verlassen · START losspielen. Mit Tastatur: Tab wählt Schaltflächen, Enter bestätigt. Bereits gewählte Figuren tauschen die Plätze.</p><footer class="coop-footer"><span class="coop-ready">${count} / 4 SPIELER ${ready?'· TEAM BEREIT':'· MINDESTENS 2'}</span><div class="actions"><button class="secondary" data-action="coop-back">Zurück</button><button class="primary" data-action="coop-start" ${ready?'':'disabled'}>Gemeinsam starten →</button></div></footer></section>`);
 lobbyFingerprint=coopSignature();
 const previous=focusAction?overlay.querySelector(`[data-action="${focusAction}"]`):null;
 if(previous&&!previous.disabled)previous.focus({preventScroll:true});
 else overlay.querySelector(ready?'[data-action="coop-start"]':'[data-action="coop-keyboard"]')?.focus({preventScroll:true});
}
function lobbyAction(action){
 if(screen!=='coop')return;
 const [kind,value]=action.split(':'),index=Number(value);
 if(kind==='coop-start'){if(coopLobby.canStart&&!coopLobby.missing(gamepads()).length)start(requestedLevel);return;}
 if(kind==='coop-back'){modeScreen(requestedLevel);return;}
 if(kind==='coop-keyboard')coopLobby.setKeyboard(!coopLobby.keyboard);
 else if(kind==='coop-add')coopLobby.join(index,gamepads());
 else if(kind==='coop-remove')coopLobby.remove(index);
 else if(kind==='coop-prev'||kind==='coop-next')coopLobby.cycleHero(index,kind==='coop-prev'?-1:1);
 else return;
 lobbyNotice='';drawCoopLobby();
}
function handleLobbyPads(frames){
 if(lobbyFingerprint!==coopSignature())drawCoopLobby();
 for(const frame of frames){
  const index=coopLobby.slots.findIndex(slot=>slot.kind==='gamepad'&&slot.padIndex===frame.index);
  if(index<0){
   if(frame.edge(0)){coopLobby.join(frame.index,gamepads());lobbyNotice='';drawCoopLobby();}
   else if(frame.edge(1)&&!coopLobby.slots.length){modeScreen(requestedLevel);return;}
   continue;
  }
  if(frame.edge(1)){coopLobby.remove(index);drawCoopLobby();continue;}
  if(frame.moved('left')||frame.moved('right')){coopLobby.cycleHero(index,frame.moved('left')?-1:1);drawCoopLobby();}
  if(frame.edge(9)){lobbyAction('coop-start');return;}
 }
}
function showControllerLost(){
 if(!activeSession?.cooperative)return;
 const missing=coopLobby.missing(gamepads(),activeSession.bindings);
 if(screen!=='controller-lost'){controllerReturn=game.mode==='level-clear'?'level-clear':'playing';if(game.mode==='playing')game.pause();}
 disconnectFingerprint=JSON.stringify(missing.map(slot=>slot.playerIndex));
 setScreen('controller-lost',`<div class="modal-backdrop"><section class="modal"><p class="eyebrow">EUER TEAM WARTET</p><h1>${missing.length?'Controller getrennt.':'Alle wieder da.'}</h1><p class="subline">${missing.length?'Das Spiel ist pausiert. Verbindet den Controller erneut oder drückt A auf einem freien Ersatzcontroller.':'Die Controller sind wieder verbunden. Setzt die Nacht gemeinsam fort.'}</p><ul class="controller-missing-list">${missing.map(slot=>`<li>Spieler ${slot.playerIndex+1} · ${HEROES[slot.heroId].name} · Gamepad ${slot.padIndex+1}</li>`).join('')}</ul><div class="actions"><button class="primary" data-action="controllers-resume" ${missing.length?'disabled':''}>Weiterspielen</button><button class="secondary" data-action="menu">Hauptmenü</button></div></section></div>`);
 if(!missing.length)overlay.querySelector('[data-action="controllers-resume"]')?.focus({preventScroll:true});
}
function reconnectControllers(frames){
 let missing=coopLobby.missing(gamepads(),activeSession.bindings);
 for(const frame of frames){
  if(!missing.length)break;
  if(!frame.edge(0)||activeSession.bindings.some(slot=>slot.kind==='gamepad'&&slot.padIndex===frame.index))continue;
  const target=missing[0].playerIndex;
  const bindings=activeSession.bindings.map((slot,index)=>Object.freeze(index===target?{...slot,padIndex:frame.index}:{...slot}));
  activeSession=Object.freeze({...activeSession,bindings:Object.freeze(bindings)});
  missing=coopLobby.missing(gamepads(),bindings);
  showControllerLost();return true;
 }
 const signature=JSON.stringify(missing.map(slot=>slot.playerIndex));
 if(signature!==disconnectFingerprint)showControllerLost();
 return false;
}
function resumeGame(){
 if(activeSession?.cooperative&&coopLobby.missing(gamepads(),activeSession.bindings).length){showControllerLost();return;}
 if(screen==='controller-lost'&&controllerReturn==='level-clear'){showLevelCelebration();return;}
 game.resume();enterPlaying();
}

function showLevelIntro(index,{confirm,back,bindings=null}){
 const generation=++introGeneration;pendingIntro={generation,index,confirm,back,bindings};
 setScreen('level-intro',levelIntro.html(index));levelIntro.begin(index);
 overlay.querySelector('[data-action="level-start"]')?.focus({preventScroll:true});
}
function showPreparedLevel(snapshot){
 showLevelIntro(snapshot.level,{confirm:()=>beginGame(snapshot),back:()=>modeScreen(snapshot.level),bindings:snapshot.bindings});
}
function confirmLevelIntro(){
 if(screen!=='level-intro'||!pendingIntro||document.hidden||!document.hasFocus())return;
 const request=pendingIntro;if(request.generation!==introGeneration)return;
 pendingIntro=null;request.confirm();
}
function backFromLevelIntro(){
 if(screen!=='level-intro'||!pendingIntro)return;
 const request=pendingIntro;pendingIntro=null;request.back();
}

function beginGame(snapshot){
 if(snapshot.cooperative&&coopLobby.missing(gamepads(),snapshot.bindings).length){
  coopLobby.restore(snapshot.bindings);chosenMode='coop';requestedLevel=snapshot.level;
  openCoop({notice:'Ein Controller fehlt. Verbindet euer Team vor dem Start erneut.'});return;
 }
 pendingTutorial=null;tutorial.stop();activeSession=snapshot;chosenMode=snapshot.cooperative?'coop':'solo';
 hero=snapshot.hero;partner=snapshot.partner;save.hero=hero;save.partner=partner;persist();
 celebration.stop();
 if(snapshot.cooperative)game.startCoop(snapshot.heroIds,snapshot.level);else game.start(hero,partner,snapshot.level);
 renderer.retainWorld(snapshot.level);enterPlaying();
}
function showStartTutorial(snapshot){
 celebration.stop();game.setMode('menu');testAuto=false;pendingTutorial=snapshot;
 setScreen('tutorial',tutorial.html());tutorial.begin(snapshot.hero,{cooperative:snapshot.cooperative,humanCount:snapshot.cooperative?snapshot.heroIds.length:1});
 overlay.querySelector('[data-action="tutorial-start"]')?.focus({preventScroll:true});
}
function startFromTutorial(){
 if(screen!=='tutorial'||!pendingTutorial||document.hidden||!document.hasFocus())return;
 showPreparedLevel(pendingTutorial);
}
function backFromTutorial(){
 if(screen!=='tutorial')return;
 const snapshot=pendingTutorial;
 if(snapshot){hero=snapshot.hero;partner=snapshot.partner;requestedLevel=snapshot.level;}
 if(snapshot?.cooperative){coopLobby.restore(snapshot.bindings);openCoop();}
 else if(selectionReady){selectionStep=1;choose();}else menu();
}
function start(level=0,{showTutorial=true,showIntro=true,session=null,forceSolo=false}={}){
 if(loadingFlow.busy||(showTutorial&&screen==='tutorial'))return;
 const index=Math.max(0,Math.min(LEVELS.length-1,level|0));
 let bindings=session?.bindings,cooperative=session?session.cooperative:chosenMode==='coop'&&!forceSolo;
 if(cooperative&&!session){
  if(!coopLobby.canStart||coopLobby.missing(gamepads()).length){openCoop({notice:'Mindestens zwei Spieler und alle zugewiesenen Controller werden benötigt.'});return;}
  bindings=coopLobby.snapshot(gamepads());
 }
 const heroIds=Object.freeze(session?[...session.heroIds]:cooperative?bindings.map(slot=>slot.heroId):[hero,partner]);
 const snapshot=Object.freeze({hero:heroIds[0],partner:heroIds[1],heroIds,cooperative:!!cooperative,bindings:bindings||null,level:index});
 void unlockAudio();
 return runLoad({title:LEVELS[index].name,detail:'Dein Team und dieses Viertel werden vorbereitet.',load:progress=>loadPlayAssets(index,heroIds,progress),ready:()=>{
  if(showTutorial)showStartTutorial(snapshot);else if(showIntro)showPreparedLevel(snapshot);else beginGame(snapshot);
 }});
}
function pause(){if(screen!=='playing'||game.mode!=='playing')return;game.pause();setScreen('pause',`<div class="modal-backdrop"><section class="modal"><div class="eyebrow">Eine kurze Verschnaufpause</div><h1>Die Straße wartet.</h1><p class="subline">${LEVELS[game.levelIndex].name} · Abschnitt ${game.arena.index+1} / 4</p><div class="actions"><button class="primary" data-action="resume">Weiterspielen</button><button class="secondary" data-action="restart">Level neu starten</button><button class="secondary" data-action="controls">Steuerung</button><button class="secondary" data-action="settings">Einstellungen</button><button class="secondary" data-action="menu">Hauptmenü</button></div></section></div>`)}
let returnScreen='menu';
function controls(){returnScreen=game.mode==='paused'?'pause':'menu';setScreen('controls',`<div class="modal-backdrop"><section class="modal"><div class="eyebrow">Tastatur & Standard-Gamepad</div><h1>Mach die Straße frei.</h1><div class="control-grid"><div>Bewegen <kbd>WASD / ↑↓←→</kbd></div><div>Schlag / Combo <kbd>J · Pad X</kbd></div><div>Schwerer Tritt <kbd>K · Pad Y</kbd></div><div>Springen <kbd>LEER · Pad A</kbd></div><div>Ausweichen <kbd>SHIFT · Pad B</kbd></div><div>Spezial (45 Energie) <kbd>L · Pad RB</kbd></div><div>Aufheben / Werfen <kbd>E · Pad LB</kbd></div><div>Pause / Vollbild <kbd>ESC / F</kbd></div></div><p class="subline">J für eine dreiteilige Combo mehrfach drücken oder halten. In der Luft J oder K für einen gezielten Sprungtritt. E hebt Fahrräder oder Baseballschläger auf; mit E wirfst du sie. Mit einem Schläger schlägst du per J zu. Gegner müssen auf derselben Höhe und vor dir stehen. Rote Markierungen kündigen Angriffe an: ausweichen oder aus der Linie gehen.</p><p class="small">${game.cooperative?'Im lokalen Koop steuert jeder seine eigene Figur. Neben einem gefallenen Mitspieler E oder LB halten, um ihn aufzuhelfen. Fällt das ganze Team, endet der Versuch.':'Dein Sidekick kämpft automatisch. Bei ihm E halten hilft schneller; sonst steht er nach 12 Sekunden auf. Er kann dich zweimal pro Level retten. Sind beide am Boden, endet der Versuch.'} Essen und Energiedrinks werden beim Darüberlaufen eingesammelt.</p><div class="actions"><button class="primary" data-action="close-sub">Verstanden</button></div></section></div>`)}
function options(){returnScreen=game.mode==='paused'?'pause':'menu';setScreen('settings',`<div class="modal-backdrop"><section class="modal"><div class="eyebrow">Deine Nacht, dein Sound</div><h1>Einstellungen</h1><label class="setting">Lautstärke<input id="volume" aria-label="Lautstärke" type="range" min="0" max="100" value="${Math.round(settings.volume*100)}"></label>${[["musicVolume","Musik"],["effectsVolume","Treffer & Effekte"],["voiceVolume","Kampflaute"]].map(([id,label])=>`<label class="setting">${label}<input id="${id}" aria-label="${label}" type="range" min="0" max="100" value="${Math.round(settings[id]*100)}"></label>`).join('')}<label class="setting">Musik an<input id="music" type="checkbox" ${settings.music?'checked':''}></label><label class="setting">Kamerawackeln bei Treffern<input id="shake" type="checkbox" ${settings.shake?'checked':''}></label><p class="small">Lokaler Koop: bis zu vier Spieler mit eigenen Gamepads; Spieler 1 kann stattdessen die Tastatur verwenden. Auflösung folgt Fenster und Bildschirm bis 3840 × 2160. F schaltet Vollbild. Bei Fokusverlust pausiert das Spiel automatisch. Einstellungen und freigespielte Level werden auf diesem Gerät gespeichert.</p><div class="actions"><button class="primary" data-action="close-sub">Fertig</button><button class="secondary" data-action="fullscreen">Vollbild</button></div></section></div>`);document.querySelector('#volume').oninput=e=>{settings.volume=Number(e.target.value)/100;audio.setVolume(settings.volume);persist()};for(const id of ['musicVolume','effectsVolume','voiceVolume'])document.querySelector('#'+id).oninput=e=>{settings[id]=Number(e.target.value)/100;audio.setMix({music:settings.musicVolume,effects:settings.effectsVolume,voice:settings.voiceVolume});persist()};for(const id of ['music','shake'])document.querySelector('#'+id).onchange=e=>{settings[id]=e.target.checked;audio.setMusic(settings.music);persist()}}
function result(){const win=game.mode==='victory';save.high=Math.max(save.high,game.score);persist();testAuto=false;setScreen(win?'victory':'defeat',`<div class="modal-backdrop"><section class="modal"><div class="eyebrow">${win?`${LEVELS.length} Viertel. Gemeinsam geschafft.`:'Die Nacht ist noch nicht vorbei.'}</div><h1>${win?'Freiburg atmet auf.':'Einmal tief durchatmen.'}</h1><p class="subline">${win?`${(game.heroes||[game.player,game.partner]).map(player=>HEROES[player.heroId].name).join(' & ')} haben alle ${LEVELS.length} Viertel befreit.`:'Dein Team ist am Boden. Starte dieses Level mit voller Kraft erneut.'}</p><div class="result-stats"><div><strong>${game.score.toLocaleString('de-DE')}</strong><span>PUNKTE</span></div><div><strong>${Math.floor(game.time/60)}:${String(Math.floor(game.time%60)).padStart(2,'0')}</strong><span>ZEIT</span></div><div><strong>${game.stats.kills||0}</strong><span>GEGNER</span></div></div><div class="actions"><button class="primary" data-action="${win?'new':'restart'}">${win?'Neue Nacht':'Level erneut versuchen'}</button><button class="secondary" data-action="menu">Hauptmenü</button></div></section></div>`)}
function fullscreen(){if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.querySelector('#stage').requestFullscreen().catch(()=>{})}
function showLevelCelebration(){
 if(screen==='level-clear')return;
 const stats=levelResultStats(game,levelBaseline);
 setScreen('level-clear',celebration.html(game,stats));
 celebration.begin(renderer,game,stats);
 document.querySelector('#status').textContent=`Congratulations. You beat the level. ${game.level.name} befreit.`;
}
function continueCelebration(){
 if(loadingFlow.busy||screen!=='level-clear'||!celebration.ready||game.mode!=='level-clear'||document.hidden||!document.hasFocus())return;
 if(activeSession?.cooperative&&coopLobby.missing(gamepads(),activeSession.bindings).length){controllerReturn='level-clear';showControllerLost();return;}
 const clearedLevel=game.levelIndex,nextLevel=clearedLevel+1,team=(game.heroes||[game.player,game.partner]).map(player=>player.heroId);
 const advance=()=>{
  if(activeSession?.cooperative&&coopLobby.missing(gamepads(),activeSession.bindings).length){showControllerLost();return;}
  if(game.mode!=='level-clear'||game.levelIndex!==clearedLevel||!game.continueLevel())return;
  celebration.stop();acc=0;last=performance.now();
  if(game.mode==='victory')result();else{renderer.retainWorld(nextLevel);enterPlaying();}
 };
 if(nextLevel>=LEVELS.length){advance();return;}
 return runLoad({title:LEVELS[nextLevel].name,detail:'Das nächste Viertel wird vorbereitet.',load:progress=>loadPlayAssets(nextLevel,team,progress),ready:()=>showLevelIntro(nextLevel,{confirm:advance,back:()=>showLevelCelebration(),bindings:activeSession?.bindings})});
}
function act(action){
 if(loadingFlow.busy&&action!=='menu')return;
 if(action.startsWith('coop-')){lobbyAction(action);return;}
 switch(action){
  case'tutorial-start':startFromTutorial();break;
  case'tutorial-back':backFromTutorial();break;
  case'level-start':confirmLevelIntro();break;
  case'level-back':backFromLevelIntro();break;
  case'controllers-resume':if(screen==='controller-lost')resumeGame();break;
  case'retry-load':if(pendingLoad)void runLoad(pendingLoad);break;
  case'next-level':continueCelebration();break;
  case'menu-music':toggleMenuMusic();break;
  case'choose':case'new':selectionStep=0;modeScreen(0);break;
  case'solo':chosenMode='solo';selectionStep=0;choose();break;
  case'coop':openCoop({reset:true});break;
  case'partner':selectionStep=1;choose();break;
  case'back':if(selectionStep){selectionStep=0;choose();}else modeScreen(requestedLevel);break;
  case'start':testAuto=false;start(requestedLevel);break;
  case'continue':modeScreen(save.level);break;
  case'restart':testAuto=false;start(game.levelIndex,{showTutorial:false,session:activeSession});break;
  case'resume':resumeGame();break;
  case'menu':menu();break;
  case'controls':controls();break;
  case'settings':options();break;
  case'close-sub':if(returnScreen==='pause'){game.resume();setScreen('playing','');pause();}else menu();break;
  case'fullscreen':fullscreen();break;
 }
}
const handled=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyJ','KeyK','KeyL','KeyE','Space','ShiftLeft','ShiftRight'];
addEventListener('keydown',e=>{heldKeys.add(e.code);inputSeen[e.code]=(inputSeen[e.code]||0)+1;
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
 if(screen==='coop'){
  if(e.code==='Escape'){e.preventDefault();if(!e.repeat)modeScreen(requestedLevel);return;}
  if(e.code==='KeyT'){e.preventDefault();if(!e.repeat)lobbyAction('coop-keyboard');return;}
  if(e.code==='Enter'&&!document.activeElement?.matches('button:not(:disabled)')){e.preventDefault();if(!e.repeat)lobbyAction('coop-start');return;}
  if(!(isDev&&['F1','F2','F3','F4','F5','F6','F11'].includes(e.code))){
   if(e.code==='KeyF'&&!e.repeat)fullscreen();
   if((handled.includes(e.code)&&e.code!=='Space')||/^F\d+$/.test(e.code))e.preventDefault();
   return;
  }
 }
 if(screen==='mode'&&!e.repeat){
  if(e.code==='Escape'){e.preventDefault();menu();return;}
  if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight'].includes(e.code)){
   e.preventDefault();const buttons=[...overlay.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement),direction=['ArrowUp','ArrowLeft'].includes(e.code)?-1:1;
   buttons[(index+direction+buttons.length)%buttons.length]?.focus();return;
  }
 }
 if(screen==='controller-lost'&&e.code==='Escape'){e.preventDefault();return;}
 if(screen==='tutorial'||screen==='level-intro'){
  if(e.code==='Escape'){e.preventDefault();if(!e.repeat){if(screen==='tutorial')backFromTutorial();else backFromLevelIntro();}return;}
  if(e.code==='Enter'){
   e.preventDefault();if(e.repeat)return;
   const focused=document.activeElement;
   if(focused?.matches('button:not(:disabled)')&&overlay.contains(focused))focused.click();else if(screen==='tutorial')startFromTutorial();else confirmLevelIntro();
   return;
  }
  if(e.code==='Space'){
   if(e.repeat||!document.activeElement?.matches('button:not(:disabled)')||!overlay.contains(document.activeElement))e.preventDefault();
   return;
  }
  if(!(isDev&&['F1','F2','F3','F4','F5','F6','F11'].includes(e.code))){
   if(handled.includes(e.code)||/^F\d+$/.test(e.code))e.preventDefault();
   if(e.code==='KeyF'&&!e.repeat)fullscreen();
   return;
  }
 }
 if(screen==='level-clear'){
  if(e.code==='Enter'){e.preventDefault();if(!e.repeat)continueCelebration();return;}
  if(e.code==='Space'||e.code==='Escape'||handled.includes(e.code)||['F1','F2','F3','F4','F5','F6','F7'].includes(e.code)){e.preventDefault();return;}
 }
 if(screen==='menu'&&!e.repeat){const buttons=[...overlay.querySelectorAll('.cinematic-button')];if(['ArrowDown','ArrowUp','KeyS','KeyW'].includes(e.code)){e.preventDefault();let i=buttons.indexOf(document.activeElement);if(i<0)i=Math.max(0,buttons.findIndex(b=>b.classList.contains('is-selected')));const direction=['ArrowUp','KeyW'].includes(e.code)?-1:1;buttons[(i+direction+buttons.length)%buttons.length]?.focus();return;}if(e.code==='Enter'&&!buttons.includes(document.activeElement)&&document.activeElement?.id!=='menu-sound'){e.preventDefault();act('choose');return;}}if(isDev&&['F1','F2','F3','F4','F5','F6','F11'].includes(e.code)){e.preventDefault();testAuto=false;start(e.code==='F11'?6:Number(e.code.slice(1))-1,{showTutorial:false,showIntro:false,forceSolo:true});return}if(isDev&&e.code==='F7'){e.preventDefault();if(screen==='playing'){for(const player of game.heroes||[game.player,game.partner])player.hp=0;}return}if(isDev&&e.code==='F10'){e.preventDefault();exportFrame();return}if(e.code==='Escape'&&!e.repeat){e.preventDefault();if(screen==='playing')pause();else if(screen==='pause')act('resume');else if(screen==='settings'||screen==='controls')act('close-sub');return}if(e.code==='KeyF'&&!e.repeat){fullscreen();return}if(isDev&&e.code==='F8'&&!e.repeat){e.preventDefault();if(!game.cooperative)testAuto=!testAuto;return}if(isDev&&e.code==='F9'&&!e.repeat){e.preventDefault();testRate=testRate===1?12:1;return}if(handled.includes(e.code)&&screen==='playing'){e.preventDefault();if(blockedKeys.has(e.code))return;keys.add(e.code);pressedUntil[e.code]=performance.now()+100}});addEventListener('keyup',e=>{keys.delete(e.code);heldKeys.delete(e.code);blockedKeys.delete(e.code);});addEventListener('blur',()=>{keys.clear();heldKeys.clear();blockedKeys.clear();pause();syncAudio()});addEventListener('focus',syncAudio);document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();heldKeys.clear();blockedKeys.clear();pause()}syncAudio()});document.querySelector('#pause').onclick=pause;document.querySelector('#fullscreen').onclick=fullscreen;
function input(){
 const has=(...codes)=>codes.some(code=>keys.has(code)||performance.now()<(pressedUntil[code]||0));
 const keyboard={x:Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft')),y:Number(has('KeyS','ArrowDown'))-Number(has('KeyW','ArrowUp')),attack:has('KeyJ'),heavy:has('KeyK'),jump:has('Space'),special:has('KeyL'),dodge:has('ShiftLeft','ShiftRight'),revive:has('KeyE'),interact:has('KeyE')};
 const frames=padInput.poll(gamepads()),beforeScreen=screen;
 if(screen==='coop'){handleLobbyPads(frames);return{};}
 if(screen==='playing'&&activeSession?.cooperative&&coopLobby.missing(gamepads(),activeSession.bindings).length){showControllerLost();return[];}
 if(screen==='controller-lost'&&reconnectControllers(frames))return[];
 const assigned=activeSession?.cooperative?activeSession.bindings:pendingTutorial?.cooperative?pendingTutorial.bindings:pendingIntro?.bindings||null;
 const uiFrames=assigned?frames.filter(frame=>assigned.some(slot=>slot.kind==='gamepad'&&slot.padIndex===frame.index)):frames;
 const pad=(screen==='playing'?uiFrames[0]:uiFrames.find(frame=>frame.edge(0)||['left','right','up','down'].some(key=>frame.moved(key))))||uiFrames[0];
 if(screen==='playing'){
  if(uiFrames.some(frame=>frame.edge(9))){pause();return activeSession?.cooperative?[]:{};}
  if(activeSession?.cooperative)return activeSession.bindings.map(slot=>slot.kind==='keyboard'?{...keyboard}:padInput.command(slot.padIndex));
  if(!pad)return keyboard;
  const cmd=padInput.command(pad.index);for(const action of ['attack','heavy','jump','special','dodge','revive','interact'])keyboard[action] ||= cmd[action];
  keyboard.x=cmd.x||keyboard.x;keyboard.y=cmd.y||keyboard.y;return keyboard;
 }
 if(screen==='pause'&&uiFrames.some(frame=>frame.edge(9))){resumeGame();return{};}
 if(pad){
  const buttons=[...overlay.querySelectorAll('button:not(:disabled)')];let index=buttons.indexOf(document.activeElement);
  if(pad.moved('right')||pad.moved('down'))buttons[(index+1)%buttons.length]?.focus();
  if(pad.moved('left')||pad.moved('up'))buttons[(index-1+buttons.length)%buttons.length]?.focus();
  if(pad.edge(0)){if(index<0)buttons[0]?.focus();else buttons[index]?.click();}
 }
 // A menu-confirmation frame must not also move/jump in the newly started game.
 return beforeScreen!=='playing'&&screen==='playing'&&activeSession?.cooperative?activeSession.bindings.map(()=>({})):{};
}
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
 }else if(screen==='level-intro')levelIntro.render(dt,{visible});
 else if(screen==='tutorial')tutorial.render(dt,{visible});
 else if(menuReady&&!menuScene.canvas.hidden)menuScene.render(dt);
 else if(screen==='loading'||!game.player){const c=canvas.getContext('2d');c.setTransform(1,0,0,1,0,0);c.fillStyle='#070a10';c.fillRect(0,0,canvas.width,canvas.height);}
 else renderer.render(game,dt);
 game.shake=shake;syncAudio();frames++;if(now-fpsAt>700){fps=Math.round(frames*1000/(now-fpsAt));frames=0;fpsAt=now;if(isDev){dev.hidden=!['playing','level-clear'].includes(screen);dev.textContent=JSON.stringify({fps,mode:game.mode,celebration:{active:celebration.active,time:Number(celebration.time.toFixed(2)),ready:celebration.ready},hero:game.player?.heroId,partner:game.partner?.heroId,cooperative:!!game.cooperative,humanCount:game.humanCount||1,heroes:(game.heroes||[]).map(player=>({hero:player.heroId,hp:Math.round(player.hp),x:Math.round(player.x)})),level:game.levelIndex,arena:game.arena?.index,wave:game.wave,x:Math.round(game.player?.x||0),camera:Math.round(game.camera),hp:Math.round(game.player?.hp||0),partnerHp:Math.round(game.partner?.hp||0),held:game.player?.heldItem?.type||null,props:game.props?.map(p=>({type:p.type,state:p.state,x:Math.round(p.x),y:Math.round(p.y)})),attackKind:game.player?.attackKind,enemies:game.enemies?.filter(e=>e.hp>0).length,score:game.score,combo:game.combo,stats:game.stats,time:Math.round(game.time),buffer:[canvas.width,canvas.height],z:Math.round(game.player?.z||0),walk:{state:game.player?.state,active:game.player?.walking,distance:Math.round(game.player?.walkDistance||0),frame:renderer.walkFrame(game.player||{},hero),partnerDistance:Math.round(game.partner?.walkDistance||0)},combat:{...combatFrame(game.player),ready:!!renderer.assets['combat-'+hero],frames:renderer.combatMetadata[hero]?.frames?.length||0},inputSeen,auto:testAuto,rate:testRate,sound:{context:audio.ctx?.state,menu:audio.menu,celebrating:audio.celebrating,level:audio.level,voices:audio.voiceBuffers.size,errors:audio.errors,tracks:[...audio.tracks.values()].map(t=>({level:t.index,playing:t.playing,paused:t.media.paused,ready:t.media.readyState,loop:t.media.loop,time:Math.round(t.media.currentTime*10)/10}))},events:testLog.slice(-4)})}}}
applyAudioSettings();
void document.fonts?.load('16px "Freiburg Display"').catch(()=>{});
requestAnimationFrame(tick);
void runLoad({title:'Freiburg wird wach.',detail:'Die Nacht wird vorbereitet.',load:progress=>menuScene.load(progress),ready:()=>{menuReady=true;menu();if(settings.music)void unlockAudio();}});
