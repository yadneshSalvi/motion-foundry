import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator";
import {WorkbenchExportFilm} from "./WorkbenchExportFilm";

/** Test-only registry, imported by the existing index; no extra scene component is needed. */
export class FilmCaptureIndex {
  @scenariosIndex
  static scenarios=[{id:"motion-workbench-export-film",typename:WorkbenchExportFilm.getTypeName(),parameters:{
    __leaf__log_level:"WARN",__leaf__timeout_secs:"100",
    __leaf__diagnostic_policy:"fail-fast",__leaf__diagnostic_report_duration_ms:"0",
  }}];
}
