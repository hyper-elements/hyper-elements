/**
 * emailImages() where an engine's installed version can't be read (an app bundled into one file): the pictures' names
 * can't follow it, which it says, once.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Canvas, Email, Text, render } from "@hyper-elements/react";
import { emailImages } from "../../src/image";
import { installedVersion } from "../../src/image/engines";

vi.mock("../../src/image/engines", async (original) => {
  const real = await original<typeof import("../../src/image/engines")>();
  return { installedVersion: (name: string) => (name === "satori" ? "unknown" : real.installedVersion(name)) };
});

const FONT = readFileSync(join(dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json")), "standard_fonts", "LiberationSans-Regular.ttf"));

it("says once that the pictures' names don't follow an engine whose version can't be read", async () => {
  expect(installedVersion("satori")).toBe("unknown");
  const card = (words: string) => (
    <Canvas width={200} height={60} alt={words} style={{ backgroundColor: "#000000", fontFamily: "Liberation Sans" }}>
      <Text>{words}</Text>
    </Canvas>
  );
  // One drawer, made once and used for each email (as an app does): said once in each render.
  const draw = emailImages({ fonts: [{ family: "Liberation Sans", src: FONT }] });
  for (const words of ["One", "Two"]) {
    const { diagnostics } = await render(
      <Email>
        {card(`${words} a`)}
        {card(`${words} b`)}
      </Email>,
      { assets: { baseUrl: "https://cdn.example.com/email/", draw } }
    );
    const said = diagnostics.filter((d) => d.code === "image/engine-version");
    expect(said.map((d) => [d.severity, d.path])).toEqual([["warning", "root.children[0]"]]);
    expect(said[0]!.message).toContain("satori's installed version can't be read here");
  }
});
