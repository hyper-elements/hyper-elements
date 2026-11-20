import { Canvas, Circle, Column, Heading, Image, Row, Svg, Text, token } from "@hyper-elements/react";
import type { Brand } from "../_brand";

export const meta = {
  label: "Open Graph card",
  description: "A link preview, 1200 by 630: the title fitted to three lines, the brand's logo and site, and shapes in its colors",
};

export default function OgCard({ brand }: { brand: Brand }) {
  return (
    <Canvas
      width={1200}
      height={630}
      fonts={brand.fonts}
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
    >
      <Row style={{ height: 630, gap: 40 }}>
        <Column style={{ width: 820, height: 630, padding: [64, 0, 64, 72], justifyContent: "space-between" }}>
          <Image
            src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
            alt={brand.logo.alt}
            style={{ width: 200 }}
          />
          <Heading level={1} fit={{ sizes: [68, 60, 52, 46, 40], maxLines: 3 }} style={{ lineHeight: 1.08 }}>
            How we cut our build times in half without changing a line of product code
          </Heading>
          <Text style={{ fontSize: 26, color: token("colors.muted") }}>{new URL(brand.links.site).host}</Text>
        </Column>
        <Svg width={340} height={630} viewBox="0 0 340 630">
          <Circle cx={250} cy={120} r={150} style={{ fill: token("colors.primary") }} />
          <Circle cx={120} cy={420} r={90} style={{ fill: token("colors.accent") }} />
          <Circle cx={300} cy={560} r={120} style={{ fill: token("colors.surface") }} />
        </Svg>
      </Row>
    </Canvas>
  );
}
