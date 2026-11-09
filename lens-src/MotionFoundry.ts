import {LoopController} from "./LoopController";

/** Native entry point. The separate Petal companion and numerical contracts are retained. */
@component
export class MotionFoundry extends BaseScriptComponent {
  @input @hint("HTTPS companion API. Vendor credentials never belong in the Lens.") backendUrl:string="";
  @input @hint("Retained material binding for native hardware.") champagne!:Material;
  @input @hint("Neutral material for the share tag.") porcelain!:Material;
  @input @hint("Unlit source material for the workbench palette.") mint!:Material;
  @input @hint("Retained light blue material binding.") sky!:Material;
  @input @hint("Retained constraint material binding.") coral!:Material;
  @input @allowUndefined @hint("Original ratchet tick imported from lens-src/audio/crank-tick.wav.") crankTick:AudioTrackAsset;
  @input @allowUndefined @hint("Original short contact cue.") contactCue:AudioTrackAsset;
  @input @allowUndefined @hint("Original drawing-closed chime.") clearCue:AudioTrackAsset;
  @input @hint("Preview: ask for a WorldQuery surface at startup. Devices always require placement.") placeOnSurface:boolean=false;
  private loop:LoopController;
  private internet:InternetModule=require("LensStudio:InternetModule");
  onAwake(){
    if(!this.champagne||!this.porcelain||!this.mint||!this.sky||!this.coral){print("[MotionFoundry] Assign all five material inputs.");return;}
    this.loop=new LoopController(this,this.sceneObject,this.champagne,this.porcelain,this.mint,this.sky,this.coral,this.internet,()=>this.backendUrl,{
      sounds:{tick:this.crankTick,contact:this.contactCue,clear:this.clearCue},placeOnStart:this.placeOnSurface,
    });
    this.createEvent("UpdateEvent").bind(()=>this.loop.tick());
    print("[MotionFoundry] Tabletop workbench ready. True centimetres; independent sampled verification.");
  }
  public getStateSnapshot(){if(!this.loop)throw Error("Workbench is not ready");return this.loop.getStateSnapshot();}
  public getAudioSchedulingSnapshot(){if(!this.loop)throw Error("Workbench is not ready");return this.loop.getAudioSchedulingSnapshot();}
}
