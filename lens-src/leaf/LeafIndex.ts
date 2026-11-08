import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator";
import {WorkbenchJourney} from "./WorkbenchJourney";
import {WorkbenchReach} from "./WorkbenchReach";
import {WorkbenchFilmRehearsal} from "./WorkbenchFilmRehearsal";
import "./FilmCaptureIndex";

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenarios=[
    {id:"motion-workbench-draw-solve-crank-repair",typename:WorkbenchJourney.getTypeName()},
    {id:"motion-workbench-direct-reach-and-undo",typename:WorkbenchReach.getTypeName()},
    {id:"motion-workbench-film-rehearsal",typename:WorkbenchFilmRehearsal.getTypeName(),parameters:{
      lead_in_ms:"3500",contact_inspect_ms:"3500",ending_motion_ms:"3500",
      __leaf__log_level:"WARN",__leaf__timeout_secs:"150",
      __leaf__diagnostic_policy:"fail-fast",__leaf__diagnostic_report_duration_ms:"0",
    }},
  ];
}
