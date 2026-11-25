// scripts/render.tsx
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { formatDiagnostics, render } from "@hyper-elements/react";
import { renderImage } from "@hyper-elements/react/image";
import Welcome from "../designs/welcome";
import Launch from "../templates/launch-graphic";

const bytes = (path: string) => new Uint8Array(readFileSync(path));
mkdirSync("out", { recursive: true });

// An email. The design's root is the template, so render() hands it to the template, which checks it first.
// A design the template refuses rejects here, with its problems.
const { html } = await render(<Welcome />);
writeFileSync("out/welcome.html", html);

// An image. Check the values, then draw the snapshot the check returned: what was checked is what's drawn.
const values = {
  headline: "Meet Orbit 3.0: release notes that write themselves",
  features: ["Drafts from merged PRs", "Your voice, every release", "Ships to Slack and email"],
  launchDate: "2026-12-03",
  screenshot: { src: "screenshot.png", width: 1600, height: 1000 },
  artwork: { src: "shapes.png", width: 1600, height: 1200 },
};
const checked = Launch.check(values, { format: "square" });
if (!checked.valid) throw new Error(formatDiagnostics(checked.diagnostics));

// Nothing is fetched: give each font the design names, and each image by the src it's written with.
const { image } = await renderImage(checked.snapshots.square!, {
  fonts: [
    { family: "Inter", src: bytes("fonts/Inter-Regular.ttf"), weight: 400 },
    { family: "Inter", src: bytes("fonts/Inter-Bold.ttf"), weight: 700 },
  ],
  images: {
    "screenshot.png": bytes("designs/art/screenshot.png"),
    "shapes.png": bytes("designs/art/shapes.png"),
    "./assets/orbit-logo.png": bytes("templates/assets/orbit-logo.png"),
  },
});
writeFileSync("out/launch.png", image);
