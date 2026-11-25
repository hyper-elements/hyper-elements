// The launch-he kit's reference: a design whose root is the launch template, its values the brief's.
const q = (s) => JSON.stringify(s);
const image = (i) => `{{ src: ${q(i.src)}, width: ${i.width}, height: ${i.height} }}`;
export const files = (v) => ({
  "designs/launch.tsx": `import Launch from "../templates/launch";

export default () => (
  <Launch
    headline=${q(v.headline)}
    features={${q(v.features)}}
    launchDate=${q(v.launchDate)}${v.locale ? `\n    locale=${q(v.locale)}` : ""}
    screenshot=${image(v.screenshot)}
    artwork=${image(v.artwork)}
  />
);
`,
});
