import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator";
import {WorkbenchFilmRehearsal} from "./WorkbenchFilmRehearsal";

/** One registered run survives the MCP's fresh Preview reset and shares one
 * actual hand/manager lifecycle. The support flows never reset product state. */
export class FilmCaptureIndex {
  @scenariosIndex
  static scenarios=[{id:"motion-workbench-film-session",typename:WorkbenchFilmRehearsal.getTypeName(),parameters:{
    followups:"controls-place-send",lead_in_ms:"1000",contact_inspect_ms:"2000",ending_motion_ms:"2000",
    __leaf__log_level:"WARN",__leaf__timeout_secs:"300",
    __leaf__diagnostic_policy:"fail-fast",__leaf__diagnostic_report_duration_ms:"0",
  }}];
}
