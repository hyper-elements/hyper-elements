import { readFile, writeFile } from "node:fs/promises";
import { renderImage } from "@hyper-elements/react/image";
import Card from "../../designs/card";

const regular = await readFile("fonts/Inter-Regular.ttf");
const bold = await readFile("fonts/Inter-Bold.ttf");

const { image, width, height } = await renderImage(<Card />, {
  fonts: [
    { family: "Inter", src: regular },
    { family: "Inter", src: bold, weight: 700 },
  ],
});
console.log(`${width}×${height}`);
await writeFile("card.png", image);
