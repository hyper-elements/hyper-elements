import { Canvas, Circle, Column, Heading, Image, Layer, Path, Row, Svg, Text, token } from "@hyper-elements/react";
import type { Brand } from "../../_brand";

export const meta = {
  label: "Launch graphic",
  description: "A product launch for social posts: the date, a headline fitted to three lines, three features, and the product shown in a window over artwork",
};

export default function SignalAnnouncement({ brand }: { brand: Brand }) {
  return (
    <Canvas
      width={1080}
      height={1080}
      fonts={brand.fonts}
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
    >
      <Column style={{ height: 1080, padding: 64, justifyContent: "space-between" }}>
        <Image
          src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
          alt={brand.logo.alt}
          style={{ width: 180 }}
        />
        <Column style={{ width: 952, gap: 18 }}>
          <Row style={{ gap: 10, alignItems: "center" }}>
            <Svg width={14} height={14}>
              <Circle cx={7} cy={7} r={7} style={{ fill: token("colors.accent") }} />
            </Svg>
            <Text
              style={{
                color: token("colors.primary"),
                fontSize: 27,
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              March 12
            </Text>
          </Row>
          <Heading level={1} fit={{ sizes: [72, 64, 56], maxLines: 3 }} style={{ lineHeight: 1.06 }}>
            Release notes that write themselves
          </Heading>
          <Column style={{ gap: 8 }}>
            <Row style={{ gap: 12, alignItems: "center" }}>
              <Svg width={28} height={28} viewBox="0 0 24 24">
                <Circle cx={12} cy={12} r={12} style={{ fill: token("colors.primary") }} />
                <Path
                  d="M6.5 12.5 L10.5 16.5 L17.5 8.5"
                  style={{ fill: "transparent", stroke: token("colors.primaryForeground"), strokeWidth: 2.6 }}
                />
              </Svg>
              <Text style={{ fontSize: 30, lineHeight: 1.3 }}>Drafts from merged changes</Text>
            </Row>
            <Row style={{ gap: 12, alignItems: "center" }}>
              <Svg width={28} height={28} viewBox="0 0 24 24">
                <Circle cx={12} cy={12} r={12} style={{ fill: token("colors.primary") }} />
                <Path
                  d="M6.5 12.5 L10.5 16.5 L17.5 8.5"
                  style={{ fill: "transparent", stroke: token("colors.primaryForeground"), strokeWidth: 2.6 }}
                />
              </Svg>
              <Text style={{ fontSize: 30, lineHeight: 1.3 }}>Your voice, every release</Text>
            </Row>
            <Row style={{ gap: 12, alignItems: "center" }}>
              <Svg width={28} height={28} viewBox="0 0 24 24">
                <Circle cx={12} cy={12} r={12} style={{ fill: token("colors.primary") }} />
                <Path
                  d="M6.5 12.5 L10.5 16.5 L17.5 8.5"
                  style={{ fill: "transparent", stroke: token("colors.primaryForeground"), strokeWidth: 2.6 }}
                />
              </Svg>
              <Text style={{ fontSize: 30, lineHeight: 1.3 }}>Ships to chat and email</Text>
            </Row>
          </Column>
        </Column>
        <Layer
          style={{
            width: 952,
            height: 420,
            borderRadius: token("radii.md"),
            alignItems: "center",
            justifyItems: "center",
          }}
        >
          <Image
            src={{
              src: "https://hyperelements.dev/generated/kits/assets/kits/signal/artwork.png",
              width: 1600,
              height: 1200,
            }}
            alt=""
          />
          <Column
            style={{
              width: 516,
              backgroundColor: token("colors.surface"),
              border: { width: 2, style: "solid", color: token("colors.foreground") },
              borderRadius: token("radii.md"),
              overflow: "hidden",
            }}
          >
            <Row style={{ padding: [11, 14] }}>
              <Svg width={52} height={12}>
                <Circle cx={6} cy={6} r={6} style={{ fill: token("colors.primary") }} />
                <Circle cx={26} cy={6} r={6} style={{ fill: token("colors.accent") }} />
                <Circle cx={46} cy={6} r={6} style={{ fill: token("colors.border") }} />
              </Svg>
            </Row>
            <Image
              src={{
                src: "https://hyperelements.dev/generated/kits/assets/kits/signal/screenshot.png",
                width: 1600,
                height: 1000,
              }}
              alt="The product"
              style={{ width: 512, height: 320 }}
            />
          </Column>
        </Layer>
      </Column>
    </Canvas>
  );
}
