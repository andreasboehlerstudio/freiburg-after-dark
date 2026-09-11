/** Only the current request may advance a screen; cancelled work can still warm the cache. */
export class LoadingFlow {
 constructor(){this.generation=0;this.active=null;}
 get busy(){return this.active!==null;}
 cancel(){this.generation++;this.active=null;}
 async run({load,onStart=()=>{},onProgress=()=>{},onSuccess=()=>{},onError=()=>{}}){
  if(this.busy)return false;
  const token=++this.generation;this.active=token;
  const current=()=>this.active===token&&this.generation===token;
  try{
   onStart();
   await load(progress=>{if(current())onProgress(progress);});
   if(!current())return false;
   this.active=null;onSuccess();return true;
  }catch(error){
   if(this.generation!==token||this.active!==null&&this.active!==token)return false;
   this.active=null;onError(error);return false;
  }
 }
}
