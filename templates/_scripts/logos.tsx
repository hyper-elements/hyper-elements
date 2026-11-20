/**
 * Draws each sample brand's logo, `_assets/brands/<brand>/logo.png`: its name in its heading font and color, beside a
 * mark in its primary color, on a transparent background. Run with `pnpm --filter ./templates logos` when a brand's
 * name, colors or heading font change; the files are committed.
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { Canvas, Circle, Rect, Row, Svg, Text } from "@hyper-elements/react";
import { renderImage } from "@hyper-elements/react/image";
import { firstFamily, type Brand } from "../_brand";
import { ASSET_DIR, ROOT, fontFiles } from "./assets";

const brands = readdirSync(join(ROOT, "_brands")).filter((file) => file.endsWith(".ts"));
for (const file of brands) {
  const id = basename(file, ".ts");
  const { brand } = (await import(join(ROOT, "_brands", file))) as { brand: Brand };
  const colors = brand.theme.colors as Record<string, string>;
  const fonts = brand.theme.fonts as Record<string, string>;
  const weight = Number((brand.theme.elements as { Heading?: { fontWeight?: number } } | undefined)?.Heading?.fontWeight ?? 700) as 400 | 500 | 600 | 700 | 800;
  const rounded = Number((brand.theme.radii as Record<string, number>).md) > 0;
  const mark = rounded ? <Circle cx={14} cy={14} r={14} style={{ fill: colors.primary }} /> : <Rect x={0} y={0} width={28} height={28} style={{ fill: colors.primary }} />;
  const { image } = await renderImage(
    <Canvas width={240} height={60} style={{ padding: [0, 8], justifyContent: "center" }}>
      <Row style={{ gap: 12, alignItems: "center" }}>
        <Svg width={28} height={28}>{mark}</Svg>
        <Text style={{ fontFamily: firstFamily(fonts.heading), fontWeight: weight, fontSize: 26, color: colors.foreground, lineHeight: 1 }}>{brand.name}</Text>
      </Row>
    </Canvas>,
    { fonts: fontFiles(brand), scale: 2 },
  );
  const dir = join(ASSET_DIR, "brands", id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "logo.png"), image);
  console.log(`_assets/brands/${id}/logo.png`);
}
