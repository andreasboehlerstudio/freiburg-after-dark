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
  this.music=true;this.level=0;this.active=false;this.playing=false;this.camera=0;
  this.tracks=new Map();this.voiceBuffers=new Map();this.encodedVoices=new Map();
  this.voiceTimes=new Map();this.lastVoice=new Map();this.voices=new Set();this.sources=new Set();
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
   this[name]=c.createGain();this[name].gain.value=this.mix[key];this[name].connect(this.master);
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
  const c=this._context();if(!c)return false;
  try{await c.resume();this.active=c.state==='running';}catch{this.active=false;}
  // Download/decode is deliberately detached from the user's Start action.
  void this.load();this._syncMusic();return this.active;
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
  for(const [name,key] of [['musicBus','music'],['fxBus','effects'],['voiceBus','voice']])if(this[name])this._gain(this[name].gain,this.mix[key]);
 }
 setMusic(value){if(typeof value==='boolean'){this.music=value;this._syncMusic();}else this.setMix({music:value});}
 setLevel(value){const next=levelIndex(value);if(next!==this.level){this.level=next;this._syncMusic();}}
 _track(index){
  if(this.tracks.has(index))return this.tracks.get(index);
  if(!this.AudioClass||!this.ctx)return null;
  try{
   const media=new this.AudioClass(MUSIC_TRACKS[index].url);
   media.preload='auto';media.loop=true;
   const source=this.ctx.createMediaElementSource(media),gain=this.ctx.createGain();
   gain.gain.value=0;source.connect(gain);gain.connect(this.musicBus);
   const track={index,media,source,gain,playing:false,pending:false,failed:false,retryAt:0,from:0,to:0,fadeAt:0,fadeDuration:0,retireAt:Infinity};
   media.addEventListener?.('error',()=>{track.failed=true;track.pending=false;track.playing=false;this.errors.push('Music unavailable: '+MUSIC_TRACKS[index].id);});
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
 _pauseMusic(){
  for(const track of this.tracks.values()){
   track.media.pause();track.playing=false;track.retireAt=Infinity;
   this._fade(track,0,.025);
  }
 }
 _syncMusic(){
  if(!this.ctx||this.ctx.state!=='running'||this.destroyed)return;
  if(!this.music||!this.playing){this._pauseMusic();return;}
  const track=this._track(this.level);if(!track||track.failed||track.pending)return;
  const now=this.ctx.currentTime;
  if(track.playing){if(track.to!==1){this._fade(track,1,.18);track.retireAt=Infinity;}return;}
  if(now<track.retryAt)return;
  track.pending=true;
  const epoch=this._epoch;
  Promise.resolve().then(()=>track.media.play()).then(()=>{
   track.pending=false;
   if(epoch!==this._epoch||this.destroyed||!this.playing||!this.music||track.index!==this.level){track.media.pause();return;}
   track.playing=true;track.retireAt=Infinity;
   const others=[...this.tracks.values()].filter(other=>other!==track&&other.playing);
   // Keep the old track audible until the new stream really starts.
   const fade=others.length?1.1:.18;this._fade(track,1,fade);
   for(const other of others){this._fade(other,0,fade);other.retireAt=this.ctx.currentTime+fade;}
  }).catch(error=>{
   track.pending=false;track.retryAt=(this.ctx?.currentTime||0)+1;
   if(error?.name!=='NotAllowedError'){track.failed=true;this.errors.push('Music playback failed: '+MUSIC_TRACKS[track.index].id);}
  });
 }
 _source(node,nodes=[]){
  this.sources.add(node);
  node.onended=()=>{this.sources.delete(node);disconnect(node);for(const extra of nodes)disconnect(extra);};
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
  this.tone((heavy?112:170)*r,t,heavy?.22:.145,heavy?.45:.33,'sine',this.fxBus,heavy?36:47);
  this.tone((heavy?270:340)*r,t,.07,heavy?.17:.13,'triangle',this.fxBus,85);
  this.hiss(t,.065,heavy?.24:.18,heavy?560:850,this.fxBus,{q:.8,end:260});
  this.hiss(t+.004,.022,heavy?.19:.14,2300,this.fxBus,{type:'highpass',end:1500});
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
  if(!this.ctx||this.ctx.state!=='running'||this.destroyed)return;
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
 update(game){
  const next=levelIndex(game?.levelIndex??this.level),playing=game?.mode==='playing';
  const changed=next!==this.level||playing!==this.playing;
  this.level=next;this.playing=playing;this.camera=game?.camera||0;
  if(!this.ctx||this.ctx.state!=='running'||this.destroyed)return;
  if(changed){
   this._gain(this.fxBus.gain,playing?this.mix.effects:0,.007);
   this._gain(this.voiceBus.gain,playing?this.mix.voice:0,.007);
   if(!playing)for(const source of this.sources)safeStop(source,this.ctx.currentTime+.03);
  }
  if(changed)this._syncMusic();else if(playing&&this.music)this._syncMusic();
  const now=this.ctx.currentTime;
  for(const track of this.tracks.values())if(track.playing&&track.retireAt<=now){track.media.pause();track.playing=false;track.retireAt=Infinity;}
 }
 destroy(){
  this.destroyed=true;this._epoch++;
  for(const track of this.tracks.values()){track.media.pause();track.media.removeAttribute?.('src');track.media.load?.();disconnect(track.source);disconnect(track.gain);}
  for(const source of this.sources)safeStop(source);
  this.sources.clear();this.voices.clear();this.tracks.clear();this.voiceBuffers.clear();this.encodedVoices.clear();
  this.voiceTimes.clear();this.lastVoice.clear();this._loading=null;this._decoding=null;
  if(this.ctx)void this.ctx.close();this.ctx=null;this.active=false;this.playing=false;
 }
}
