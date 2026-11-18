import {
  Canvas,
  Circle,
  Column,
  Heading,
  Path,
  Rect,
  Row,
  Svg,
  Text,
} from "@hyper-elements/react";

const fonts = [
  { family: "Inter", src: "../fonts/Inter-Regular.ttf", weight: 400 },
  { family: "Inter", src: "../fonts/Inter-Bold.ttf", weight: 700 },
];
const INK = "#15132e";
const SUN = "#ffc93c";
const TEAL = "#2dd4bf";
const CORAL = "#ff6b57";
const PINK = "#f9a8d4";
const MIST = "#e0e7ff";

// Six tiles, two across: each a ground, and a shape drawn on it.
const T = 210;
const tiles = [
  [TEAL, "quarter", SUN],
  [CORAL, "dot", MIST],
  [SUN, "ring", INK],
  [INK, "quarter", PINK],
  [PINK, "dot", CORAL],
  [MIST, "quarter", TEAL],
] as const;

function Tile({ at }: { at: number }) {
  const [ground, shape, color] = tiles[at];
  const [x, y] = [(at % 2) * T, Math.floor(at / 2) * T];
  const [cx, cy] = [x + T / 2, y + T / 2];
  const quarter = `M${x} ${y}h${T}a${T} ${T} 0 0 1 ${-T} ${T}z`;
  const ring = { fill: "transparent", stroke: color, strokeWidth: 30 };
  return (
    <>
      <Rect x={x} y={y} width={T} height={T} style={{ fill: ground }} />
      {shape === "quarter" && <Path d={quarter} style={{ fill: color }} />}
      {shape === "dot" && (
        <Circle cx={cx} cy={cy} r={64} style={{ fill: color }} />
      )}
      {shape === "ring" && <Circle cx={cx} cy={cy} r={62} style={ring} />}
    </>
  );
}

export default function Card() {
  return (
    <Canvas
      width={1200}
      height={630}
      fonts={fonts}
      style={{
        backgroundColor: "#4f46e5",
        color: "#ffffff",
        fontFamily: "Inter",
      }}
    >
      <Row style={{ height: 630 }}>
        <Column
          style={{
            height: 630,
            padding: 64,
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontSize: 32, fontWeight: 700 }}>Orbit</Text>
          <Heading level={1} style={{ fontSize: 80, lineHeight: 1.05 }}>
            Release notes that write themselves
          </Heading>
          <Text style={{ fontSize: 28, fontWeight: 700, color: SUN }}>
            Out now at orbit.example
          </Text>
        </Column>
        <Svg width={2 * T} height={3 * T} style={{ flex: "none" }}>
          {tiles.map((tile, at) => (
            <Tile key={tile.join()} at={at} />
          ))}
        </Svg>
      </Row>
    </Canvas>
  );
}
