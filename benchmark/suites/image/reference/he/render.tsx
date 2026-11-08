import { readFile, readdir } from "node:fs/promises";
import { renderImage } from "@hyper-elements/react/image";
import Card from "./card";

export default async function render() {
  const images = Object.fromEntries(
    await Promise.all((await readdir("assets")).filter((f) => f.endsWith(".png")).map(async (f) => [`assets/${f}`, await readFile(`assets/${f}`)])),
  );
  const { image, diagnostics } = await renderImage(<Card />, {
    fonts: [
      { family: "Inter", src: await readFile("fonts/Inter-Regular.ttf"), weight: 400 },
      { family: "Inter", src: await readFile("fonts/Inter-Bold.ttf"), weight: 700 },
      { family: "Lora", src: await readFile("fonts/Lora-Italic.ttf"), weight: 400, style: "italic" },
    ],
    images,
  });
  for (const d of diagnostics) console.log(`${d.severity} ${d.code} at ${d.path}: ${d.message}`);
  return image;
}
