export type WorkbenchSounds={tick?:AudioTrackAsset;contact?:AudioTrackAsset;clear?:AudioTrackAsset};
type Voice={root:SceneObject;audio:AudioComponent};

/** One bounded spatial voice per original cue; each native stream keeps a fixed track. */
export class WorkbenchAudio {
  private voices:Partial<Record<keyof WorkbenchSounds,Voice>>={};
  private ready=false;
  private failed=false;
  private protectUntil=0;
  private counters={tick:0,contact:0,clear:0};
  constructor(owner:BaseScriptComponent,parent:SceneObject,private sounds:WorkbenchSounds){
    owner.createEvent("OnStartEvent").bind(()=>{
      for(const kind of ["tick","contact","clear"] as const){
        const track=sounds[kind];if(!track)continue;
        const root=global.scene.createSceneObject("Workbench spatial "+kind);root.setParent(parent);
        const audio=root.createComponent("Component.AudioComponent") as AudioComponent;
        audio.enabled=true;audio.playbackMode=Audio.PlaybackMode.LowLatency;audio.spatialAudio.enabled=true;
        // UIKitAudioPlayer uses this same stable per-track stream pattern. Never swap tracks during playback.
        audio.audioTrack=track;this.voices[kind]={root,audio};
      }
      this.ready=true;
    });
  }
  public play(kind:keyof WorkbenchSounds,world:vec3){
    const voice=this.voices[kind];if(!this.ready||!voice||kind==="tick"&&getTime()<this.protectUntil)return;
    try{
      voice.root.getTransform().setWorldPosition(world);
      voice.audio.volume=kind==="tick"?.24:.38;voice.audio.position=0;voice.audio.play(1);
      this.counters[kind]++;if(kind!=="tick")this.protectUntil=getTime()+.65;
    }catch(error){
      // Cue failure is separate from numerical acceptance and is exposed in diagnostics.
      if(!this.failed)print("[MotionFoundry audio failure] "+kind+": "+String(error));this.failed=true;
    }
  }
  public snapshot(){return{...this.counters,failed:this.failed,voiceCount:Object.keys(this.voices).length,configured:{tick:!!this.sounds.tick,contact:!!this.sounds.contact,clear:!!this.sounds.clear}};}
}
