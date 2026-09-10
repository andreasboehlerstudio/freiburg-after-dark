// Six original recordings, short stock-voice exertions and layered native combat Foley.
const clamp=(value,fallback=0)=>Number.isFinite(Number(value))?Math.max(0,Math.min(1,Number(value))):fallback;
export const MUSIC_TRACKS=Object.freeze([
 {id:'kajo',title:'KAJO / NACHTSCHICHT'},
 {id:'stuehlinger',title:'HINTER DEN GLEISEN'},
 {id:'park',title:'KIRCHPLATZ / SCHATTEN'},
 {id:'haslach',title:'HAWEI / BETON'},
 {id:'wiehre',title:'WIEHRE / LETZTE VORSTELLUNG'},
 {id:'bermuda',title:'BERMUDA / TÜRSTEHER'},
].map(track=>Object.freeze({...track,url:new URL('../assets/audio/music/'+track.id+'.mp3',import.meta.url).href})));
// The title screen owns a separate playhead even though it reuses this recording.
export const MENU_TRACK=Object.freeze({id:'menu',title:'AFTER DARK / NACHTSTIMMUNG',url:MUSIC_TRACKS[5].url});
export const VOICE_BANKS=Object.freeze(Object.fromEntries(['agile','force','grit','deep'].map(bank=>[
 bank,Object.freeze(Array.from({length:6},(_,i)=>new URL('../assets/audio/voice/'+bank+'-'+(i+1)+'.wav',import.meta.url).href)),
])));
const HERO_VOICE={nico:'agile',stefan:'force',torsten:'grit',andreas:'deep'};
const levelIndex=value=>Math.max(0,Math.min(MUSIC_TRACKS.length-1,Math.floor(Number(value)||0)));
const safeStop=(node,when)=>{try{node.stop(when);}catch{}};
const disconnect=node=>{try{node.disconnect();}catch{}};

export class AudioEngine {
 constructor({AudioContext,Audio,fetch:fetcher,random=Math.random}={}){
  this.ContextClass=AudioContext||globalThis.AudioContext||globalThis.webkitAudioContext;
  this.AudioClass=Audio||globalThis.Audio;
  this.fetcher=fetcher||globalThis.fetch?.bind(globalThis);this.random=random;
  this.ctx=null;this.volume=.6;this.musicVolume=.5;this.mix={music:.5,effects:.8,voice:.7};
  this.music=true;this.level=0;this.active=false;this.playing=false;this.audible=false;this.menu=false;this.celebrating=false;this.visible=true;this.musicTarget=null;this.camera=0;
  this.tracks=new Map();this.voiceBuffers=new Map();this.encodedVoices=new Map();
  this.voiceTimes=new Map();this.lastVoice=new Map();this.voices=new Set();this.sources=new Set();this.celebrationSources=new Set();this.celebrationPlayed=false;
  this.lastGlobalVoice=-Infinity;this.errors=[];this._epoch=0;this.destroyed=false;
 }
 _context(){
  if(this.ctx||!this.ContextClass||this.destroyed)return this.ctx;
  const c=this.ctx=new this.ContextClass();
  this.master=c.createGain();this.master.gain.value=this.volume;
  this.limiter=c.createDynamicsCompressor();
  this.limiter.threshold.value=-5;this.limiter.knee.value=6;this.limiter.ratio.value=16;
  this.limiter.attack.value=.002;this.limiter.release.value=.13;
  this.master.connect(this.limiter);this.limiter.connect(c.destination);
  for(const [name,key] of [['musicBus','music'],['fxBus','effects'],['voiceBus','voice']]){
   this[name]=c.createGain();this[name].gain.value=key==='music'||this.audible?this.mix[key]:0;this[name].connect(this.master);
  }
  this.noises=Array.from({length:3},()=>{
   const buffer=c.createBuffer(1,c.sampleRate,c.sampleRate),samples=buffer.getChannelData(0);let previous=0;
   for(let i=0;i<samples.length;i++){previous=(previous+(this.random()*2-1)*.5)*.62;samples[i]=previous;}
   return buffer;
  });
  this.noise=this.noises[0];return c;
 }
 async unlock(){
  if(this.destroyed)return false;
  const c=this._context(),epoch=this._epoch;if(!c)return false;
  try{await c.resume();this.active=c.state==='running';}catch{this.active=false;}
  if(this.destroyed||epoch!==this._epoch)return false;
  // A new trusted gesture can unblock playback while the context clock was stopped.
  if(this.active)for(const track of this.tracks.values())track.retryAt=0;
  // Download/decode is deliberately detached from the user's Start action.
  void this.load();this._syncMusic();this._syncCelebration();return this.active;
 }
 async load(){
  if(this.destroyed)return false;
  if(!this._loading){
   const epoch=this._epoch;
   this._loading=Promise.allSettled(Object.values(VOICE_BANKS).flat().map(async url=>{
    if(!this.fetcher)return;
    const response=await this.fetcher(url);
    if(!response.ok)throw Error('Voice asset unavailable: '+url.split('/').pop());
    const bytes=await response.arrayBuffer();
    if(epoch===this._epoch&&!this.destroyed)this.encodedVoices.set(url,bytes);
   })).then(results=>{for(const result of results)if(result.status==='rejected')this.errors.push(String(result.reason));});
  }
  await this._loading;
  if(this.ctx&&!this.destroyed&&!this._decoding){
   const c=this.ctx,epoch=this._epoch;
   this._decoding=Promise.allSettled([...this.encodedVoices].map(async([url,bytes])=>{
    if(this.voiceBuffers.has(url))return;
    const buffer=await c.decodeAudioData(bytes.slice(0));
    if(epoch===this._epoch&&!this.destroyed)this.voiceBuffers.set(url,buffer);
   })).then(()=>{this.encodedVoices.clear();});
  }
  if(this._decoding)await this._decoding;return !this.destroyed;
 }
 _gain(parameter,value,seconds=.035){
  if(!this.ctx)return;const now=this.ctx.currentTime;
  parameter.cancelScheduledValues(now);parameter.setTargetAtTime(value,now,seconds);
 }
 setVolume(value){this.volume=clamp(value);if(this.master)this._gain(this.master.gain,this.volume);}
 setMix(values={}){
  for(const key of ['music','effects','voice'])if(Object.hasOwn(values,key))this.mix[key]=clamp(values[key]);
  this.musicVolume=this.mix.music;
  for(const [name,key] of [['musicBus','music'],['fxBus','effects'],['voiceBus','voice']])if(this[name])this._gain(this[name].gain,key==='music'||this.audible?this.mix[key]:0);
 }
 setMusic(value){if(typeof value==='boolean'){this.music=value;if(!value)this._stopCelebration();this._syncMusic();}else this.setMix({music:value});}
 setLevel(value){const next=levelIndex(value);if(next!==this.level){this.level=next;this._syncMusic();}}
 _track(index){
  if(this.tracks.has(index))return this.tracks.get(index);
  if(!this.AudioClass||!this.ctx)return null;
  try{
   const definition=index==='menu'?MENU_TRACK:MUSIC_TRACKS[index];
   const media=new this.AudioClass(definition.url);
   media.preload='auto';media.loop=true;
   const source=this.ctx.createMediaElementSource(media),gain=this.ctx.createGain();
   gain.gain.value=0;source.connect(gain);gain.connect(this.musicBus);
   const track={index,id:definition.id,media,source,gain,playing:false,pending:false,request:0,failed:false,retryAt:0,from:0,to:0,fadeAt:0,fadeDuration:0,retireAt:Infinity};
   media.addEventListener?.('error',()=>{if(this.destroyed)return;track.failed=true;track.request++;track.pending=false;track.playing=false;this.errors.push('Music unavailable: '+track.id);});
   this.tracks.set(index,track);return track;
  }catch(error){this.errors.push(String(error));return null;}
 }
 _value(track,time){
  if(!track.fadeDuration)return track.to;
  const amount=clamp((time-track.fadeAt)/track.fadeDuration);
  return track.from+(track.to-track.from)*amount;
 }
 _fade(track,target,duration){
  const now=this.ctx.currentTime,from=this._value(track,now);
  track.gain.gain.cancelScheduledValues(now);track.gain.gain.setValueAtTime(from,now);
  track.gain.gain.linearRampToValueAtTime(target,now+duration);
  track.from=from;track.to=target;track.fadeAt=now;track.fadeDuration=duration;
 }
 _pauseTrack(track){
  if(track.pending){track.request++;track.pending=false;}
  if(track.playing||!track.media.paused)track.media.pause();
  track.playing=false;track.retireAt=Infinity;
  if(track.to!==0)this._fade(track,0,.025);
 }
 _pauseMusic(){for(const track of this.tracks.values())this._pauseTrack(track);}
 _target(){return this.visible?(this.menu?'menu':this.playing||this.celebrating?this.level:null):null;}
 _activateTrack(track){
  const others=[...this.tracks.values()].filter(other=>other!==track&&other.playing);
  const fade=others.length?1.1:.18;this._fade(track,1,fade);track.retireAt=Infinity;
  // This also handles reversing a crossfade before its outgoing stream retired.
  for(const other of others){this._fade(other,0,fade);other.retireAt=this.ctx.currentTime+fade;}
 }
 _syncMusic(){
  this.musicTarget=this._target();
  if(!this.ctx||this.destroyed)return;
  if(!this.music||this.musicTarget===null||this.ctx.state!=='running'){this._pauseMusic();return;}
  for(const other of this.tracks.values())if(other.index!==this.musicTarget&&other.pending)this._pauseTrack(other);
  const track=this._track(this.musicTarget);if(!track||track.failed||track.pending)return;
  const now=this.ctx.currentTime;
  if(track.playing){if(track.to!==1||[...this.tracks.values()].some(other=>other!==track&&other.playing&&other.to!==0))this._activateTrack(track);return;}
  if(now<track.retryAt)return;
  track.pending=true;
  const epoch=this._epoch,request=++track.request;
  const current=()=>epoch===this._epoch&&!this.destroyed&&request===track.request;
  const wanted=()=>current()&&this.ctx?.state==='running'&&this.music&&track.index===this.musicTarget;
  Promise.resolve().then(()=>{
   if(!wanted())return false;
   return Promise.resolve(track.media.play()).then(()=>true);
  }).then(started=>{
   if(!current())return;
   track.pending=false;
   if(!started||!wanted()){this._pauseTrack(track);return;}
   track.playing=true;track.retireAt=Infinity;
   // Keep the old track audible until the new stream really starts.
   this._activateTrack(track);
  }).catch(error=>{
   if(!current())return;
   track.pending=false;track.retryAt=(this.ctx?.currentTime||0)+(error?.name==='AbortError'?0:1);
   if(!['NotAllowedError','AbortError'].includes(error?.name)){track.failed=true;this.errors.push('Music playback failed: '+track.id);}
  });
 }
 _source(node,nodes=[]){
  this.sources.add(node);
  node.onended=()=>{this.sources.delete(node);this.celebrationSources.delete(node);disconnect(node);for(const extra of nodes)disconnect(extra);};
 }
 _stopCelebration(){
  for(const source of this.celebrationSources)safeStop(source,(this.ctx?.currentTime||0)+.025);
  this.celebrationSources.clear();
 }
 _syncCelebration(){
  if(!this.ctx||this.destroyed)return;
  if(!this.celebrating||!this.visible||this.menu){this._stopCelebration();return;}
  if(!this.music||!this.mix.music||!this.volume){this.celebrationPlayed=true;this._stopCelebration();return;}
  if(this.celebrationPlayed||this.ctx.state!=='running')return;
  this.celebrationPlayed=true;
  const t=this.ctx.currentTime,before=new Set(this.sources);
  // Original short applause and a rising wordless crowd texture. This music-bus
  // stinger never enables combat FX and never replays after blur or a menu update.
  for(let i=0;i<12;i++){
   const when=t+.04+i*.075+(this.random()-.5)*.02,level=.038+this.random()*.035;
   this.hiss(when,.052,level,1600+this.random()*1100,this.musicBus,{type:'highpass',end:900});
   this.hiss(when+.013,.075,level*.7,650+this.random()*450,this.musicBus,{q:.6,end:410});
  }
  this.hiss(t+.06,.78,.035,570,this.musicBus,{q:2,end:1050});
  [392,494,587].forEach((frequency,i)=>this.tone(frequency,t+.18+i*.12,.48,.014,'triangle',this.musicBus,frequency*1.08));
  for(const source of this.sources)if(!before.has(source))this.celebrationSources.add(source);
 }
 tone(frequency,when,duration,volume=.1,type='sine',destination=this.fxBus,endFrequency){
  if(!this.ctx||!destination)return;
  const c=this.ctx,o=c.createOscillator(),gain=c.createGain();
  o.type=type;o.frequency.setValueAtTime(Math.max(20,frequency),when);
  if(endFrequency)o.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),when+duration);
  gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),when+.004);
  gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
  o.connect(gain);gain.connect(destination);this._source(o,[gain]);o.start(when);o.stop(when+duration+.015);
 }
 hiss(when,duration,volume=.12,frequency=1300,destination=this.fxBus,{type='bandpass',end=frequency,q=.7}={}){
  if(!this.ctx||!destination)return;
  const c=this.ctx,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();
  source.buffer=this.noises[Math.floor(this.random()*this.noises.length)];filter.type=type;filter.Q.value=q;
  filter.frequency.setValueAtTime(frequency,when);filter.frequency.exponentialRampToValueAtTime(Math.max(70,end),when+duration);
  gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),when+.004);
  gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
  source.connect(filter);filter.connect(gain);gain.connect(destination);this._source(source,[filter,gain]);
  source.start(when,this.random()*.5);source.stop(when+duration+.01);
 }
 _impact(heavy=false,material='body'){
  const t=this.ctx.currentTime,r=.9+this.random()*.2;
  if(material==='car'||material==='crash'){
   const crash=material==='crash';
   this.tone((crash?57:76)*r,t,crash?.42:.25,crash?.6:.43,'sine',this.fxBus,25);
   [215,485].forEach((frequency,i)=>this.tone(frequency*r,t+i*.008,crash?.32:.19,.13/(i+1),'triangle',this.fxBus,frequency*.56));
   this.hiss(t,.045,.27,1800,this.fxBus,{type:'highpass',end:760});
   this.hiss(t+.025,crash?.4:.13,crash?.24:.12,780,this.fxBus,{q:1.5,end:210});
   if(crash){
    this.hiss(t+.03,.24,.18,3900,this.fxBus,{type:'highpass',end:1700});
    [1250,2190,870,1670].forEach((frequency,i)=>this.tone(frequency*r,t+.035+i*.047,.065+i*.019,.06/(1+i*.25),'triangle',this.fxBus,frequency*.72));
   }
   return;
  }
  if(material==='bicycle'||material==='metal'){
   this.tone(92*r,t,.17,.3,'sine',this.fxBus,37);
   [690,1190,2030].forEach((f,i)=>this.tone(f*r,t+i*.008,.24+i*.04,.075/(1+i*.45),'triangle',this.fxBus,f*.86));
   this.hiss(t,.085,.2,2100,this.fxBus,{q:1.4,end:740});
   this.hiss(t+.05,.13,.11,980,this.fxBus,{q:2,end:550});return;
  }
  if(material==='bat'||material==='wood'){
   this.tone(260*r,t,.105,.3,'triangle',this.fxBus,95);
   this.tone(105*r,t,.14,.28,'sine',this.fxBus,46);
   this.hiss(t,.055,.32,1750,this.fxBus,{q:.9,end:620});
   this.hiss(t+.019,.06,.13,3400,this.fxBus,{q:1.2,end:1200});return;
  }
  // Original exaggerated film Foley: belly thump, broad palm slap, dry crack
  // and a short boxy resonance. No recording from a film is sampled.
  this.tone((heavy?98:142)*r,t,heavy?.26:.17,heavy?.52:.39,'sine',this.fxBus,heavy?30:44);
  this.hiss(t,.033,heavy?.33:.27,1850*r,this.fxBus,{type:'highpass',end:850});
  this.hiss(t+.009,heavy?.08:.058,heavy?.25:.2,(heavy?860:1120)*r,this.fxBus,{q:.7,end:390});
  this.tone((heavy?360:460)*r,t+.002,.032,heavy?.2:.16,'triangle',this.fxBus,130);
  this.tone((heavy?190:235)*r,t+.014,heavy?.14:.105,.075,'triangle',this.fxBus,85);
  this.hiss(t+.027,.034,heavy?.14:.1,2450*r,this.fxBus,{type:'highpass',end:1350});
 }
 _voice(event,kind='exertion',chance=.6){
  if(!this.mix.voice||this.random()>chance||this.voices.size>=3)return;
  const t=this.ctx.currentTime;
  const identity=kind==='hurt'?(event.targetHero||(typeof event.hero==='string'?event.hero:null)):(event.attackerHero||(typeof event.hero==='string'?event.hero:null));
  const foe=kind==='hurt'?!identity&&!event.hero: event.type==='enemy-swing';
  const bank=HERO_VOICE[identity]||(foe?(this.random()<.5?'grit':'force'):'grit');
  const uid=(kind==='hurt'?event.targetUid:event.attackerUid)||event.uid||identity||(foe?'foes':'hero');
  const cooldown=kind==='hurt'?.52:.64;
  if(t-(this.voiceTimes.get(uid)??-Infinity)<cooldown||t-this.lastGlobalVoice<.105)return;
  const available=VOICE_BANKS[bank].filter(url=>this.voiceBuffers.has(url));
  if(!available.length)return;
  let index=Math.floor(this.random()*available.length);
  if(available.length>1&&index===this.lastVoice.get(bank))index=(index+1)%available.length;
  const url=available[index],buffer=this.voiceBuffers.get(url),source=this.ctx.createBufferSource(),gain=this.ctx.createGain();
  source.buffer=buffer;source.playbackRate.value=(foe?.88:1)*(.97+this.random()*.06);
  gain.gain.value=kind==='hurt'?.54:.46;
  source.connect(gain);
  let pan=null;
  if(this.ctx.createStereoPanner&&Number.isFinite(event.x)){pan=this.ctx.createStereoPanner();pan.pan.value=Math.max(-.65,Math.min(.65,((event.x-this.camera)/1280-.5)*1.3));gain.connect(pan);pan.connect(this.voiceBus);}else gain.connect(this.voiceBus);
  this.voices.add(source);this.sources.add(source);
  source.onended=()=>{this.voices.delete(source);this.sources.delete(source);disconnect(source);disconnect(gain);if(pan)disconnect(pan);};
  this.voiceTimes.set(uid,t);this.lastGlobalVoice=t;this.lastVoice.set(bank,index);
  if(this.voiceTimes.size>200)for(const[key,time]of this.voiceTimes)if(t-time>3)this.voiceTimes.delete(key);
  source.start(t);source.stop(t+buffer.duration/source.playbackRate.value+.02);
 }
 play(event,data={}){
  const e=typeof event==='string'?{...data,type:event}:event;if(!e)return;
  if(e.type==='level'){this.setLevel(e.index);return;}
  if(!this.ctx||this.ctx.state!=='running'||this.destroyed||!this.audible)return;
  const t=this.ctx.currentTime,material=e.propType||e.itemType||e.material||e.weapon||'body';
  switch(e.type){
   case 'hit':this._impact(!!e.heavy,material);this._voice(e,'hurt',e.heavy?.75:.4);break;
   case 'jump-hit':this.hiss(t,.04,.1,1500);this._voice(e,'exertion',.85);break;
   case 'swing':case 'enemy-swing':{
    const heavy=['heavy','kick','jump-kick','slam','charge'].includes(e.kind);
    this.hiss(t,heavy?.13:.075,heavy?.19:.105,heavy?1650:2350,this.fxBus,{end:heavy?430:800});
    this._voice(e,'exertion',e.type==='enemy-swing'?.22:heavy?.88:.58);break;
   }
   case 'prop-bat-hit':case 'item-bat-hit':this._impact(true,'bat');this._voice(e,'exertion',.7);break;
   case 'prop-hit':case 'item-hit':case 'prop-break':case 'item-break':this._impact(true,material);break;
   case 'car-hit':this._impact(true,'car');break;
   case 'car-break':this._impact(true,'crash');break;
   case 'prop-pickup':case 'item-pickup':this.hiss(t,.08,.09,420);this.tone(180,t,.06,.1,'triangle',this.fxBus,90);break;
   case 'prop-throw':case 'item-throw':this.hiss(t,.2,.23,1350,this.fxBus,{end:320});this._voice(e,'exertion',.9);break;
   case 'prop-land':case 'item-land':case 'prop-drop':case 'item-drop':this._impact(false,material);break;
   case 'land':this.tone(88,t,.13,.21,'sine',this.fxBus,32);this.hiss(t,.065,.11,340);break;
   case 'jump':this.hiss(t,.115,.08,1100,this.fxBus,{end:650});this._voice(e,'exertion',.48);break;
   case 'dodge':this.hiss(t,.14,.13,1200,this.fxBus,{end:450});break;
   case 'special':this._impact(true);this.hiss(t,.28,.18,620,this.fxBus,{end:1700});this._voice(e,'exertion',1);break;
   case 'pickup':case 'revive':[523,659,784].forEach((f,i)=>this.tone(f,t+i*.065,.14,.055,'triangle'));break;
   case 'down':this._impact(true);this._voice(e,'hurt',1);break;
   case 'defeat':[220,196,147].forEach((f,i)=>this.tone(f,t+i*.16,.3,.075,'triangle'));break;
   case 'arena-clear':case 'victory':[330,440,554,659,880].forEach((f,i)=>this.tone(f,t+i*.1,.26,.065,'triangle'));break;
   case 'wave':this.tone(86,t,.16,.15,'sine',this.fxBus,34);break;
  }
 }
 update(game,{menu=false,celebrating=false,visible=true}={}){
  const wasAudible=this.audible;
  if(!celebrating||!this.celebrating)this.celebrationPlayed=false;
  this.level=levelIndex(game?.levelIndex??this.level);this.playing=game?.mode==='playing';this.menu=!!menu;this.celebrating=!!celebrating;this.visible=!!visible;
  this.audible=this.playing&&!this.menu&&!this.celebrating&&this.visible;this.musicTarget=this._target();this.camera=game?.camera||0;
  if(!this.ctx||this.destroyed)return;
  if(wasAudible!==this.audible){
   this._gain(this.fxBus.gain,this.audible?this.mix.effects:0,.007);
   this._gain(this.voiceBus.gain,this.audible?this.mix.voice:0,.007);
   if(!this.audible)for(const source of this.sources)safeStop(source,this.ctx.currentTime+.03);
  }
  this._syncMusic();
  this._syncCelebration();
  const now=this.ctx.currentTime;
  for(const track of this.tracks.values())if(track.playing&&track.retireAt<=now)this._pauseTrack(track);
 }
 destroy(){
  this.destroyed=true;this._epoch++;
  for(const track of this.tracks.values()){track.media.pause();track.media.removeAttribute?.('src');track.media.load?.();disconnect(track.source);disconnect(track.gain);}
  for(const source of this.sources)safeStop(source);
  this.sources.clear();this.celebrationSources.clear();this.voices.clear();this.tracks.clear();this.voiceBuffers.clear();this.encodedVoices.clear();
  this.voiceTimes.clear();this.lastVoice.clear();this._loading=null;this._decoding=null;
  if(this.ctx)void this.ctx.close();this.ctx=null;this.active=false;this.playing=false;this.audible=false;this.celebrating=false;this.musicTarget=null;
 }
}
