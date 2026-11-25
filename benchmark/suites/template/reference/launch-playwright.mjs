// The launch-satori and launch-playwright kits' reference: the launch's values, as the template takes them.
export const files = (v) => ({ "designs/launch.json": `${JSON.stringify(v, null, 2)}\n` });
