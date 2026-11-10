/**
 * @hyper-elements/email-client-models, loaded when it's first needed. It's an ES module only: a dynamic import()
 * loads it from this package's CommonJS build too, on Node 20, where require() can't.
 */
export type Models = typeof import("@hyper-elements/email-client-models");

let loading: Promise<Models> | undefined;

export const loadModelsPackage = (): Promise<Models> => (loading ??= import("@hyper-elements/email-client-models"));

/** After a failed import: the next call imports it again. */
export const forgetModelsPackage = (): void => {
  loading = undefined;
};
