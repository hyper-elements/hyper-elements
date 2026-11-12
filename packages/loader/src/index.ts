/**
 * Loading a template, the parts with no resolution policy of their own: shared by @hyper-elements/migrate and
 * @hyper-elements/cli, which each decide where React and Elements come from.
 */
export { projectTsconfig, projectConfig, workspaceRoot, realpathOr, type ProjectTsconfig, type ProjectTsconfigOptions } from "./tsconfig";
export { walk, SOURCE, IGNORED, type WalkOptions } from "./walk";
export { defaultExport, templateComponent, type TemplateComponent } from "./exports";
export { guard, type Guard } from "./guard";
