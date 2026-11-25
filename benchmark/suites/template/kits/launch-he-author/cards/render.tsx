// The kit's render: the design (designs/launch.tsx, whose root is the launch template) checked by its template, then
// drawn in the format tools/render-launch.mjs asks for (LAUNCH_FORMAT) from the snapshot the check returned, with the
// fonts in fonts/ and the images in assets/ and art/. A launch the template refuses isn't drawn: its problems are said.
import { readdir, readFile } from "node:fs/promises";
import { renderImage } from "@hyper-elements/react/image";
import { check } from "@hyper-elements/react/template";
import Design from "../designs/launch";

const WEIGHTS: Record<string, number> = { "Inter-Regular.ttf": 400, "Inter-Bold.ttf": 700 };

export default async function render() {
  const format = process.env.LAUNCH_FORMAT ?? "square";
  const checked = check(<Design />);
  if (!checked.valid) throw Object.assign(new Error("the template refused the launch"), { diagnostics: checked.diagnostics.filter((d) => d.severity === "error") });
  const snapshot = checked.snapshots[format];
  if (!snapshot) throw new Error(`the template has no ${format} format`);
  const fonts = [];
  for (const file of await readdir("fonts")) if (WEIGHTS[file]) fonts.push({ family: "Inter", src: await readFile(`fonts/${file}`), weight: WEIGHTS[file] });
  const images: Record<string, Uint8Array> = {};
  for (const dir of ["assets", "art"]) for (const file of (await readdir(dir)).filter((f) => f.endsWith(".png"))) images[`${dir}/${file}`] = await readFile(`${dir}/${file}`);
  const { image, diagnostics } = await renderImage(snapshot, { fonts, images });
  for (const d of diagnostics) if (d.severity !== "info") console.log(`${d.severity} ${d.code} at ${d.path}: ${d.message}`);
  return image;
}
