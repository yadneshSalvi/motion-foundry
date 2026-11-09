import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator";
import {WorkbenchJourney} from "./WorkbenchJourney";
import {WorkbenchReach} from "./WorkbenchReach";
import {WorkbenchFilmRehearsal} from "./WorkbenchFilmRehearsal";
import "./FilmCaptureIndex";
import {WorkbenchMenuGraph} from "./WorkbenchMenuGraph";
import {WorkbenchPlacementSmoke} from "./WorkbenchPlacementSmoke";
import {WorkbenchCrankSmoke} from "./WorkbenchCrankSmoke";
import {WorkbenchDrawingSmoke} from "./WorkbenchDrawingSmoke";
import {WorkbenchSupportSmoke} from "./WorkbenchSupportSmoke";

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenarios=[
    {id:"motion-workbench-mount-smoke",typename:WorkbenchSupportSmoke.getTypeName(),parameters:{mode:"mount",__leaf__log_level:"WARN",__leaf__timeout_secs:"30",__leaf__diagnostic_policy:"fail-fast",__leaf__diagnostic_report_duration_ms:"0"}},
    {id:"motion-workbench-support-smoke",typename:WorkbenchSupportSmoke.getTypeName(),parameters:{mode:"controls-send",__leaf__log_level:"WARN",__leaf__timeout_secs:"120",__leaf__diagnostic_policy:"fail-fast",__leaf__diagnostic_report_duration_ms:"0"}},
    {id:"motion-workbench-drawing-smoke",typename:WorkbenchDrawingSmoke.getTypeName(),parameters:{__leaf__log_level:"WARN",__leaf__timeout_secs:"40",__leaf__diagnostic_policy:"fail-fast",__leaf__diagnostic_report_duration_ms:"0"}},
    {id:"motion-workbench-crank-smoke",typename:WorkbenchCrankSmoke.getTypeName(),parameters:{__leaf__log_level:"WARN",__leaf__timeout_secs:"45",__leaf__diagnostic_policy:"fail-fast",__leaf__diagnostic_report_duration_ms:"0"}},
    {id:"motion-workbench-placement-smoke",typename:WorkbenchPlacementSmoke.getTypeName(),parameters:{__leaf__log_level:"WARN",__leaf__timeout_secs:"60",__leaf__diagnostic_policy:"fail-fast",__leaf__diagnostic_report_duration_ms:"0"}},
    {id:"motion-workbench-menu-graph",typename:WorkbenchMenuGraph.getTypeName(),parameters:{__leaf__log_level:"WARN",__leaf__timeout_secs:"100",__leaf__diagnostic_policy:"fail-fast",__leaf__diagnostic_report_duration_ms:"0"}},
    {id:"motion-workbench-draw-solve-crank-repair",typename:WorkbenchJourney.getTypeName(),parameters:{__leaf__log_level:"WARN",__leaf__timeout_secs:"120",__leaf__diagnostic_policy:"fail-fast",__leaf__diagnostic_report_duration_ms:"0"}},
    {id:"motion-workbench-direct-reach-and-undo",typename:WorkbenchReach.getTypeName(),parameters:{__leaf__log_level:"WARN",__leaf__timeout_secs:"90",__leaf__diagnostic_policy:"fail-fast",__leaf__diagnostic_report_duration_ms:"0"}},
    {id:"motion-workbench-film-rehearsal",typename:WorkbenchFilmRehearsal.getTypeName(),parameters:{
      lead_in_ms:"1000",contact_inspect_ms:"2000",ending_motion_ms:"2000",
      __leaf__log_level:"WARN",__leaf__timeout_secs:"150",
      __leaf__diagnostic_policy:"fail-fast",__leaf__diagnostic_report_duration_ms:"0",
    }},
  ];
}
