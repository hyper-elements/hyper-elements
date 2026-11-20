import { Canvas, Circle, Column, Heading, Image, Layer, Path, Row, Svg, Text, token } from "@hyper-elements/react";
import type { Brand } from "../../_brand";

export const meta = {
  label: "Speaker card",
  description: "A card announcing one speaker, for social posts: their photo in a circle over shapes in the brand's colors, their name and role, their talk in a block of color, and the event and date",
};

export default function SummitSpeaker({ brand }: { brand: Brand }) {
  return (
    <Canvas
      width={1080}
      height={1080}
      fonts={brand.fonts}
      lang={brand.lang ?? "en"}
      dir={brand.dir}
      theme={brand.theme}
    >
      <Column style={{ height: 1080, padding: 72, justifyContent: "space-between" }}>
        <Row style={{ alignItems: "start", justifyContent: "space-between" }}>
          <Column style={{ height: 580, padding: [12, 0, 8], justifyContent: "space-between" }}>
            <Column style={{ gap: 28 }}>
              <Image
                src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
                alt={brand.logo.alt}
                style={{ width: 170 }}
              />
              <Column
                style={{
                  width: 176,
                  backgroundColor: token("colors.primary"),
                  borderRadius: 999,
                  padding: [10, 0],
                }}
              >
                <Text
                  style={{
                    color: token("colors.primaryForeground"),
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: 2,
                    lineHeight: 1.2,
                    textTransform: "uppercase",
                    textAlign: "center",
                  }}
                >
                  Speaker
                </Text>
              </Column>
            </Column>
            <Column style={{ gap: 6 }}>
              <Text
                style={{
                  fontSize: 76,
                  fontWeight: 700,
                  lineHeight: 1,
                  letterSpacing: -1,
                  color: token("colors.primary"),
                }}
              >
                May 14
              </Text>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                Build Day
              </Text>
            </Column>
          </Column>
          <Layer style={{ width: 580, height: 580, alignItems: "center", justifyItems: "center" }}>
            <Svg width={580} height={580} viewBox="0 0 580 580">
              <Circle cx={326.8} cy={326.8} r={236} style={{ fill: token("colors.primary") }} />
              <Circle
                cx={276.2}
                cy={271.6}
                r={256}
                style={{ fill: "transparent", stroke: token("colors.accent"), strokeWidth: 5 }}
              />
              <Circle cx={18} cy={460} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={42} cy={460} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={66} cy={460} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={90} cy={460} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={114} cy={460} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={18} cy={484} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={42} cy={484} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={66} cy={484} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={90} cy={484} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={114} cy={484} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={18} cy={508} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={42} cy={508} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={66} cy={508} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={90} cy={508} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={114} cy={508} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={18} cy={532} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={42} cy={532} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={66} cy={532} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={90} cy={532} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={114} cy={532} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={18} cy={556} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={42} cy={556} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={66} cy={556} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={90} cy={556} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={114} cy={556} r={5} style={{ fill: token("colors.accent") }} />
              <Circle cx={546} cy={46} r={22} style={{ fill: token("colors.accent") }} />
              <Path
                d="M430,554 q18,-22 36,0 t36,0 t36,0 t36,0"
                style={{ fill: "transparent", stroke: token("colors.primary"), strokeWidth: 6 }}
              />
            </Svg>
            <Layer
              style={{
                width: 460,
                height: 460,
                borderRadius: 230,
                border: { width: 10, style: "solid", color: token("colors.background") },
              }}
            >
              <Image
                src={{
                  src: "https://hyperelements.dev/generated/kits/assets/kits/summit/speaker.jpg",
                  width: 800,
                  height: 800,
                }}
                alt=""
              />
            </Layer>
          </Layer>
        </Row>
        <Column style={{ gap: 22 }}>
          <Column style={{ gap: 10 }}>
            <Heading
              level={1}
              fit={{ sizes: [84, 76, 68, 60], maxLines: 2 }}
              style={{ lineHeight: 1.02, letterSpacing: -1 }}
            >
              Rosa Lindqvist
            </Heading>
            <Text style={{ fontSize: 28, lineHeight: 1.3, color: token("colors.muted") }}>
              Staff engineer, Northwind
            </Text>
          </Column>
          <Column
            style={{
              width: 936,
              backgroundColor: token("colors.primary"),
              borderRadius: token("radii.md"),
              padding: [26, 32],
            }}
          >
            <Text
              fit={{ sizes: [36, 32, 28], maxLines: 2 }}
              style={{ color: token("colors.primaryForeground"), fontWeight: 700, lineHeight: 1.22 }}
            >
              “Shipping weekly without breaking anything”
            </Text>
          </Column>
        </Column>
      </Column>
    </Canvas>
  );
}
