/**
 * A sensor-board datasheet. The pad drawing, pin table, application schematic and mechanical outline
 * share one pin list. The typical-performance charts and I²C pull-ups are calculated from the part's data.
 */
import type { ReactElement, ReactNode } from "react";
import { Circle, Column, Document, Grid, Heading, Image, Layer, Line, Link, List, ListItem, PageFooter, PageHeader, PageNumber, Path, Polygon, Rect, Row, Span, Svg, Table, TableCell, TableRow, Text, prop, token, type FieldInputs, type FieldValues } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/oyen";

export const meta = { author: "adityasarade" };

const PIN_TYPES = ["Power", "Ground", "I/O", "Input", "Output"] as const;

const DEFAULT_CHARACTERISTICS_NOTE = "Limits are guaranteed by design and characterisation.";

/** A line of a limits table: min, typ and max are text, so "±0.2", "−0.3" and "V_DD + 0.3" all fit. */
const limit = (label: string) => prop.text({ label, maxLength: 8 });
const symbol = prop.text({ label: "Symbol", maxLength: 10, pattern: "^[A-Za-zΔ]{1,4}(_[A-Za-z0-9;]{1,7})?$", guidance: "A subscript follows an underscore: V_IN, t_SU;DAT." });

const releaseMonth = (label: string) =>
  prop.choice(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], {
    label,
    guidance: "Use a month name, or leave it blank. Omit the day and year.",
  });

const fields = {
  part: prop.text({ label: "Part number", required: true, maxLength: 8, pattern: "^[A-Z]{1,4}-[0-9]{1,3}[A-Z]?$", guidance: "As it's printed on the board: WR-2, WR-4." }),
  name: prop.text({ label: "Name", required: true, maxLength: 26, guidance: "What it is, in two or three words: Environmental sensor." }),
  revision: prop.text({ label: "Revision", required: true, pattern: "^[A-Z]$", guidance: "One capital letter. Match the first entry in the revision history." }),
  date: releaseMonth("Release month"),
  summary: prop.text({ label: "Summary", required: true, maxLength: 96, guidance: "One sentence under the name: what it measures, how big it is, how it talks." }),
  highlights: prop.list(
    prop.object(
      {
        value: prop.text({ label: "Value", required: true, maxLength: 10 }),
        label: prop.text({ label: "Label", required: true, maxLength: 28 }),
      },
      { label: "Highlight" },
    ),
    { label: "Highlights", required: true, min: 2, max: 4, guidance: "The figures a buyer compares first, each with what it's of: ±0.2 °C, Temperature, 0 to 65 °C." },
  ),
  features: prop.list(prop.text({ label: "Feature", maxLength: 70 }), { label: "Features", required: true, min: 3, max: 6 }),
  applications: prop.list(prop.text({ label: "Application", maxLength: 36 }), { label: "Applications", required: true, min: 2, max: 5 }),
  description: prop.text({ label: "Description", required: true, maxLength: 300, guidance: "Two or three sentences: what it measures, what it runs from, what makes it different." }),
  board: prop.object(
    {
      width: prop.number({ label: "Width, mm", required: true, min: 10, max: 40 }),
      height: prop.number({ label: "Height, mm", required: true, min: 8, max: 34 }),
      thickness: prop.number({ label: "Thickness, mm", required: true, min: 0.4, max: 3.2 }),
      parts: prop.number({ label: "Tallest part above the board, mm", required: true, min: 0, max: 4 }),
      hole: prop.number({ label: "Mounting hole diameter, mm", required: true, min: 0, max: 3.5, guidance: "0 for no holes." }),
      edges: prop.choice(["one", "two"], { label: "Pads along", required: true, guidance: "one: every pad down the left edge. two: the first half down the left, the rest back up the right." }),
    },
    { label: "Board", required: true, guidance: "The pads are on a 2.54 mm pitch: the edge they're on must be at least 2.54 mm per pad long." },
  ),
  pins: prop.list(
    prop.object(
      {
        name: prop.text({ label: "Name", required: true, pattern: "^[A-Z0-9][A-Z0-9_+/-]{0,5}$", guidance: "As on the silkscreen, up to six capitals: VIN, SDA, INT1." }),
        type: prop.choice(PIN_TYPES, { label: "Type", required: true, guidance: "Power pins join the supply in the schematic, ground pins go to ground, and the rest wire to the host." }),
        description: prop.text({ label: "Description", required: true, maxLength: 72 }),
        pullUp: prop.boolean({ label: "Needs a pull-up", guidance: "The schematic draws a resistor to 3.3 V using the I²C pull-up resistance." }),
      },
      { label: "Pin" },
    ),
    { label: "Pins", required: true, min: 2, max: 12, guidance: "In order, pin 1 first. The board drawing, the pin table and the schematic are all drawn from this list. Where the pads are too close for their callouts, the callouts fan out." },
  ),
  ratings: prop.list(
    prop.object(
      { parameter: prop.text({ label: "Parameter", required: true, maxLength: 44 }), symbol, min: limit("Min"), max: limit("Max"), unit: prop.text({ label: "Unit", required: true, maxLength: 5 }) },
      { label: "Rating" },
    ),
    { label: "Absolute maximum ratings", required: true, min: 1, max: 6 },
  ),
  characteristics: prop.list(
    prop.object(
      {
        group: prop.text({ label: "Group", maxLength: 14, guidance: "Rows of the same group in a row share its name: Temperature, Supply." }),
        parameter: prop.text({ label: "Parameter", required: true, maxLength: 28 }),
        symbol,
        conditions: prop.text({ label: "Conditions", maxLength: 26 }),
        min: limit("Min"),
        typ: limit("Typ"),
        max: limit("Max"),
        unit: prop.text({ label: "Unit", maxLength: 5 }),
      },
      { label: "Characteristic" },
    ),
    { label: "Electrical characteristics", required: true, min: 1, max: 14 },
  ),
  characteristicsNote: prop.text({ label: "Electrical characteristics table note", default: DEFAULT_CHARACTERISTICS_NOTE, maxLength: 100 }),
  curves: prop.list(
    prop.object(
      {
        title: prop.text({ label: "Title", required: true, maxLength: 34 }),
        x: prop.text({ label: "x axis", required: true, maxLength: 28, guidance: "What and its unit: Temperature, °C." }),
        y: prop.text({ label: "y axis", required: true, maxLength: 18, guidance: "What and its unit: Error, °C." }),
        points: prop.list(
          prop.object(
            {
              x: prop.number({ label: "x", required: true }),
              typ: prop.number({ label: "Typical error", required: true }),
              limit: prop.number({ label: "Limit, ±", required: true, min: 0 }),
            },
            { label: "Point" },
          ),
          { label: "Points", required: true, min: 3, max: 16, guidance: "Measured points with unique x-values, in any order. Give at least one nonzero typical error or limit." },
        ),
      },
      { label: "Curve" },
    ),
    { label: "Typical performance", required: true, min: 1, max: 2 },
  ),
  i2c: prop.object(
    {
      mode: prop.choice(["Standard", "Fast", "Fast-mode Plus"], { label: "Fastest I²C mode", required: true, guidance: "Sets the timing table: the I²C specification's limits for that mode." }),
      pullUpOhms: prop.number({ label: "Pull-up resistance, Ω", integer: true, min: 100, max: 99999, guidance: "Used in the schematic and rise-time calculation. Defaults to 1 kΩ for Fast-mode Plus and 2.2 kΩ otherwise." }),
      busCapacitancePf: prop.number({ label: "Bus capacitance per line, pF", integer: true, min: 1, max: 550, default: 100, guidance: "Maximum total capacitive load per SDA or SCL line for this example." }),
      notes: prop.list(prop.text({ label: "Note", maxLength: 170 }), { label: "Notes", required: true, min: 1, max: 3, guidance: "The address and any other interface details. Pull-up sizing is calculated separately." }),
    },
    { label: "I²C interface", required: true },
  ),
  application: prop.list(prop.text({ label: "Note", maxLength: 110 }), { label: "Application notes", required: true, min: 1, max: 3 }),
  ordering: prop.list(
    prop.object(
      {
        part: prop.text({ label: "Part number", required: true, maxLength: 14, pattern: "^[A-Z0-9-]+$" }),
        description: prop.text({ label: "Description", required: true, maxLength: 64 }),
        pack: prop.text({ label: "Pack", required: true, maxLength: 16 }),
      },
      { label: "Ordering line" },
    ),
    { label: "Ordering", required: true, min: 1, max: 5 },
  ),
  revisions: prop.list(
    prop.object(
      {
        rev: prop.text({ label: "Revision", required: true, pattern: "^[A-Z]$" }),
        date: releaseMonth("Month"),
        changes: prop.text({ label: "Changes", required: true, maxLength: 96 }),
      },
      { label: "Revision" },
    ),
    { label: "Revision history", required: true, min: 1, max: 5, guidance: "Newest revision letter first. A release month is optional." },
  ),
};

type Datasheet = FieldValues<typeof fields>;
type Board = Datasheet["board"];
type Pin = Datasheet["pins"][number];
type Rating = Datasheet["ratings"][number];
type Characteristic = Datasheet["characteristics"][number];
type Curve = Datasheet["curves"][number];
type I2c = Datasheet["i2c"];
type I2cMode = I2c["mode"];

export const wr2 = {
  part: "WR-2",
  name: "Environmental sensor",
  revision: "C",
  date: "March",
  summary: "Temperature, humidity, pressure and air quality on a 25 × 18 mm board, read over I²C.",
  highlights: [
    { value: "±0.2 °C", label: "Temperature, 0 to 65 °C" },
    { value: "±2 %RH", label: "Humidity, 20 to 80 %RH" },
    { value: "±0.6 hPa", label: "Pressure, 300 to 1100 hPa" },
    { value: "3.4 µA", label: "Asleep, between readings" },
  ],
  features: [
    "Temperature, humidity, pressure and VOC on one board",
    "Calibrated in the factory: ±0.2 °C and ±2 %RH",
    "Runs from 3.0 to 5.5 V; logic stays at 3.3 V",
    "I²C up to 400 kHz, at either of two addresses",
    "3.4 µA asleep, 0.9 mA while measuring",
    "Castellated pads on a 2.54 mm pitch: solder it flat or fit a header",
  ],
  applications: [
    "Indoor air quality monitors",
    "Ventilation and HVAC control",
    "Weather stations",
    "Greenhouse and cold-store loggers",
    "Battery-powered sensor nodes",
  ],
  description: "WR-2 measures temperature, relative humidity, barometric pressure and volatile organic compounds, and reports all four over I²C. A low-dropout regulator lets it run from 3.0 to 5.5 V while its logic stays at 3.3 V, and it sleeps at 3.4 µA between readings.",
  board: { width: 25, height: 18, thickness: 1.6, parts: 0.9, hole: 2.2, edges: "one" },
  pins: [
    { name: "VIN", type: "Power", description: "Supply, 3.0 to 5.5 V. The on-board regulator makes 3.3 V." },
    { name: "GND", type: "Ground", description: "Ground." },
    { name: "SCL", type: "Input", description: "I²C clock. Pull up to 3.3 V on the host.", pullUp: true },
    { name: "SDA", type: "I/O", description: "I²C data, open drain. Pull up to 3.3 V on the host.", pullUp: true },
    { name: "INT", type: "Output", description: "Data ready, active low, open drain.", pullUp: true },
    { name: "ADDR", type: "Input", description: "I²C address: low for 0x76, high for 0x77. Pulled low on the board." },
  ],
  ratings: [
    { parameter: "Supply voltage", symbol: "V_IN", min: "−0.3", max: "6.0", unit: "V" },
    { parameter: "Voltage on SCL, SDA, INT and ADDR", symbol: "V_IO", min: "−0.3", max: "3.6", unit: "V" },
    { parameter: "Operating temperature", symbol: "T_A", min: "−40", max: "85", unit: "°C" },
    { parameter: "Storage temperature", symbol: "T_STG", min: "−45", max: "125", unit: "°C" },
    { parameter: "Soldering temperature, 10 s", symbol: "T_SOL", max: "260", unit: "°C" },
    { parameter: "Electrostatic discharge, human body model", symbol: "V_ESD", max: "±2", unit: "kV" },
  ],
  characteristics: [
    { group: "Temperature", parameter: "Accuracy", symbol: "ΔT", conditions: "0 to 65 °C", typ: "±0.2", max: "±0.4", unit: "°C" },
    { group: "Temperature", parameter: "Accuracy", symbol: "ΔT", conditions: "−40 to 85 °C", typ: "±0.5", max: "±1.0", unit: "°C" },
    { group: "Temperature", parameter: "Resolution", typ: "0.01", unit: "°C" },
    { group: "Humidity", parameter: "Accuracy", symbol: "ΔRH", conditions: "20 to 80 %RH", typ: "±2", max: "±3", unit: "%RH" },
    { group: "Humidity", parameter: "Response time, to 63 %", symbol: "t_63", conditions: "Air at 1 m/s", typ: "8", unit: "s" },
    { group: "Pressure", parameter: "Range", symbol: "P", min: "300", max: "1100", unit: "hPa" },
    { group: "Pressure", parameter: "Accuracy", symbol: "ΔP", conditions: "0 to 65 °C", typ: "±0.6", max: "±1.0", unit: "hPa" },
    { group: "Air quality", parameter: "VOC index", min: "1", max: "500", unit: "–" },
    { group: "Supply", parameter: "Supply voltage", symbol: "V_IN", min: "3.0", typ: "3.3", max: "5.5", unit: "V" },
    { group: "Supply", parameter: "Current, asleep", symbol: "I_SLP", typ: "3.4", max: "6.0", unit: "µA" },
    { group: "Supply", parameter: "Current, measuring", symbol: "I_DD", conditions: "T, RH and P at 1 Hz", typ: "0.9", max: "1.2", unit: "mA" },
    { group: "Supply", parameter: "Current, gas heater on", symbol: "I_HT", conditions: "320 °C for 150 ms", typ: "12", max: "15", unit: "mA" },
    { group: "Interface", parameter: "I²C clock", symbol: "f_SCL", max: "400", unit: "kHz" },
    { group: "Interface", parameter: "Start-up time", symbol: "t_ST", conditions: "Power on to first reading", typ: "2", max: "5", unit: "ms" },
  ],
  characteristicsNote: "Limits are guaranteed by design and characterisation.",
  curves: [
    {
      title: "Temperature error",
      x: "Temperature, °C",
      y: "Error, °C",
      points: [
        { x: -40, typ: 0.24, limit: 0.5 },
        { x: -20, typ: 0.13, limit: 0.4 },
        { x: 0, typ: 0.05, limit: 0.25 },
        { x: 10, typ: 0.02, limit: 0.2 },
        { x: 25, typ: 0, limit: 0.2 },
        { x: 40, typ: -0.03, limit: 0.2 },
        { x: 55, typ: -0.04, limit: 0.2 },
        { x: 65, typ: -0.02, limit: 0.25 },
        { x: 85, typ: 0.12, limit: 0.45 },
      ],
    },
    {
      title: "Humidity error at 25 °C",
      x: "Relative humidity, %RH",
      y: "Error, %RH",
      points: [
        { x: 0, typ: 1.2, limit: 3.5 },
        { x: 10, typ: 0.8, limit: 3 },
        { x: 20, typ: 0.4, limit: 2 },
        { x: 40, typ: 0.1, limit: 2 },
        { x: 60, typ: -0.3, limit: 2 },
        { x: 80, typ: -0.6, limit: 2 },
        { x: 90, typ: -1, limit: 2.6 },
        { x: 100, typ: -1.6, limit: 3.5 },
      ],
    },
  ],
  i2c: {
    mode: "Fast",
    pullUpOhms: 2200,
    busCapacitancePf: 100,
    notes: [
      "WR-2 is an I²C target. It answers at 0x76 with ADDR low, as shipped, and at 0x77 with ADDR high, so two boards can share a bus.",
      "INT is open drain and needs a pull-up if used.",
    ],
  },
  application: [
    "Put C1 within 5 mm of VIN, between VIN and GND.",
    "Keep the board away from regulators, LEDs and anything else that warms the air it measures.",
  ],
  ordering: [
    { part: "WR-2-C", description: "WR-2, revision C, castellated pads", pack: "Tray of 50" },
    { part: "WR-2-C-H", description: "WR-2 with a 6-way 2.54 mm header fitted", pack: "Bag of 10" },
    { part: "WR-2-C-T", description: "WR-2 on tape and reel, for pick and place", pack: "Reel of 500" },
  ],
  revisions: [
    { rev: "C", date: "March", changes: "New regulator: asleep, 3.4 µA (was 9 µA). Mounting holes now 2.2 mm." },
    { rev: "B", date: "September", changes: "ADDR pin added, so two boards can share a bus." },
    { rev: "A", date: "February", changes: "First release." },
  ],
} satisfies FieldInputs<typeof fields>;

export function datasheet(brand: Brand) {
  const { background: BACKGROUND, foreground: FOREGROUND, primary: PRIMARY, border: BORDER, muted: MUTED, surface: SURFACE } =
    brand.theme.colors as Record<"background" | "foreground" | "primary" | "border" | "muted" | "surface", string>;
  const { body: BODY_FONT, heading: HEADING_FONT } = brand.theme.fonts as Record<"body" | "heading", string>;
  const { small, body } = brand.theme.fontSizes as Record<"small" | "body", number>;
  const { body: bodyLeading, heading: headingLeading } = brand.theme.lineHeights as Record<"body" | "heading", number>;
  const spacing = brand.theme.spacing as Record<"xs" | "sm" | "md" | "lg", number>;
  // Use the brand's spacing scale at print density. Table padding is intentionally tighter than section gaps.
  const xs = spacing.xs * 0.6;
  const sm = spacing.sm * 0.7;
  const md = spacing.md * 0.8;
  const cellPadding = spacing.xs / 2;
  const headings = brand.theme.elements?.Heading as { fontWeight?: number; by?: { level?: Record<number, { fontSize?: number }> } } | undefined;
  // Scale the dense print typography to the brand's sizes, preserving the distinction between labels and body copy.
  const smallPx = (size: number) => Math.round((small * size / 14) * 10) / 10;
  const bodyPx = (size: number) => Math.round((body * size / 16) * 10) / 10;
  const px = (size: number) => `${size}px` as const;
  const headingFamily = HEADING_FONT.split(",")[0].trim().replace(/^["']|["']$/g, "");
  const headingWeight = brand.fonts.find((font) => font.family === headingFamily && font.style === "normal")?.weight as
    | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | undefined;
  const partSize = bodyPx(72);
  const nameSize = bodyPx(27);
  const sectionSize = (headings?.by?.level?.[3]?.fontSize ?? body) * 0.76;
  const sectionLine = Math.max(sectionSize * headingLeading, smallPx(17));
  const labelLine = smallPx(8) * bodyLeading;
  const textLeading = bodyLeading * 0.91;
  const LINE_H = smallPx(11) * textLeading;
  const headerLine = smallPx(16);
  const footerSize = smallPx(9);
  const footerLine = smallPx(13);
  const noteLine = smallPx(14.5);
  const titleBlockLine = smallPx(13);
  const logoHeight = smallPx(25);
  const logoWidth = Math.min(128, logoHeight * brand.logo.width / brand.logo.height);
  const headerHeight = Math.max(logoHeight, headerLine) + sm + 1;
  const footerHeight = footerLine + sm + 1;
  const hairline = (color = BORDER) => `1px solid ${color}` as const;
  const label = { fontFamily: BODY_FONT, fontSize: smallPx(8), fontWeight: 700, lineHeight: px(labelLine), letterSpacing: xs * 0.18, textTransform: "uppercase", color: MUTED } as const;
  // A4 inside its print margins. Dimensions of the engineered drawings are in px, at 96 px per inch.
  const PAGE_WIDTH = 794;
  const PAGE_HEIGHT = 1122;
  const MARGIN_TOP = 36;
  const MARGIN_BOTTOM = 30;
  const SIDE = 48;
  const GAP = spacing.lg * 0.85;
  const MM = 96 / 25.4;

  const UNITS = "mV|mA|µA|nA|V|mW|µW|W|°C|°/s|%RH|%|hPa|kPa|Pa|kHz|MHz|Hz|ms|µs|ns|s|mm|kΩ|MΩ|Ω|nF|µF|pF|kV|ppm|bar|mg|µg|g";
  /** Keeps a number with its unit, and both sides of a ×, on one line: "3.4 µA", "25 × 18 mm". */
  const nb = (text: string) => text.replace(new RegExp(`(\\d) (?=(?:${UNITS})(?![\\w]))`, "gu"), "$1\u00A0").replace(/ × /g, "\u00A0×\u00A0");

  /** A symbol written "V_IN": V, with IN as a subscript. */
  const sym = (s: string | undefined, size = smallPx(11)) => {
    if (!s) return "";
    const [base, sub] = s.split(/_(.+)/);
    return sub ? (
      <>
        {base}
        <Span style={{ fontSize: Math.round(size * 0.72 * 10) / 10, verticalAlign: "sub" }}>{sub}</Span>
      </>
    ) : (
      base
    );
  };

  // Drawing: a pen for Svg shapes, and labels laid over them

  type Paint = { fill?: string; stroke?: string; strokeWidth?: number; opacity?: number };
  type Pt = [number, number];
  const r2 = (n: number) => Math.round(n * 100) / 100;

  /** Collects an Svg's shapes, each keyed, its coordinates rounded to a hundredth of a px. */
  class Pen {
    shapes: ReactElement[] = [];
    line(x1: number, y1: number, x2: number, y2: number, stroke = FOREGROUND, strokeWidth = 1, opacity?: number) {
      const k = this.shapes.length;
      this.shapes.push(<Line key={k} x1={r2(x1)} y1={r2(y1)} x2={r2(x2)} y2={r2(y2)} style={{ stroke, strokeWidth, ...(opacity === undefined ? {} : { opacity }) }} />);
    }
    rect(x: number, y: number, width: number, height: number, paint: Paint, rx?: number) {
      const k = this.shapes.length;
      this.shapes.push(<Rect key={k} x={r2(x)} y={r2(y)} width={r2(width)} height={r2(height)} {...(rx ? { rx: r2(rx) } : {})} style={paint} />);
    }
    circle(cx: number, cy: number, r: number, paint: Paint) {
      const k = this.shapes.length;
      this.shapes.push(<Circle key={k} cx={r2(cx)} cy={r2(cy)} r={r2(r)} style={paint} />);
    }
    poly(points: Pt[], paint: Paint) {
      const k = this.shapes.length;
      this.shapes.push(<Polygon key={k} points={points.map(([x, y]) => `${r2(x)},${r2(y)}`).join(" ")} style={paint} />);
    }
    /** An open polyline, stroked. */
    polyline(points: Pt[], stroke = FOREGROUND, strokeWidth = 1, opacity?: number) {
      this.path(points.map(([x, y], i) => `${i ? "L" : "M"}${r2(x)} ${r2(y)}`).join(" "), { stroke, strokeWidth, ...(opacity === undefined ? {} : { opacity }) });
    }
    path(d: string, paint: Paint) {
      const k = this.shapes.length;
      this.shapes.push(<Path key={k} d={d} style={{ fill: "transparent", ...paint }} />);
    }
    /** A dashed line, as short strokes along it. */
    dash(x1: number, y1: number, x2: number, y2: number, stroke = FOREGROUND, strokeWidth = 0.75, on = 3, off = 2.5) {
      const length = Math.hypot(x2 - x1, y2 - y1);
      const [ux, uy] = [(x2 - x1) / length, (y2 - y1) / length];
      let d = "";
      for (let t = 0; t < length; t += on + off) {
        const e = Math.min(length, t + on);
        d += `M${r2(x1 + ux * t)} ${r2(y1 + uy * t)}L${r2(x1 + ux * e)} ${r2(y1 + uy * e)}`;
      }
      this.path(d, { stroke, strokeWidth });
    }
    /** An arrowhead whose tip is at x, y, pointing along dx, dy. */
    arrow(x: number, y: number, dx: number, dy: number, color = FOREGROUND, length = 5, half = 1.6) {
      const n = Math.hypot(dx, dy);
      const [ux, uy] = [dx / n, dy / n];
      this.poly(
        [
          [x, y],
          [x - ux * length - uy * half, y - uy * length + ux * half],
          [x - ux * length + uy * half, y - uy * length - ux * half],
        ],
        { fill: color },
      );
    }
  }

  /** A label laid over a drawing: centred on y, and on x by its alignment. */
  type Tag = { x: number; y: number; text: ReactNode; align?: "left" | "right" | "center"; w?: number; size?: number; font?: string; color?: string; weight?: 400 | 700; caps?: boolean; tracking?: number };

  const tag = (t: Tag, key: number, width: number) => {
    const size = t.size ?? smallPx(8);
    const height = Math.round(size * 12) / 10;
    const w = Math.min(width, t.w ?? 80);
    const align = t.align ?? "left";
    const left = Math.max(0, Math.min(width - w, align === "right" ? t.x - w : align === "center" ? t.x - w / 2 : t.x));
    return (
      <Column key={key} style={{ padding: [Math.max(0, r2(t.y - height / 2)), 0, 0, r2(left)] }}>
        <Text
          style={{
            width: w,
            textAlign: align,
            fontFamily: t.font ?? BODY_FONT,
            fontSize: size,
            lineHeight: `${height}px`,
            fontWeight: t.weight ?? 400,
            color: t.color ?? FOREGROUND,
            letterSpacing: t.tracking ?? 0,
            textTransform: t.caps ? "uppercase" : "none",
          }}
        >
          {t.text}
        </Text>
      </Column>
    );
  };

  /** An Svg with labels over it: the shapes from a Pen, the words as text. */
  const Drawing = ({ width, height, title, pen, tags }: { width: number; height: number; title: string; pen: Pen; tags: Tag[] }) => (
    <Layer style={{ width }}>
      <Svg width={width} height={height} title={title}>
        {pen.shapes}
      </Svg>
      {tags.map((t, i) => tag(t, i, width))}
    </Layer>
  );

  /** A dimension along x: a line between x1 and x2 at y, arrows at its ends, its value above it. */
  function dimX(pen: Pen, tags: Tag[], x1: number, x2: number, y: number, value: string) {
    const span = x2 - x1;
    if (span >= 14) {
      pen.line(x1, y, x2, y, FOREGROUND, 0.6);
      pen.arrow(x1, y, -1, 0);
      pen.arrow(x2, y, 1, 0);
    } else {
      pen.line(x1 - 9, y, x2 + 9, y, FOREGROUND, 0.6);
      pen.arrow(x1, y, 1, 0);
      pen.arrow(x2, y, -1, 0);
    }
    tags.push({ x: (x1 + x2) / 2, y: y - 6.5, text: value, align: "center", w: 48, size: smallPx(8) });
  }

  /** A dimension along y, its value written level: in a gap in the line, or beside it where the span is short. */
  function dimY(pen: Pen, tags: Tag[], y1: number, y2: number, x: number, value: string, beside?: "left" | "right") {
    const span = y2 - y1;
    const text = 11;
    if (!beside && span >= 34) {
      const mid = (y1 + y2) / 2;
      pen.line(x, y1, x, mid - text / 2 - 2, FOREGROUND, 0.6);
      pen.line(x, mid + text / 2 + 2, x, y2, FOREGROUND, 0.6);
      tags.push({ x, y: mid, text: value, align: "center", w: 40, size: smallPx(8) });
    } else {
      if (span >= 14) pen.line(x, y1, x, y2, FOREGROUND, 0.6);
      else pen.line(x, y1 - 9, x, y2 + 9, FOREGROUND, 0.6);
      const side = beside ?? "left";
      tags.push({ x: side === "left" ? x - 4 : x + 4, y: (y1 + y2) / 2, text: value, align: side === "left" ? "right" : "left", w: value.length * 5 + 4, size: smallPx(8) });
    }
    if (span >= 14) {
      pen.arrow(x, y1, 0, -1);
      pen.arrow(x, y2, 0, 1);
    } else {
      pen.arrow(x, y1, 0, 1);
      pen.arrow(x, y2, 0, -1);
    }
  }

  // The board: where its pads, holes and parts are, in mm

  const PITCH = 2.54;
  /** A castellated pad: its length along the edge and its depth into the board, and the half-hole at the edge. */
  const PAD_LONG = 1.7;
  const PAD_DEEP = 1.5;
  const HALF_HOLE = 0.5;

  type PadAt = { n: number; side: "left" | "right"; y: number };

  /** The pads: down the left edge from pin 1, and on a board with pads on two edges, back up the right. */
  function padsOf(board: Board, count: number): PadAt[] {
    const left = board.edges === "two" ? Math.ceil(count / 2) : count;
    const right = count - left;
    const at = (k: number, i: number) => board.height / 2 + (i - (k - 1) / 2) * PITCH;
    return Array.from({ length: count }, (_, i) =>
      i < left ? { n: i + 1, side: "left" as const, y: at(left, i) } : { n: i + 1, side: "right" as const, y: at(right, count - 1 - i) },
    );
  }

  /** The mounting holes' centres: at the corners clear of the pads, or top and bottom centre. */
  function holesOf(board: Board, pads: PadAt[]): Pt[] {
    if (!board.hole) return [];
    const c = Math.max(2.5, board.hole / 2 + 1.4);
    const { width: W, height: H } = board;
    if (board.edges !== "two") return [[W - c, c], [W - c, H - c]];
    const top = Math.min(...pads.map((p) => p.y)) - PAD_LONG / 2;
    if (top - (c + board.hole / 2) >= 0.6) return [[c, c], [W - c, c], [c, H - c], [W - c, H - c]];
    return [[W / 2, c], [W / 2, H - c]];
  }

  type Box = [number, number, number, number];
  const clear = (a: Box, b: Box, gap = 0.3) => a[2] + gap <= b[0] || b[2] + gap <= a[0] || a[3] + gap <= b[1] || b[3] + gap <= a[1];
  const around = ([x, y]: Pt, w: number, h: number): Box => [x - w / 2, y - h / 2, x + w / 2, y + h / 2];

  /**
   * The parts on the board: the sensor, its regulator and their capacitors. Each goes where the
   * family's layout puts it, and only if it fits there: inside the board, clear of the pads, their traces, the holes
   * and the parts before it. A small board shows fewer parts rather than parts on top of each other.
   */
  function partsOf(board: Board, pads: PadAt[], holes: Pt[]) {
    const { width: W, height: H } = board;
    const two = board.edges === "two";
    const taken: Box[] = [];
    if (pads.some((p) => p.side === "left")) taken.push([0, 0, PAD_DEEP + 1.7, H]);
    if (pads.some((p) => p.side === "right")) taken.push([W - PAD_DEEP - 1.7, 0, W, H]);
    for (const h of holes) taken.push(around(h, board.hole + 2.3, board.hole + 2.3));
    const place = (at: Pt, w: number, h: number): Pt | undefined => {
      const box = around(at, w, h);
      if (box[0] < 0.5 || box[1] < 0.5 || box[2] > W - 0.5 || box[3] > H - 0.5 || !taken.every((t) => clear(box, t))) return undefined;
      taken.push(box);
      return at;
    };
    const x0 = PAD_DEEP + 1.2;
    const x1 = two ? W - x0 : holes.length ? Math.min(...holes.map((h) => h[0])) - board.hole / 2 - 0.8 : W - 1.2;
    const sensor = place(two ? [W / 2, H / 2] : [x0 + (x1 - x0) * 0.52, H / 2], 4.2, 4.2);
    // The traces run from the pads to the sensor's sides: keep the other parts out of their way.
    const top = Math.min(...pads.map((p) => p.y)) - PAD_LONG / 2;
    const bottom = Math.max(...pads.map((p) => p.y)) + PAD_LONG / 2;
    if (sensor) {
      taken.push([0, top, sensor[0] - 1.3, bottom]);
      if (two) taken.push([sensor[0] + 1.3, top, W, bottom]);
    }
    const ry = two ? Math.max(2, Math.min(H * 0.2, top - 1.8)) : Math.max(2.6, H * 0.26);
    const regulator = place(two ? [W / 2, ry] : [Math.min(x1 - 1.6, (sensor?.[0] ?? W / 2) + 4.6), ry], 2.9, 2.8);
    const caps: Pt[] = [];
    if (regulator) {
      const spots: Pt[] = two ? [[W / 2 - 2.7, ry], [W / 2 + 2.7, ry]] : [[regulator[0] - 0.95, ry + 2.9], [regulator[0] + 0.95, ry + 2.9]];
      for (const spot of spots) {
        const at = place(spot, two ? 1.6 : 0.8, two ? 0.8 : 1.6);
        if (at) caps.push(at);
      }
    }
    const decouple = sensor ? place(two ? [W / 2, H / 2 + 3] : [sensor[0], sensor[1] - 3], 1.6, 0.8) : undefined;
    return { sensor, regulator, caps, capsVertical: !two, decouple };
  }

  /** The board seen from above, drawn into a Pen at `s` px to the mm with its top left corner at ox, oy. */
  function drawBoard(pen: Pen, board: Board, pins: Pin[], ox: number, oy: number, s: number, detail: boolean) {
    const { width: W, height: H } = board;
    const X = (mm: number) => ox + mm * s;
    const Y = (mm: number) => oy + mm * s;
    const pads = padsOf(board, pins.length);
    const holes = holesOf(board, pads);
    pen.rect(X(0), Y(0), W * s, H * s, { fill: SURFACE, stroke: FOREGROUND, strokeWidth: 1.1 }, 0.8 * s);
    const parts = partsOf(board, pads, holes);

    if (detail && parts.sensor) {
      const [sx, sy] = parts.sensor;
      // Traces: each signal pad's runs in, turns at 45 degrees and lands under the sensor; power and ground drop to a via.
      for (const side of ["left", "right"] as const) {
        const here = pads.filter((p) => p.side === side);
        const signals = here.filter((p) => !["Power", "Ground"].includes(pins[p.n - 1].type));
        const dir = side === "left" ? 1 : -1;
        const edge = side === "left" ? 0 : W;
        const pitch = Math.min(0.75, 2.4 / Math.max(1, signals.length - 1));
        const land = sx - dir * 1.3;
        signals.forEach((p, k) => {
          const ty = sy + (k - (signals.length - 1) / 2) * pitch;
          const run = Math.abs(ty - p.y);
          const knee = land - dir * (0.7 + run);
          const bend = dir > 0 ? Math.max(PAD_DEEP + 0.5, knee) : Math.min(W - PAD_DEEP - 0.5, knee);
          pen.polyline([[X(edge + dir * (PAD_DEEP - 0.3)), Y(p.y)], [X(bend), Y(p.y)], [X(land - dir * 0.7), Y(ty)], [X(land), Y(ty)]], BORDER, 0.34 * s);
        });
        for (const p of here.filter((q) => !signals.includes(q))) {
          const vx = edge + dir * (PAD_DEEP + 1.15);
          pen.line(X(edge + dir * (PAD_DEEP - 0.3)), Y(p.y), X(vx), Y(p.y), BORDER, 0.34 * s);
          pen.circle(X(vx), Y(p.y), 0.42 * s, { fill: MUTED });
          pen.circle(X(vx), Y(p.y), 0.17 * s, { fill: FOREGROUND });
        }
      }
    }

    for (const p of pads) {
      const x = p.side === "left" ? X(0) : X(W - PAD_DEEP);
      pen.rect(x, Y(p.y - PAD_LONG / 2), PAD_DEEP * s, PAD_LONG * s, { fill: PRIMARY }, p.n === 1 ? 0 : 0.25 * s);
      pen.circle(p.side === "left" ? X(0) : X(W), Y(p.y), HALF_HOLE * s, { fill: BACKGROUND, stroke: FOREGROUND, strokeWidth: 0.6 });
    }
    for (const [hx, hy] of holes) {
      pen.circle(X(hx), Y(hy), (board.hole / 2 + 0.55) * s, { fill: MUTED, opacity: 0.55 });
      pen.circle(X(hx), Y(hy), (board.hole / 2) * s, { fill: BACKGROUND, stroke: FOREGROUND, strokeWidth: 0.8 });
    }
    if (!detail) return { pads, holes };

    // Pin 1: a triangle on the silkscreen, over its pad and pointing at it.
    const first = pads[0];
    const fx = first.side === "left" ? PAD_DEEP / 2 : W - PAD_DEEP / 2;
    const tip = Math.max(0.95, first.y - PAD_LONG / 2 - 0.3);
    pen.poly([[X(fx), Y(tip)], [X(fx - 0.45), Y(tip - 0.7)], [X(fx + 0.45), Y(tip - 0.7)]], { fill: FOREGROUND });

    // The sensor: a 3 mm LGA package with its vent and its pin 1 dot, inside its courtyard.
    if (parts.sensor) {
      const [sx, sy] = parts.sensor;
      pen.rect(X(sx - 2.1), Y(sy - 2.1), 4.2 * s, 4.2 * s, { fill: "transparent", stroke: FOREGROUND, strokeWidth: 0.6 }, 0.2 * s);
      pen.rect(X(sx - 1.5), Y(sy - 1.5), 3 * s, 3 * s, { fill: FOREGROUND }, 0.2 * s);
      pen.circle(X(sx + 0.65), Y(sy - 0.65), 0.38 * s, { fill: BACKGROUND });
      pen.circle(X(sx - 1.1), Y(sy + 1.1), 0.14 * s, { fill: BACKGROUND });
      pen.circle(X(sx - 1.85), Y(sy - 1.85), 0.12 * s, { fill: FOREGROUND });
    }
    // The regulator: SOT-23-5, three leads below and two above.
    if (parts.regulator) {
      const [rx, ry] = parts.regulator;
      for (const dx of [-0.95, 0, 0.95]) pen.rect(X(rx + dx - 0.2), Y(ry + 0.8), 0.4 * s, 0.6 * s, { fill: MUTED });
      for (const dx of [-0.95, 0.95]) pen.rect(X(rx + dx - 0.2), Y(ry - 1.4), 0.4 * s, 0.6 * s, { fill: MUTED });
      pen.rect(X(rx - 1.45), Y(ry - 0.8), 2.9 * s, 1.6 * s, { fill: FOREGROUND }, 0.1 * s);
    }
    // Passives: 0603 capacitors by the regulator, one by the sensor.
    const passive = (cx: number, cy: number, vertical: boolean) => {
      const [w, h] = vertical ? [0.8, 1.6] : [1.6, 0.8];
      pen.rect(X(cx - w / 2), Y(cy - h / 2), w * s, h * s, { fill: BORDER }, 0.08 * s);
      const cap = 0.3;
      if (vertical) {
        pen.rect(X(cx - w / 2), Y(cy - h / 2), w * s, cap * s, { fill: MUTED });
        pen.rect(X(cx - w / 2), Y(cy + h / 2 - cap), w * s, cap * s, { fill: MUTED });
      } else {
        pen.rect(X(cx - w / 2), Y(cy - h / 2), cap * s, h * s, { fill: MUTED });
        pen.rect(X(cx + w / 2 - cap), Y(cy - h / 2), cap * s, h * s, { fill: MUTED });
      }
    };
    for (const [cx, cy] of parts.caps) passive(cx, cy, parts.capsVertical);
    if (parts.decouple) passive(parts.decouple[0], parts.decouple[1], false);
    return { pads, holes };
  }

  /** The drawing scales a datasheet uses, largest first: n to 1. */
  const SCALES = [5, 4, 3, 2.5, 2, 1.5, 1, 0.75, 0.5];
  const ratio = (scale: number) => (scale >= 1 ? `${scale} : 1` : `1 : ${1 / scale}`);

  // Figure 1: the board from above, every pad called out from the pin list

  function BoardFigure({ d, width }: { d: Datasheet; width: number }) {
    const { board, pins } = d;
    const pen = new Pen();
    const tags: Tag[] = [];
    const two = board.edges === "two";
    const longest = Math.max(...pins.map((p) => p.name.length));
    const nameW = Math.max(30, longest * 6.3 + 4);
    /** Name, balloon and leader: the room a side's callouts take. */
    const callout = nameW + 6 + 16 + 18;
    const room = width - callout * (two ? 2 : 1) - (two ? 0 : 14);
    const perSide = two ? Math.ceil(pins.length / 2) : pins.length;
    const calloutPitch = 21;
    const tall = 270;
    const margin = 2.5;
    const fits = (k: number) => (board.width + 2 * margin) * k * MM <= room && (board.height + 2 * margin) * k * MM <= tall;
    const scale = SCALES.find(fits) ?? SCALES[SCALES.length - 1];
    const s = scale * MM;
    const panelW = (board.width + 2 * margin) * s;
    const panelH = (board.height + 2 * margin) * s;
    const px = callout - margin * s + (two ? 0 : (room - panelW + 6 * s) / 2);
    const fieldHeight = Math.max(panelH, 18 + (perSide - 1) * calloutPitch);
    const py = (fieldHeight - panelH) / 2;
    const ox = px + margin * s;
    const oy = py + margin * s;
    const height = fieldHeight + 26;

    // The cutting mat: millimetres, every fifth darker, from the board's corner.
    for (let mm = -2; mm <= board.width + margin; mm++) {
      pen.line(ox + mm * s, py, ox + mm * s, py + panelH, BORDER, mm % 5 === 0 ? 0.9 : 0.5);
    }
    for (let mm = -2; mm <= board.height + margin; mm++) {
      pen.line(px, oy + mm * s, px + panelW, oy + mm * s, BORDER, mm % 5 === 0 ? 0.9 : 0.5);
    }

    const { pads } = drawBoard(pen, board, pins, ox, oy, s, true);

    // Callouts: a leader from each pad to a balloon with its number, and its name beyond it. Where the pads are closer
    // than a callout is tall, the callouts spread out evenly around them and the leaders bend to reach them.
    for (const side of ["left", "right"] as const) {
      const here = pads.filter((p) => p.side === side).sort((a, b) => a.y - b.y);
      here.forEach((p, i) => {
        const y = oy + p.y * s;
        const ly = fieldHeight / 2 + (i - (here.length - 1) / 2) * Math.max(PITCH * s, calloutPitch);
        const pin = pins[p.n - 1];
        const left = side === "left";
        const dir = left ? -1 : 1;
        const edge = left ? ox : ox + board.width * s;
        const balloon = left ? callout - 18 - 8 : width - callout + 18 + 8;
        const end = balloon - dir * 8;
        if (Math.abs(ly - y) < 0.5) pen.line(end, y, edge, y, FOREGROUND, 0.7);
        else pen.polyline([[edge, y], [edge + dir * 10, y], [end - dir * 10, ly], [end, ly]], FOREGROUND, 0.7);
        pen.circle(balloon, ly, 8, { fill: BACKGROUND, stroke: PRIMARY, strokeWidth: 0.9 });
        tags.push({ x: balloon, y: ly, text: String(p.n), align: "center", w: 16, size: smallPx(7.5), color: PRIMARY, weight: 700 });
        tags.push({ x: left ? balloon - 13 : balloon + 13, y: ly, text: pin.name, align: left ? "right" : "left", w: nameW, size: smallPx(9.5), weight: 700 });
      });
    }

    // A 5 mm scale bar under the mat, at its right.
    const bar = 5 * s;
    const bx = px + panelW - bar;
    const by = fieldHeight + 13;
    for (let i = 0; i < 5; i++) pen.rect(bx + i * s, by - 2, s, 4, { fill: i % 2 ? BACKGROUND : FOREGROUND, stroke: FOREGROUND, strokeWidth: 0.5 });
    tags.push({ x: bx - 6, y: by, text: `5 mm · ${ratio(scale)}`, align: "right", w: 90, size: smallPx(7.5), color: MUTED });

    return {
      scale,
      height,
      el: <Drawing width={width} height={height} title={`${d.part} from above at ${ratio(scale)}: the board, its ${pins.length} pads called out by number and name, and its mounting holes.`} pen={pen} tags={tags} />,
    };
  }

  // Charts: the typical error and its limits, drawn from the points

  const STEPS = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100];
  const tickLabel = (n: number, step: number, signed = false) => {
    if (n === 0) return "0";
    const magnitude = Math.abs(n);
    const digits = Math.min(2, String(step).split(".")[1]?.length ?? 0);
    const text = magnitude >= 1e5 ? magnitude.toExponential(1) : magnitude.toFixed(digits);
    return `${n < 0 ? "−" : signed ? "+" : ""}${text}`;
  };

  /** Check the points before drawing, then sort them by x and choose tick intervals. */
  function prepareCurve(points: Curve["points"]) {
    if (points.length < 2) return { error: ": use at least two points." };
    const seen = new Map<number, number>();
    for (const [i, point] of points.entries()) {
      for (const key of ["x", "typ", "limit"] as const) {
        if (!Number.isFinite(point[key])) return { error: `[${i}].${key}: use a finite number.` };
      }
      if (point.limit < 0) return { error: `[${i}].limit: use a non-negative limit.` };
      const first = seen.get(point.x);
      if (first !== undefined) return { error: `[${i}].x: duplicate x-value ${point.x}, already used at points[${first}].x.` };
      seen.set(point.x, i);
    }

    const pts = [...points].sort((a, b) => a.x - b.x);
    const x0 = pts[0].x;
    const x1 = pts[pts.length - 1].x;
    const span = x1 - x0;
    const reach = Math.max(...pts.map((p) => Math.max(p.limit, Math.abs(p.typ)))) * 1.12;
    if (reach === 0) return { error: ": all typical errors and limits are zero." };
    if (!Number.isFinite(span) || !Number.isFinite(reach)) return { error: ": the x or y range is too large to plot. Use a smaller unit scale." };
    const xFraction = (x: number) => (x - x0) / span;
    if (pts.slice(1).some((p, i) => xFraction(p.x) - xFraction(pts[i].x) <= Number.EPSILON)) {
      return { error: ": some x-values are too close relative to the full range to draw a curve." };
    }

    const xStep = STEPS.find((step) => span / step <= 7) ?? span / 7;
    const yStep = STEPS.find((step) => Math.ceil(reach / step) <= 3) ?? reach / 3;
    const yTicks = Math.min(3, Math.ceil(reach / yStep));
    const yMax = yTicks * yStep;
    if (!Number.isFinite(yMax)) return { error: ": the y range is too large to plot. Use a smaller unit scale." };
    return { pts, x0, x1, xFraction, xStep, yStep, yTicks, yMax };
  }

  /** A smooth line through points ordered in x that never overshoots them: monotone cubic (Fritsch and Carlson), as Béziers. */
  const smooth = (points: Pt[]) => {
    const n = points.length;
    const dx = points.slice(1).map((p, i) => p[0] - points[i][0]);
    const slope = points.slice(1).map((p, i) => (p[1] - points[i][1]) / dx[i]);
    const m = points.map((_, i) => (i === 0 ? slope[0] : i === n - 1 ? slope[n - 2] : slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2));
    for (let i = 0; i < n - 1; i++) {
      if (slope[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const [a, b] = [m[i] / slope[i], m[i + 1] / slope[i]];
      const h = Math.hypot(a, b);
      if (h > 3) {
        m[i] = (3 / h) * a * slope[i];
        m[i + 1] = (3 / h) * b * slope[i];
      }
    }
    let d = `M${r2(points[0][0])} ${r2(points[0][1])}`;
    for (let i = 0; i < n - 1; i++) {
      const [p, q] = [points[i], points[i + 1]];
      d += ` C${r2(p[0] + dx[i] / 3)} ${r2(p[1] + (m[i] * dx[i]) / 3)} ${r2(q[0] - dx[i] / 3)} ${r2(q[1] - (m[i + 1] * dx[i]) / 3)} ${r2(q[0])} ${r2(q[1])}`;
    }
    return d;
  };

  function CurveChart({ curve, width, height }: { curve: Curve; width: number; height: number }) {
    const chart = prepareCurve(curve.points);
    if (chart.error !== undefined) {
      return <Column style={{ width, height }}><Text style={{ fontSize: smallPx(9.5), color: MUTED }}>Chart unavailable for these points.</Text></Column>;
    }
    const { pts, x0, x1, xFraction, xStep, yStep, yTicks, yMax } = chart;
    const pen = new Pen();
    const tags: Tag[] = [];
    const L = 36;
    const R = width - 6;
    const T = 22;
    const B = height - 30;
    const X = (v: number) => L + xFraction(v) * (R - L);
    const Y = (v: number) => T + (0.5 - v / yMax / 2) * (B - T);

    for (let i = -yTicks; i <= yTicks; i++) {
      const v = i * yStep;
      const y = Y(v);
      pen.line(L, y, R, y, i === 0 ? FOREGROUND : BORDER, i === 0 ? 0.75 : 0.6);
      tags.push({ x: L - 6, y, text: tickLabel(v, yStep, true), align: "right", w: 34, size: smallPx(7.5), color: MUTED });
    }
    const firstTick = Math.ceil(x0 / xStep - 1e-9);
    let lastTick: number | undefined;
    for (let i = 0; i <= 7; i++) {
      const v = (firstTick + i) * xStep;
      const position = xFraction(v);
      if (v === lastTick || !Number.isFinite(position) || position < -1e-9 || position > 1 + 1e-9) continue;
      lastTick = v;
      pen.line(X(v), T, X(v), B, BORDER, 0.6);
      pen.line(X(v), B, X(v), B + 3, FOREGROUND, 0.75);
      tags.push({ x: X(v), y: B + 10, text: tickLabel(v, xStep), align: "center", w: 30, size: smallPx(7.5), color: MUTED });
    }
    pen.line(L, B, R, B, FOREGROUND, 0.75);

    // The limits: a band, its edges dashed.
    const upper = pts.map((p): Pt => [X(p.x), Y(p.limit)]);
    const lower = pts.map((p): Pt => [X(p.x), Y(-p.limit)]);
    pen.poly([...upper, ...lower.reverse()], { fill: PRIMARY, opacity: 0.1 });
    for (const edge of [upper, lower]) for (let i = 0; i < edge.length - 1; i++) pen.dash(edge[i][0], edge[i][1], edge[i + 1][0], edge[i + 1][1], PRIMARY, 0.75, 2.5, 2);
    // The typical error, through the measured points.
    const typical = pts.map((p): Pt => [X(p.x), Y(p.typ)]);
    pen.path(smooth(typical), { stroke: PRIMARY, strokeWidth: 1.6 });
    for (const [x, y] of typical) pen.circle(x, y, 2.1, { fill: BACKGROUND, stroke: PRIMARY, strokeWidth: 1 });

    // Axis titles, and the key.
    tags.push({ x: 0, y: 7, text: curve.y, align: "left", w: 140, size: smallPx(8.5), font: BODY_FONT, color: MUTED });
    tags.push({ x: R, y: B + 23, text: curve.x, align: "right", w: 160, size: smallPx(8.5), font: BODY_FONT, color: MUTED });
    pen.line(R - 126, 7, R - 112, 7, PRIMARY, 1.6);
    pen.circle(R - 119, 7, 2.1, { fill: BACKGROUND, stroke: PRIMARY, strokeWidth: 1 });
    tags.push({ x: R - 108, y: 7, text: "Typical", align: "left", w: 44, size: smallPx(8.5), font: BODY_FONT });
    pen.rect(R - 56, 3, 14, 8, { fill: PRIMARY, opacity: 0.1 });
    pen.dash(R - 56, 3, R - 42, 3, PRIMARY, 0.75, 2.5, 2);
    pen.dash(R - 56, 11, R - 42, 11, PRIMARY, 0.75, 2.5, 2);
    tags.push({ x: R - 38, y: 7, text: "Limits", align: "left", w: 38, size: smallPx(8.5), font: BODY_FONT });

    return <Drawing width={width} height={height} title={`${curve.title}: the typical error from ${x0} to ${x1}, inside limits of up to ±${Math.max(...pts.map((p) => p.limit))}.`} pen={pen} tags={tags} />;
  }

  // Figure 3: I²C timing, the waveforms drawn from their levels

  /** The I²C specification's limits (UM10204) for each mode, in the order the table lists them. */
  const I2C_TIMING: Record<I2cMode, Array<[string, string, string, string, string]>> = {
    Standard: [
      ["f_SCL", "Clock frequency", "0", "100", "kHz"],
      ["t_HD;STA", "Hold time, START", "4.0", "", "µs"],
      ["t_LOW", "Clock low", "4.7", "", "µs"],
      ["t_HIGH", "Clock high", "4.0", "", "µs"],
      ["t_SU;DAT", "Data set-up time", "250", "", "ns"],
      ["t_HD;DAT", "Data hold time", "0", "3.45", "µs"],
      ["t_SU;STO", "Set-up time, STOP", "4.0", "", "µs"],
      ["t_BUF", "Bus free, STOP to START", "4.7", "", "µs"],
    ],
    Fast: [
      ["f_SCL", "Clock frequency", "0", "400", "kHz"],
      ["t_HD;STA", "Hold time, START", "0.6", "", "µs"],
      ["t_LOW", "Clock low", "1.3", "", "µs"],
      ["t_HIGH", "Clock high", "0.6", "", "µs"],
      ["t_SU;DAT", "Data set-up time", "100", "", "ns"],
      ["t_HD;DAT", "Data hold time", "0", "0.9", "µs"],
      ["t_SU;STO", "Set-up time, STOP", "0.6", "", "µs"],
      ["t_BUF", "Bus free, STOP to START", "1.3", "", "µs"],
    ],
    "Fast-mode Plus": [
      ["f_SCL", "Clock frequency", "0", "1000", "kHz"],
      ["t_HD;STA", "Hold time, START", "0.26", "", "µs"],
      ["t_LOW", "Clock low", "0.5", "", "µs"],
      ["t_HIGH", "Clock high", "0.26", "", "µs"],
      ["t_SU;DAT", "Data set-up time", "50", "", "ns"],
      ["t_HD;DAT", "Data hold time", "0", "", "µs"],
      ["t_SU;STO", "Set-up time, STOP", "0.26", "", "µs"],
      ["t_BUF", "Bus free, STOP to START", "0.5", "", "µs"],
    ],
  };

  const I2C_RISE_LIMIT_NS: Record<I2cMode, number> = { Standard: 1000, Fast: 300, "Fast-mode Plus": 120 };

  function i2cPullUp(i2c: I2c) {
    const ohms = i2c.pullUpOhms ?? (i2c.mode === "Fast-mode Plus" ? 1000 : 2200);
    const capacitancePf = i2c.busCapacitancePf ?? 100;
    // UM10204 measures the edge from 30% to 70% of VDD. Ω × pF gives ps.
    const riseNs = 0.8473 * ohms * capacitancePf / 1000;
    return { ohms, capacitancePf, riseNs, maxRiseNs: I2C_RISE_LIMIT_NS[i2c.mode] };
  }

  /** A waveform as segments of time: high, low, or data (either), with what the data is. */
  type Level = "H" | "L" | "D";
  type Segment = [number, number, Level, string?];
  const SCL: Segment[] = [[0, 8, "H"], [8, 12, "L"], [12, 16, "H"], [16, 20, "L"], [20, 24, "H"], [24, 28, "L"], [28, 32, "H"], [32, 36, "L"], [36, 49, "H"]];
  const SDA: Segment[] = [[0, 4, "H"], [4, 9, "L"], [9, 17, "D", "D7"], [17, 25, "D", "D6"], [25, 33, "D", "ACK"], [33, 40, "L"], [40, 46, "H"], [46, 49, "L"]];
  const SPAN = 49;

  function TimingDiagram({ width }: { width: number }) {
    const pen = new Pen();
    const tags: Tag[] = [];
    const L = 40;
    const u = (width - L - 8) / SPAN;
    const X = (t: number) => L + t * u;
    const edge = 0.32 * u;
    const amp = 22;
    const sclTop = 40;
    const sdaTop = 104;

    /** One waveform: its rails, and its edges as lines between the rails of the segments either side. */
    const wave = (segments: Segment[], top: number, highlight: number[] = []) => {
      const rails = (l: Level) => (l === "H" ? [top] : l === "L" ? [top + amp] : [top, top + amp]);
      const mid = top + amp / 2;
      segments.forEach(([t0, t1, level, name], i) => {
        const a = i ? X(t0) + edge / 2 : X(t0);
        const b = i < segments.length - 1 ? X(t1) - edge / 2 : X(t1);
        if (level === "D") {
          const prev = segments[i - 1]?.[2];
          const next = segments[i + 1]?.[2];
          const left: Pt[] = prev === "D" ? [[X(t0), mid]] : [[X(t0) - edge / 2, prev === "H" ? top : top + amp]];
          const right: Pt[] = next === "D" ? [[X(t1), mid]] : [[X(t1) + edge / 2, next === "H" ? top : top + amp]];
          pen.poly([...left, [a, top], [b, top], ...right, [b, top + amp], [a, top + amp]], { fill: SURFACE });
          if (name) tags.push({ x: (X(t0) + X(t1)) / 2, y: mid, text: name, align: "center", w: 40, size: smallPx(7.5), color: MUTED });
        }
        for (const y of rails(level)) pen.line(a, y, b, y, FOREGROUND, 1.1);
        const next = segments[i + 1];
        if (!next) return;
        const [from, to] = [rails(level), rails(next[2])];
        const pairs: Array<[number, number]> = from.length === 2 && to.length === 2 ? [[from[0], to[1]], [from[1], to[0]]] : from.flatMap((f) => to.map((t): [number, number] => [f, t]));
        for (const [f, t] of pairs) {
          const hot = highlight.includes(t1);
          pen.line(X(t1) - edge / 2, f, X(t1) + edge / 2, t, hot ? PRIMARY : FOREGROUND, hot ? 1.8 : 1.1);
        }
      });
    };

    // Where the times are measured from: faint lines down through both waveforms.
    for (const t of [4, 8, 16, 17, 20, 24, 36, 40, 46]) pen.dash(X(t), 22, X(t), 156, BORDER, 0.6, 2, 2);
    wave(SCL, sclTop);
    wave(SDA, sdaTop, [4, 40, 46]);
    tags.push({ x: 0, y: sclTop + amp / 2, text: "SCL", align: "left", w: 34, size: smallPx(9), weight: 700 });
    tags.push({ x: 0, y: sdaTop + amp / 2, text: "SDA", align: "left", w: 34, size: smallPx(9), weight: 700 });
    tags.push({ x: X(4), y: 9, text: "START", align: "center", w: 50, size: smallPx(7.5), color: PRIMARY, weight: 700, tracking: 0.8 });
    tags.push({ x: X(40), y: 9, text: "STOP", align: "center", w: 50, size: smallPx(7.5), color: PRIMARY, weight: 700, tracking: 0.8 });
    tags.push({ x: X(46), y: 9, text: "START", align: "center", w: 50, size: smallPx(7.5), color: PRIMARY, weight: 700, tracking: 0.8 });

    /** A time between two edges: a line with arrows, its symbol beside or over it. */
    const time = (a: number, b: number, y: number, symbol: string, where: "over" | "under" | "left" = "over") => {
      const [xa, xb] = [X(a), X(b)];
      if (xb - xa >= 16) {
        pen.line(xa, y, xb, y, FOREGROUND, 0.6);
        pen.arrow(xa, y, -1, 0, FOREGROUND, 4.5, 1.5);
        pen.arrow(xb, y, 1, 0, FOREGROUND, 4.5, 1.5);
      } else {
        pen.line(xa - 10, y, xb + 10, y, FOREGROUND, 0.6);
        pen.arrow(xa, y, 1, 0, FOREGROUND, 4.5, 1.5);
        pen.arrow(xb, y, -1, 0, FOREGROUND, 4.5, 1.5);
      }
      const text = sym(symbol, smallPx(8.5));
      if (where === "left") tags.push({ x: xa - 14, y, text, align: "right", w: 60, size: smallPx(8.5) });
      else tags.push({ x: (xa + xb) / 2, y: where === "over" ? y - 7.5 : y + 8.5, text, align: "center", w: 60, size: smallPx(8.5) });
    };
    time(16, 20, 26, "t_LOW");
    time(20, 24, 26, "t_HIGH");
    time(4, 8, 84, "t_HD;STA");
    time(36, 40, 84, "t_SU;STO");
    time(17, 20, 146, "t_SU;DAT", "under");
    time(16, 17, 146, "t_HD;DAT", "left");
    time(40, 46, 146, "t_BUF", "under");

    return <Drawing width={width} height={166} title="I²C timing: SCL and SDA through a START, three bits and a STOP, with the set-up, hold, high, low and bus-free times marked." pen={pen} tags={tags} />;
  }

  // Figure 4: the typical application, its wiring drawn from the pins' types

  function Schematic({ d, pullUpOhms, available }: { d: Datasheet; pullUpOhms: number; available: number }) {
    const pen = new Pen();
    const tags: Tag[] = [];
    const numbered = d.pins.map((p, i) => ({ ...p, n: i + 1 }));
    const power = numbered.filter((p) => p.type === "Power");
    const ground = numbered.filter((p) => p.type === "Ground");
    const signals = numbered.filter((p) => p.type !== "Power" && p.type !== "Ground");
    const pulled = signals.filter((p) => p.pullUp);
    const resistance = String(pullUpOhms / 1000);
    const resistorLabel = pullUpOhms < 1000 ? `${pullUpOhms}R` : resistance.includes(".") ? resistance.replace(".", "k") : `${resistance}k`;
    const row = 24;
    const rail = 20;
    const top = 58;
    const boxH = Math.max(2, signals.length) * row + 20;
    const bottom = top + boxH;
    const ground0 = bottom + 26;
    const height = ground0 + 22;

    const mcu = { x0: 24, x1: 124 };
    const densePullUps = pulled.length > 3;
    const partWidth = Math.max(112, Math.max(power.length, ground.length) * 23 + 14);
    const firstResistor = mcu.x1 + (densePullUps ? 36 : 54);
    const lastResistor = available - partWidth - 140;
    const resistorPitch = densePullUps ? Math.min(29, (lastResistor - firstResistor) / Math.max(1, pulled.length - 1)) : 34;
    const resistors = pulled.map((_, i) => firstResistor + i * resistorPitch);
    const partX0 = Math.max(288, (resistors.at(-1) ?? 0) + (densePullUps ? 34 : 42));
    const part = { x0: partX0, x1: partX0 + partWidth };
    const capX = part.x1 + 46;
    const right = capX + 54;
    const sy = (i: number) => top + 10 + row * (i + 0.5);

    /** A ground symbol whose top is at x, y. */
    const earth = (x: number, y: number) => {
      pen.line(x - 7, y, x + 7, y, FOREGROUND, 1.1);
      pen.line(x - 4.5, y + 3.5, x + 4.5, y + 3.5, FOREGROUND, 1.1);
      pen.line(x - 2, y + 7, x + 2, y + 7, FOREGROUND, 1.1);
    };
    const dot = (x: number, y: number, color = FOREGROUND) => pen.circle(x, y, 2.4, { fill: color });

    // The supply rail across the top.
    pen.line(mcu.x0 + 3, rail, capX, rail, FOREGROUND, 1.1);
    pen.circle(mcu.x0, rail, 3, { fill: BACKGROUND, stroke: FOREGROUND, strokeWidth: 1.1 });
    tags.push({ x: mcu.x0 - 3, y: rail - 11, text: "3V3", align: "left", w: 40, size: smallPx(8.5), weight: 700 });

    // The host: VDD to the rail, GND to ground, and a pin for each signal.
    pen.rect(mcu.x0, top, mcu.x1 - mcu.x0, boxH, { fill: BACKGROUND, stroke: FOREGROUND, strokeWidth: 1.1 });
    const mx = (mcu.x0 + mcu.x1) / 2;
    pen.line(mx, rail, mx, top, FOREGROUND, 1.1);
    dot(mx, rail);
    pen.line(mx, bottom, mx, ground0, FOREGROUND, 1.1);
    earth(mx, ground0);
    tags.push({ x: mx, y: top + 9, text: "VDD", align: "center", w: 40, size: smallPx(7.5), color: MUTED });
    tags.push({ x: mx, y: bottom - 9, text: "GND", align: "center", w: 40, size: smallPx(7.5), color: MUTED });
    tags.push({ x: mcu.x0 + 10, y: (top + bottom) / 2, text: "Host", align: "left", w: 50, size: smallPx(11), font: BODY_FONT, weight: 700 });
    tags.push({ x: mcu.x0 + 10, y: (top + bottom) / 2 + 13, text: "MCU", align: "left", w: 50, size: smallPx(7.5), color: MUTED });

    // The part: power pins on top, ground pins below, signals down its left side, wired across to the host.
    pen.rect(part.x0, top, part.x1 - part.x0, boxH, { fill: BACKGROUND, stroke: FOREGROUND, strokeWidth: 1.1 });
    tags.push({ x: part.x1 - 10, y: (top + bottom) / 2, text: d.part, align: "right", w: 70, size: smallPx(11), font: BODY_FONT, weight: 700 });
    const spread = (k: number, i: number) => part.x0 + ((part.x1 - part.x0) * (i + 1)) / (k + 1) + (k === 1 ? 12 : 0);
    power.forEach((p, i) => {
      const x = spread(power.length, i);
      pen.line(x, rail, x, top, FOREGROUND, 1.1);
      dot(x, rail);
      tags.push({ x, y: top + 9, text: p.name, align: "center", w: 44, size: smallPx(7.5), color: MUTED });
      tags.push({ x: x + 4, y: top - 8, text: String(p.n), align: "left", w: 20, size: smallPx(7), color: PRIMARY });
    });
    ground.forEach((p, i) => {
      const x = spread(ground.length, i);
      pen.line(x, bottom, x, ground0, FOREGROUND, 1.1);
      earth(x, ground0);
      tags.push({ x, y: bottom - 9, text: p.name, align: "center", w: 44, size: smallPx(7.5), color: MUTED });
      tags.push({ x: x + 4, y: bottom + 8, text: String(p.n), align: "left", w: 20, size: smallPx(7), color: PRIMARY });
    });
    signals.forEach((p, i) => {
      const y = sy(i);
      pen.line(mcu.x1, y, part.x0, y, FOREGROUND, 1.1);
      tags.push({ x: mcu.x1 - 6, y, text: p.name, align: "right", w: 50, size: smallPx(7.5), color: MUTED });
      tags.push({ x: part.x0 + 6, y, text: p.name, align: "left", w: 50, size: smallPx(7.5), color: MUTED });
      tags.push({ x: part.x0 - 4, y: y - 7, text: String(p.n), align: "right", w: 20, size: smallPx(7), color: PRIMARY });
    });
    // Pull-ups: from the rail down to each open-drain line.
    pulled.forEach((p, i) => {
      const x = resistors[i];
      const y = sy(signals.indexOf(p));
      const [r0, r1] = [rail + 12, rail + 12 + 22];
      pen.line(x, rail, x, r0, FOREGROUND, 1.1);
      pen.rect(x - 4, r0, 8, r1 - r0, { fill: BACKGROUND, stroke: PRIMARY, strokeWidth: 1.1 });
      pen.line(x, r1, x, y, PRIMARY, 1.1);
      dot(x, rail);
      dot(x, y, PRIMARY);
      if (densePullUps) {
        tags.push({ x, y: rail - 10, text: `R${i + 1}`, align: "center", w: resistorPitch, size: smallPx(7.5), weight: 700 });
      } else {
        tags.push({ x: x + 7, y: r0 + 5, text: `R${i + 1}`, align: "left", w: 26, size: smallPx(7.5), weight: 700 });
        tags.push({ x: x + 7, y: r0 + 15, text: resistorLabel, align: "left", w: 27, size: smallPx(7.5), color: MUTED });
      }
    });
    // Decoupling: C1 from the rail to ground, by the part.
    const capY = (top + bottom) / 2;
    pen.line(capX, rail, capX, capY - 3, FOREGROUND, 1.1);
    pen.line(capX - 9, capY - 3, capX + 9, capY - 3, FOREGROUND, 1.6);
    pen.line(capX - 9, capY + 3, capX + 9, capY + 3, FOREGROUND, 1.6);
    pen.line(capX, capY + 3, capX, ground0, FOREGROUND, 1.1);
    earth(capX, ground0);
    tags.push({ x: capX + 13, y: capY - 6, text: "C1", align: "left", w: 40, size: smallPx(7.5), weight: 700 });
    tags.push({ x: capX + 13, y: capY + 5, text: "100n", align: "left", w: 40, size: smallPx(7.5), color: MUTED });

    return {
      width: right,
      height,
      pullUpLegend: densePullUps ? `R1–R${pulled.length} = ${pullUpOhms / 1000} kΩ each` : undefined,
      el: <Drawing width={right} height={height} title={`A typical application: a host's I²C pins wired to ${d.part}, with pull-up resistors to 3.3 V and a 100 nF capacitor across the supply.`} pen={pen} tags={tags} />,
    };
  }

  // Figure 5: the outline, dimensioned, with the board's edge below it

  const mm = (n: number, digits = 1) => n.toFixed(Math.abs(n * 10 - Math.round(n * 10)) > 1e-6 ? 2 : digits);

  function DimensionDrawing({ d, width }: { d: Datasheet; width: number }) {
    const { board, pins } = d;
    const pen = new Pen();
    const tags: Tag[] = [];
    const pads = padsOf(board, pins.length);
    const holes = holesOf(board, pads);
    const leftRoom = 88;
    const rightRoom = 88;
    const scale = SCALES.find((k) => board.width * k * MM <= width - leftRoom - rightRoom && board.height * k * MM <= 250) ?? 1;
    const s = scale * MM;
    const ox = leftRoom;
    const oy = holes.length && board.edges === "two" && holes.length === 4 ? 48 : 34;
    const X = (v: number) => ox + v * s;
    const Y = (v: number) => oy + v * s;
    const x1 = X(board.width);
    const y1 = Y(board.height);
    drawBoard(pen, board, pins, ox, oy, s, false);
    // Centre marks on the holes.
    for (const [hx, hy] of holes) {
      const r = (board.hole / 2 + 0.9) * s;
      pen.line(X(hx) - r, Y(hy), X(hx) + r, Y(hy), FOREGROUND, 0.4);
      pen.line(X(hx), Y(hy) - r, X(hx), Y(hy) + r, FOREGROUND, 0.4);
    }
    const ext = (xa: number, ya: number, xb: number, yb: number) => pen.line(xa, ya, xb, yb, FOREGROUND, 0.4);

    // Across the top: the holes' spacing, where they're side by side, then the overall width.
    const across = holes.filter(([, hy]) => Math.abs(hy - holes[0][1]) < 1e-6);
    let yw = oy - 18;
    if (across.length >= 2) {
      const [ha, hb] = [Math.min(...across.map((h) => h[0])), Math.max(...across.map((h) => h[0]))];
      ext(X(ha), Y(across[0][1]) - (board.hole / 2 + 1) * s, X(ha), yw - 4);
      ext(X(hb), Y(across[0][1]) - (board.hole / 2 + 1) * s, X(hb), yw - 4);
      dimX(pen, tags, X(ha), X(hb), yw, mm(hb - ha));
      yw -= 18;
    }
    ext(X(0), oy - 3, X(0), yw - 4);
    ext(x1, oy - 3, x1, yw - 4);
    dimX(pen, tags, X(0), x1, yw, mm(board.width));

    // Down the right: the holes' spacing, where they're one over the other, then the overall height.
    const right = holes.filter(([hx]) => Math.abs(hx - Math.max(...holes.map((h) => h[0]))) < 1e-6);
    let xh = x1 + 20;
    if (right.length >= 2) {
      const [ha, hb] = [Math.min(...right.map((h) => h[1])), Math.max(...right.map((h) => h[1]))];
      ext(X(right[0][0]) + (board.hole / 2 + 1) * s, Y(ha), xh + 4, Y(ha));
      ext(X(right[0][0]) + (board.hole / 2 + 1) * s, Y(hb), xh + 4, Y(hb));
      dimY(pen, tags, Y(ha), Y(hb), xh, mm(hb - ha));
      xh += 30;
    }
    ext(x1 + 3, oy, xh + 4, oy);
    ext(x1 + 3, y1, xh + 4, y1);
    dimY(pen, tags, oy, y1, xh, mm(board.height));

    // Down the left: pad 1 from the top edge, the pitch, and the pads' span.
    const left = pads.filter((p) => p.side === "left");
    if (left.length >= 2) {
      const [p1, p2, pn] = [left[0], left[1], left[left.length - 1]];
      const xa = ox - 22;
      ext(ox - 3, oy, xa - 4, oy);
      for (const p of [p1, p2]) ext(ox - (HALF_HOLE * s + 2), Y(p.y), xa - 4, Y(p.y));
      dimY(pen, tags, oy, Y(p1.y), xa, mm(p1.y, 2), "left");
      dimY(pen, tags, Y(p1.y), Y(p2.y), xa, mm(PITCH, 2), "left");
      const xb = ox - 58;
      ext(xa - 6, Y(p1.y), xb - 4, Y(p1.y));
      ext(ox - (HALF_HOLE * s + 2), Y(pn.y), xb - 4, Y(pn.y));
      dimY(pen, tags, Y(p1.y), Y(pn.y), xb, mm(pn.y - p1.y, 2));
    }
    // The holes: their size, by a leader from the lowest right-hand one; and its distance from the edge.
    if (holes.length) {
      const [hx, hy] = holes.reduce((a, b) => (b[1] > a[1] || (b[1] === a[1] && b[0] > a[0]) ? b : a));
      const r = (board.hole / 2) * s;
      const a = Math.PI / 4;
      const [sx, sy] = [X(hx) + Math.cos(a) * r, Y(hy) + Math.sin(a) * r];
      const knee: Pt = [x1 + 16, y1 + 22];
      pen.line(knee[0], knee[1], sx, sy, FOREGROUND, 0.6);
      pen.arrow(sx, sy, sx - knee[0], sy - knee[1], FOREGROUND, 5, 1.6);
      pen.line(knee[0], knee[1], knee[0] + 10, knee[1], FOREGROUND, 0.6);
      tags.push({ x: knee[0] + 13, y: knee[1], text: `Ø${mm(board.hole)} × ${holes.length}`, align: "left", w: 64, size: smallPx(8) });
      const yb = y1 + 18;
      ext(X(hx), Y(hy) + r + 3, X(hx), yb + 4);
      ext(x1, y1 + 3, x1, yb + 4);
      dimX(pen, tags, X(hx), x1, yb, mm(board.width - hx));
    }

    // Below: the board edge-on, the parts on top of it, the castellations at its end.
    const gap = 46;
    const ey = y1 + gap + board.parts * s;
    const t = board.thickness * s;
    pen.rect(X(0), ey, board.width * s, t, { fill: SURFACE, stroke: FOREGROUND, strokeWidth: 1.1 });
    pen.rect(X(0), ey, 0.35 * s, t, { fill: PRIMARY });
    if (board.edges === "two") pen.rect(x1 - 0.35 * s, ey, 0.35 * s, t, { fill: PRIMARY });
    // Seen edge-on, each part is as tall as it stands, the tallest at the board's own figure for its parts.
    const parts = partsOf(board, pads, holes);
    const low = Math.min(board.parts, 0.8);
    const chip = Math.min(board.parts, 0.5);
    for (const [cx] of parts.caps) {
      const w = parts.capsVertical ? 0.8 : 1.6;
      pen.rect(X(cx - w / 2), ey - chip * s, w * s, chip * s, { fill: BORDER, stroke: MUTED, strokeWidth: 0.5 });
    }
    if (parts.decouple) pen.rect(X(parts.decouple[0] - 0.8), ey - chip * s, 1.6 * s, chip * s, { fill: BORDER, stroke: MUTED, strokeWidth: 0.5 });
    if (parts.regulator) pen.rect(X(parts.regulator[0] - 1.45), ey - low * s, 2.9 * s, low * s, { fill: FOREGROUND });
    if (parts.sensor) pen.rect(X(parts.sensor[0] - 1.5), ey - board.parts * s, 3 * s, board.parts * s, { fill: FOREGROUND });
    ext(ox - 3, ey, ox - 20, ey);
    ext(ox - 3, ey + t, ox - 54, ey + t);
    dimY(pen, tags, ey, ey + t, ox - 16, mm(board.thickness), "left");
    const tallest = parts.sensor ? X(parts.sensor[0] - 1.5) : parts.regulator ? X(parts.regulator[0] - 1.45) : undefined;
    if (tallest !== undefined && board.parts > 0) {
      ext(tallest - 3, ey - board.parts * s, ox - 54, ey - board.parts * s);
      dimY(pen, tags, ey - board.parts * s, ey + t, ox - 50, mm(board.thickness + board.parts), "left");
    }
    tags.push({ x: X(board.width / 2), y: ey + t + 14, text: "Side view", align: "center", w: 80, size: smallPx(7.5), color: MUTED, caps: true, tracking: 0.8 });

    const height = ey + t + 24;
    return {
      scale,
      height,
      el: <Drawing width={width} height={height} title={`${d.part}'s outline at ${ratio(scale)}: ${board.width} by ${board.height} mm, its holes and pads dimensioned, and the board edge-on below.`} pen={pen} tags={tags} />,
    };
  }

  // Text, tables and their parts

  /** A numbered section: its number in the brand's primary color, its name, and a note at the right, over an ink rule. */
  const section = (n: number, name: string, note?: ReactNode) => (
    <Row style={{ alignItems: "end", gap: md / 2, padding: [sm, 0, 0], border: { top: hairline(BORDER) } }}>
      <Heading level={2} style={{ flex: "none", fontFamily: HEADING_FONT, fontSize: sectionSize, lineHeight: px(sectionLine) }}>
        <Span style={{ fontFamily: BODY_FONT, fontSize: smallPx(9), fontWeight: 700, color: PRIMARY }}>{`${String(n).padStart(2, "0")}\u00A0\u00A0\u00A0`}</Span>
        {name}
      </Heading>
      {note ? <Text style={{ fontSize: smallPx(9.5), lineHeight: px(sectionLine), color: MUTED, textAlign: "right" }}>{note}</Text> : null}
    </Row>
  );

  /** A figure's or a table's caption: its number in small capitals, then what it shows. */
  const caption = (kind: string, n: number, text: string) => (
    <Text style={{ fontSize: smallPx(9.5), lineHeight: 1.4, color: MUTED }}>
      <Span style={{ fontFamily: BODY_FONT, fontSize: smallPx(7.5), fontWeight: 700, letterSpacing: xs * 0.18, textTransform: "uppercase", color: FOREGROUND }}>{`${kind} ${n}`}</Span>
      {"   "}
      {text}
    </Text>
  );

  const head = { ...label, padding: [0, sm, xs, 0], border: { bottom: hairline(BORDER) }, verticalAlign: "bottom" } as const;
  const cell = { padding: [cellPadding, sm, cellPadding, 0], border: { bottom: hairline() }, verticalAlign: "top" } as const;
  const value = { fontFamily: BODY_FONT, fontSize: smallPx(9.5), lineHeight: px(LINE_H) } as const;
  const table = { fontSize: smallPx(11), lineHeight: px(LINE_H) } as const;
  const dash = <Span style={{ color: BORDER }}>–</Span>;
  const or = (v: string | undefined) => (v ? v : dash);

  function PinTable({ pins, from = 0 }: { pins: Pin[]; from?: number }) {
    return (
      <Table style={table}>
        <TableRow header>
          <TableCell style={{ ...head, width: 44 }}>Pin</TableCell>
          <TableCell style={{ ...head, width: 72 }}>Name</TableCell>
          <TableCell style={{ ...head, width: 78 }}>Type</TableCell>
          <TableCell style={{ ...head, padding: [0, 0, xs] }}>Description</TableCell>
        </TableRow>
        {pins.map((p, i) => (
          <TableRow key={i}>
            <TableCell style={{ ...cell, ...value, color: PRIMARY, fontWeight: 700 }}>{String(from + i + 1)}</TableCell>
            <TableCell style={{ ...cell, ...value, fontWeight: 700 }}>{p.name}</TableCell>
            <TableCell style={{ ...cell, color: MUTED }}>{p.type}</TableCell>
          <TableCell style={{ ...cell, padding: [cellPadding, 0] }}>{nb(p.description)}</TableCell>
          </TableRow>
        ))}
      </Table>
    );
  }

  function RatingsTable({ ratings }: { ratings: Rating[] }) {
    const n = { ...cell, ...value, textAlign: "center" } as const;
    return (
      <Table style={table}>
        <TableRow header>
          <TableCell style={head}>Parameter</TableCell>
          <TableCell style={{ ...head, width: 76 }}>Symbol</TableCell>
          <TableCell style={{ ...head, width: 64, textAlign: "center" }}>Min</TableCell>
          <TableCell style={{ ...head, width: 64, textAlign: "center" }}>Max</TableCell>
          <TableCell style={{ ...head, width: 52, textAlign: "center", padding: [0, 0, xs] }}>Unit</TableCell>
        </TableRow>
        {ratings.map((r, i) => (
          <TableRow key={i}>
            <TableCell style={cell}>{r.parameter}</TableCell>
            <TableCell style={{ ...cell, ...value }}>{sym(r.symbol, smallPx(9.5))}</TableCell>
            <TableCell style={n}>{or(r.min)}</TableCell>
            <TableCell style={n}>{or(r.max)}</TableCell>
          <TableCell style={{ ...n, padding: [cellPadding, 0] }}>{r.unit}</TableCell>
          </TableRow>
        ))}
      </Table>
    );
  }

  function CharacteristicsTable({ rows }: { rows: Characteristic[] }) {
    const n = { ...value, textAlign: "center" } as const;
    return (
      <Table style={table}>
        <TableRow header>
          <TableCell style={{ ...head, width: 96 }}>Group</TableCell>
          <TableCell style={head}>Parameter</TableCell>
          <TableCell style={{ ...head, width: 56 }}>Symbol</TableCell>
          <TableCell style={{ ...head, width: 134 }}>Conditions</TableCell>
          <TableCell style={{ ...head, width: 52, textAlign: "center" }}>Min</TableCell>
          <TableCell style={{ ...head, width: 52, textAlign: "center" }}>Typ</TableCell>
          <TableCell style={{ ...head, width: 52, textAlign: "center" }}>Max</TableCell>
          <TableCell style={{ ...head, width: 44, textAlign: "center", padding: [0, 0, xs] }}>Unit</TableCell>
        </TableRow>
        {rows.map((r, i) => {
          const first = i === 0 || r.group !== rows[i - 1].group;
          const line = i === 0 ? undefined : { top: hairline() };
          const c = { padding: [cellPadding, sm, cellPadding, 0], verticalAlign: "top", border: line } as const;
          return (
            <TableRow key={i}>
              <TableCell style={{ ...c, border: first ? line : undefined, fontWeight: 400 }}>{first ? r.group ?? "" : ""}</TableCell>
              <TableCell style={c}>{r.parameter}</TableCell>
              <TableCell style={{ ...c, ...value }}>{sym(r.symbol, smallPx(9.5))}</TableCell>
              <TableCell style={{ ...c, color: MUTED }}>{nb(r.conditions ?? "")}</TableCell>
              <TableCell style={{ ...c, ...n }}>{or(r.min)}</TableCell>
              <TableCell style={{ ...c, ...n }}>{or(r.typ)}</TableCell>
              <TableCell style={{ ...c, ...n }}>{or(r.max)}</TableCell>
              <TableCell style={{ ...c, ...n, padding: [cellPadding, 0] }}>{r.unit ?? ""}</TableCell>
            </TableRow>
          );
        })}
      </Table>
    );
  }

  function TimingTable({ mode }: { mode: I2cMode }) {
    const n = { ...cell, ...value, textAlign: "center" } as const;
    return (
      <Table style={table}>
        <TableRow header>
          <TableCell style={{ ...head, width: 70 }}>Symbol</TableCell>
          <TableCell style={head}>Parameter</TableCell>
          <TableCell style={{ ...head, width: 46, textAlign: "center" }}>Min</TableCell>
          <TableCell style={{ ...head, width: 46, textAlign: "center" }}>Max</TableCell>
          <TableCell style={{ ...head, width: 38, textAlign: "center", padding: [0, 0, xs] }}>Unit</TableCell>
        </TableRow>
        {I2C_TIMING[mode].map(([symbol, parameter, min, max, unit]) => (
          <TableRow key={symbol}>
            <TableCell style={{ ...cell, ...value }}>{sym(symbol, smallPx(9.5))}</TableCell>
            <TableCell style={cell}>{parameter}</TableCell>
            <TableCell style={n}>{or(min)}</TableCell>
            <TableCell style={n}>{or(max)}</TableCell>
          <TableCell style={{ ...n, padding: [cellPadding, 0] }}>{unit}</TableCell>
          </TableRow>
        ))}
      </Table>
    );
  }

  /** A few rows of a Table, in plain columns: ordering and revisions. */
  function SimpleTable({ heads, widths, rows, emphasized = [] }: { heads: string[]; widths: Array<number | undefined>; rows: string[][]; emphasized?: number[] }) {
    const last = heads.length - 1;
    return (
      <Table style={table}>
        <TableRow header>
          {heads.map((h, i) => (
            <TableCell key={h} style={{ ...head, ...(widths[i] ? { width: widths[i] } : {}), ...(i === last ? { padding: [0, 0, xs] } : {}) }}>
              {h}
            </TableCell>
          ))}
        </TableRow>
        {rows.map((r, j) => (
          <TableRow key={j}>
            {r.map((v, i) => (
              <TableCell key={i} style={{ ...cell, ...(emphasized.includes(i) ? { ...value, fontWeight: 700 } : {}), ...(i === last ? { padding: [cellPadding, 0] } : {}) }}>
                {nb(v)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </Table>
    );
  }

  // Pagination uses the selected brand's font sizes, leading and spacing. Allow for long words and
  // keep the same nonbreaking units as the rendered paragraphs.
  const em = (ch: string) => (/[mwMW@%]/.test(ch) ? 0.94 : /[A-Z0-9#$&]/.test(ch) ? 0.66 : /[ijlrtfI.,:;'|!()[\] ]/.test(ch) ? 0.33 : 0.55);
  function linesOf(text: string, width: number, size: number) {
    const room = Math.max(size, width - size * 0.25);
    let lines = 1;
    let used = 0;
    for (const word of nb(text).split(/[ \t\n]+/).filter(Boolean)) {
      const wordWidth = [...word].reduce((sum, ch) => sum + em(ch), 0) * size;
      const space = used > 0 ? size * 0.33 : 0;
      if (used > 0 && used + space + wordWidth > room) {
        lines++;
        used = 0;
      }
      const needed = Math.max(1, Math.ceil(wordWidth / room));
      lines += needed - 1;
      used += (used > 0 ? space : 0) + wordWidth - (needed - 1) * room;
    }
    return lines;
  }

  /** The height between the running header and footer, less the space over the first part. */
  const ROOM = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM - headerHeight - footerHeight;
  const SECTION_H = sm + 1 + sectionLine + 1;
  const CAPTION_H = smallPx(14);
  const HEAD_H = labelLine + xs + 2;
  const ROW_H = 2 * cellPadding + LINE_H + 1;

  type Part = { group: number; height: number; el: ReactElement } | { group: number; table: { rows: number[]; head: (from: number) => number; foot: number; draw: (from: number, to: number) => ReactElement } };

  function paginate(parts: Part[], room: number, gap: number): ReactElement[][] {
    const pages: ReactElement[][] = [];
    let page: ReactElement[] = [];
    let used = 0;
    let group = -1;
    let spilled = false;
    const turn = () => {
      if (page.length) pages.push(page);
      page = [];
      used = 0;
    };
    const add = (el: ReactElement, height: number) => {
      used += (page.length ? gap : 0) + height;
      page.push(el);
    };
    const free = () => room - used - (page.length ? gap : 0);
    for (const part of parts) {
      // Each group of parts starts a page, unless the one before spilled onto a page of its own.
      if (part.group !== group) {
        // Give the mechanical drawing, ordering and revision history a sheet of their own.
        if (!spilled || part.group === 4) turn();
        group = part.group;
        spilled = false;
      }
      if ("el" in part) {
        if (page.length && part.height > free()) {
          turn();
          spilled = true;
        }
        add(part.el, part.height);
        continue;
      }
      const { rows, head, foot, draw } = part.table;
      let i = 0;
      while (i < rows.length) {
        let n = 0;
        let h = head(i) + foot;
        while (i + n < rows.length && h + rows[i + n] <= free()) h += rows[i + n++];
        if (n > 2 && i + n === rows.length - 1) h -= rows[i + --n];
        if (i + n === rows.length || n >= 2 || (n === 1 && !page.length)) {
          add(draw(i, i + n), h);
          i += n;
          if (i < rows.length) {
            turn();
            spilled = true;
          }
        } else {
          if (!page.length) throw new Error("A table row is too tall for an A4 sheet. Shorten its text.");
          turn();
          spilled = true;
        }
      }
    }
    turn();
    return pages;
  }

  function renderDatasheet(d: Datasheet) {
    const W = PAGE_WIDTH - 2 * SIDE;
    const gap = GAP;
    const top = md / 2;
    const release = d.date ?? d.revisions[0].date;
    const edition = [`Rev ${d.revision}`, release].filter(Boolean).join(" · ");
    const half = (W - GAP) / 2;
    const left = 266;
    const fig1 = BoardFigure({ d, width: W - left - GAP });
    const pullUp = i2cPullUp(d.i2c);
    const schematic = Schematic({ d, pullUpOhms: pullUp.ohms, available: W });
    const outline = DimensionDrawing({ d, width: W - 196 - GAP });
    const site = brand.links.site.replace(/^https?:\/\//, "");
    const textSize = { fontSize: bodyPx(11.5), lineHeight: textLeading } as const;
    const TEXT_H = textSize.fontSize * textLeading;
    const summarySize = bodyPx(13.5);
    const highlightSize = bodyPx(21);
    const titleWidth = W - 296 - GAP;
    const smallGap = xs / 2;

    const textListHeight = (entries: string[], width: number, gap: number) =>
      entries.reduce((height, entry) => height + linesOf(entry, width, textSize.fontSize) * TEXT_H, 0) + gap * Math.max(0, entries.length - 1);
    const captionHeight = (copy: string, width = W) => CAPTION_H * linesOf(copy, width - 24, smallPx(9.5));
    const chartH = 190;

    // 1: what it is, the board and its pins.
    const titleH = Math.max(
      labelLine + md + partSize * 0.92 + xs +
        linesOf(d.name, titleWidth, nameSize) * nameSize * 1.15 +
        linesOf(d.summary, 330, summarySize) * summarySize * textLeading + 6,
      Math.ceil(d.highlights.length / 2) * (1 + sm + highlightSize * 1.1 + smallGap + 2 * labelLine + sm),
    );
    const title = (
      <Row style={{ alignItems: "end", gap: GAP }}>
        <Column style={{ gap: md / 2 }}>
          <Text style={label}>{`Revision ${d.revision}${release ? ` · ${release}` : ""}`}</Text>
          <Column style={{ gap: xs }}>
            <Heading level={1} style={{ fontSize: partSize, lineHeight: 0.92, letterSpacing: -xs * 0.7 }}>
              {d.part}
            </Heading>
            <Text style={{ fontSize: nameSize, fontWeight: headingWeight, fontFamily: HEADING_FONT, lineHeight: 1.15, letterSpacing: -xs * 0.08 }}>{d.name}</Text>
          </Column>
          <Text style={{ fontSize: summarySize, lineHeight: textLeading, color: MUTED, maxWidth: 330 }}>{nb(d.summary)}</Text>
        </Column>
        <Grid columns={2} style={{ width: 296, gap: md, rowGap: sm }}>
          {d.highlights.map((h, i) => (
            <Column key={i} style={{ gap: xs / 2, padding: [sm, 0, 0], border: { top: hairline(i < 2 ? FOREGROUND : BORDER) } }}>
              <Text style={{ fontSize: highlightSize, fontWeight: 400, lineHeight: 1.1, letterSpacing: -xs * 0.08 }}>{nb(h.value)}</Text>
              <Text style={{ ...label, fontSize: smallPx(7.5), letterSpacing: xs * 0.18 }}>{nb(h.label)}</Text>
            </Column>
          ))}
        </Grid>
      </Row>
    );

    const listIndent = md;
    const leftH = 2 * (SECTION_H + sm) + md +
      textListHeight(d.features, left - listIndent, smallGap) +
      textListHeight([d.applications.join(" · ")], left, 0);
    const boardCaption = `${d.part} from above at ${ratio(fig1.scale)}. Each pad is drawn and called out from table 1.`;
    const boardHeight = SECTION_H + 2 * sm + fig1.height + captionHeight(boardCaption, W - left - GAP);
    const overviewHeight = Math.max(leftH, boardHeight) + md + SECTION_H + sm + textListHeight([d.description], W, 0);
    const overview = (
      <Column style={{ gap: md }}>
        <Row style={{ gap: GAP, alignItems: "start" }}>
          <Column style={{ width: left, gap: md }}>
            <Column style={{ gap: sm }}>
              {section(1, "Features")}
              <List style={{ ...textSize, width: left, gap: smallGap, indent: listIndent }}>
                {d.features.map((f, i) => <ListItem key={i}>{nb(f)}</ListItem>)}
              </List>
            </Column>
            <Column style={{ gap: sm }}>
              {section(2, "Applications")}
              <Text style={textSize}>{d.applications.map(nb).join(" · ")}</Text>
            </Column>
          </Column>
          <Column style={{ gap: sm }}>
            {section(3, "Pinout", "Top view")}
            {fig1.el}
            {caption("Figure", 1, boardCaption)}
          </Column>
        </Row>
        <Column style={{ gap: sm }}>
          {section(4, "Description")}
          <Text style={textSize}>{nb(d.description)}</Text>
        </Column>
      </Column>
    );

    const tableSize = table.fontSize;
    const rowHeight = (...cells: Array<[text: string | undefined, width: number]>) =>
      ROW_H + (Math.max(...cells.map(([text, width]) => linesOf(text ?? "", width - sm, tableSize))) - 1) * LINE_H;
    const pinRows = d.pins.map((p) => rowHeight([p.description, W - 194]));
    const pinTable = (from: number, to: number) => (
      <Column style={{ gap: sm }}>
        {from > 0 ? section(3, "Pinout", "Continued") : null}
        <PinTable pins={d.pins.slice(from, to)} from={from} />
        {caption("Table", 1, to < d.pins.length ? "Pin functions, continued overleaf." : "Pin functions. Pin 1 is marked on the board by a triangle.")}
      </Column>
    );

    // 2: the limits and the characteristics.
    const ratingsCaption = "Exceeding these limits may damage the board. Operate it within the electrical characteristics below.";
    const ratings = (from: number, to: number) => (
      <Column style={{ gap: sm }}>
        {section(5, "Absolute maximum ratings", from > 0 ? "Continued" : undefined)}
        <RatingsTable ratings={d.ratings.slice(from, to)} />
        {caption("Table", 2, to < d.ratings.length ? "Absolute maximum ratings, continued overleaf." : ratingsCaption)}
      </Column>
    );
    const ratingRows = d.ratings.map((r) => rowHeight([r.parameter, W - 256], [r.min, 64], [r.max, 64]));
    const paramW = W - 96 - 56 - 134 - 156 - 44;
    const charRows = d.characteristics.map((r, i, all) => rowHeight(
      [i === 0 || r.group !== all[i - 1].group ? r.group : undefined, 96],
      [r.parameter, paramW], [r.conditions, 134], [r.min, 52], [r.typ, 52], [r.max, 52], [r.unit, 44],
    ));
    const characteristics = (from: number, to: number) => (
      <Column style={{ gap: sm }}>
        {section(6, "Electrical characteristics", from > 0 ? "Continued" : <>T{sym("_A", smallPx(9.5))} = 25 °C and V{sym("_IN", smallPx(9.5))} = 3.3 V unless noted</>)}
        <CharacteristicsTable rows={d.characteristics.slice(from, to)} />
        {caption("Table", 3, to < d.characteristics.length ? "Electrical characteristics, continued overleaf." : d.characteristicsNote ?? DEFAULT_CHARACTERISTICS_NOTE)}
      </Column>
    );
    const chartCaptions = d.curves.map((c) => `${c.title}, typical and limits.`);
    const performanceHeight = SECTION_H + md / 2 + chartH + sm + Math.max(...chartCaptions.map((copy) => captionHeight(copy, half)));
    const performance = (
      <Column style={{ gap: md / 2 }}>
        {section(7, "Typical performance")}
        <Row style={{ gap: GAP, alignItems: "start" }}>
          {d.curves.slice(0, 2).map((c, i) => (
            <Column key={i} style={{ width: half, gap: sm }}>
              <CurveChart curve={c} width={half} height={chartH} />
              {caption("Figure", i + 2, chartCaptions[i])}
            </Column>
          ))}
        </Row>
      </Column>
    );

    // 3: the bus, and how to wire it.
    const riseTime = Number(pullUp.riseNs.toPrecision(3));
    const busMode = d.i2c.mode === "Fast-mode Plus" ? d.i2c.mode : `${d.i2c.mode} mode`;
    const pullUpNote = `For SDA and SCL, use ${pullUp.ohms / 1000} kΩ pull-ups to 3.3 V. At ${pullUp.capacitancePf} pF per line, the estimated rise time is ${riseTime} ns (${pullUp.maxRiseNs} ns max, UM10204).`;
    const [address, ...otherNotes] = d.i2c.notes;
    const busNotes = [address, pullUpNote, ...otherNotes].filter(Boolean);
    const bus = (
      <Column style={{ gap: md / 2 }}>
        {section(8, "I²C interface", busMode)}
        <TimingDiagram width={W} />
        {caption("Figure", 4, "I²C timing. Times are measured between the edges the dashed lines mark; table 4 gives their limits.")}
      </Column>
    );
    const timing = (
      <Row style={{ gap: GAP, alignItems: "start" }}>
        <Column style={{ gap: sm }}>
          <TimingTable mode={d.i2c.mode} />
          {caption("Table", 4, `I²C timing, ${busMode.toLowerCase()}.`)}
        </Column>
        <Column style={{ width: 236, gap: sm }}>
          {busNotes.map((note, i) => (
            <Text key={i} style={textSize}>
              {nb(note)}
            </Text>
          ))}
        </Column>
      </Row>
    );
    const timingH = Math.max(
      HEAD_H + I2C_TIMING[d.i2c.mode].length * ROW_H + sm + CAPTION_H,
      textListHeight(busNotes, 236, sm),
    );
    const applicationSide = W - schematic.width - GAP;
    const stackNotes = applicationSide < 150;
    const applicationCaption = [`${d.part} on a host's I²C bus.`, schematic.pullUpLegend].filter(Boolean).join(" ");
    const applicationNotes = (
      <Column style={{ gap: sm }}>
        {d.application.map((note, i) => <Text key={i} style={textSize}>{nb(note)}</Text>)}
      </Column>
    );
    const circuit = (
      <Column style={{ width: schematic.width, gap: sm }}>
        {schematic.el}
        {caption("Figure", 5, applicationCaption)}
      </Column>
    );
    const application = (
      <Column style={{ gap: md / 2 }}>
        {section(9, "Typical application")}
        {stackNotes
          ? <Column style={{ gap: sm }}>{circuit}{applicationNotes}</Column>
          : <Row style={{ gap: GAP, alignItems: "start" }}>{circuit}{applicationNotes}</Row>}
      </Column>
    );
    const circuitH = schematic.height + sm + captionHeight(applicationCaption, schematic.width);
    const applicationNotesH = textListHeight(d.application, stackNotes ? W : applicationSide, sm);
    const applicationH = SECTION_H + md / 2 +
      (stackNotes ? circuitH + sm + applicationNotesH : Math.max(circuitH, applicationNotesH));

    // 4: the outline, ordering and history.
    const notes = [
      "Dimensions in millimetres. Outline ±0.2, holes and pads ±0.1.",
      "Castellated pads on a 2.54 mm pitch, with 1.0 mm half-holes, gold over nickel.",
      `FR-4, ${mm(d.board.thickness)} mm thick. Parts stand up to ${mm(d.board.parts)} mm above it.`,
      `Drawn at ${ratio(outline.scale)} when printed at 100 %.`,
    ];
    const mechanical = (
      <Column style={{ gap: md / 2 }}>
        {section(10, "Mechanical", "Dimensions in mm")}
        <Row style={{ gap: GAP, alignItems: "start" }}>
          <Column style={{ gap: sm }}>{outline.el}</Column>
          <Column style={{ width: 196, gap: sm }}>
            <Column style={{ gap: xs }}>
              {notes.map((note, i) => (
                <Row key={i} style={{ gap: xs }}>
                  <Text style={{ width: 12, flex: "none", fontFamily: BODY_FONT, fontSize: smallPx(8), lineHeight: px(noteLine), color: PRIMARY }}>{String(i + 1)}</Text>
                  <Text style={{ fontSize: smallPx(10), lineHeight: px(noteLine), color: MUTED }}>{nb(note)}</Text>
                </Row>
              ))}
            </Column>
            <Column style={{ border: hairline(BORDER) }}>
              <Row style={{ gap: sm, alignItems: "center", padding: [xs, sm], border: { bottom: hairline(BORDER) } }}>
                <Text style={{ fontFamily: BODY_FONT, fontSize: smallPx(8), fontWeight: 700, letterSpacing: xs * 0.32, lineHeight: px(titleBlockLine) }}>{brand.name}</Text>
              </Row>
              {[
                ["Title", `${d.part} outline`, "Rev", d.revision],
                ["Scale", ratio(outline.scale), "Units", "mm"],
                ["Release", release ?? "–", "Sheet", null],
              ].map(([a, av, b, bv], i) => (
                <Row key={i} style={{ border: i < 2 ? { bottom: hairline(BORDER) } : undefined }}>
                  <Column style={{ padding: [xs, sm], gap: xs / 4, border: { right: hairline(BORDER) } }}>
                    <Text style={{ ...label, fontSize: smallPx(6.5) }}>{a}</Text>
                    <Text style={{ ...value, fontSize: smallPx(9), lineHeight: px(titleBlockLine) }}>{av}</Text>
                  </Column>
                  <Column style={{ width: 62, padding: [xs, sm], gap: xs / 4 }}>
                    <Text style={{ ...label, fontSize: smallPx(6.5) }}>{b}</Text>
                    <Text style={{ ...value, fontSize: smallPx(9), lineHeight: px(titleBlockLine), color: b === "Rev" ? PRIMARY : FOREGROUND, fontWeight: b === "Rev" ? 700 : 400 }}>
                      {bv ?? (
                        <>
                          <PageNumber /> / <PageNumber total />
                        </>
                      )}
                    </Text>
                  </Column>
                </Row>
              ))}
            </Column>
          </Column>
        </Row>
        {caption("Figure", 6, `${d.part} outline, from above and edge-on.`)}
      </Column>
    );
    const notesH = notes.reduce((sum, n) => sum + linesOf(n, 196 - 12 - xs, smallPx(10)) * noteLine, 0)
      + (notes.length - 1) * xs + sm + 2 * xs + titleBlockLine + 2
      + 3 * (2 * xs + xs / 4 + labelLine + titleBlockLine + 1);
    const mechanicalH = SECTION_H + md + Math.max(outline.height, notesH) + CAPTION_H;
    const simpleH = (rows: string[][], widths: number[]) => SECTION_H + sm + HEAD_H +
      rows.reduce((sum, row) => sum + rowHeight(...row.map((v, i): [string, number] => [v, widths[i]])), 0);
    const orders = d.ordering.map((o) => [o.part, o.description, o.pack]);
    const ordering = (
      <Column style={{ gap: sm }}>
        {section(11, "Ordering")}
        <SimpleTable heads={["Part number", "Description", "Pack"]} widths={[120, undefined, 110]} rows={orders} emphasized={[0]} />
      </Column>
    );
    const datedHistory = d.revisions.some((r) => r.date);
    const history = d.revisions.map((r) => datedHistory ? [r.rev, r.date ?? "–", r.changes] : [r.rev, r.changes]);
    const revisions = (
      <Column style={{ gap: sm }}>
        {section(12, "Revision history")}
        <SimpleTable heads={datedHistory ? ["Rev", "Month", "Changes"] : ["Rev", "Changes"]} widths={datedHistory ? [64, 112, undefined] : [64, undefined]} rows={history} emphasized={[0]} />
      </Column>
    );
    const legalText = `${brand.legal?.entity ?? brand.name} makes ${d.part} for monitoring and control. Do not use it in life-support or other safety-critical systems. Specifications may change without notice.`;
    const legal = <Text style={{ fontSize: smallPx(9), lineHeight: 1.5, color: MUTED, padding: [sm, 0, 0], border: { top: hairline() } }}>{legalText}</Text>;

    const pages = paginate(
      [
        { group: 1, height: titleH, el: title },
        { group: 1, height: overviewHeight, el: overview },
        { group: 1, table: { rows: pinRows, head: (from) => HEAD_H + (from > 0 ? SECTION_H + sm : 0), foot: sm + CAPTION_H, draw: pinTable } },
        { group: 2, table: { rows: ratingRows, head: () => SECTION_H + sm + HEAD_H, foot: sm + captionHeight(ratingsCaption), draw: ratings } },
        { group: 2, table: { rows: charRows, head: () => SECTION_H + sm + HEAD_H, foot: sm + captionHeight(d.characteristicsNote), draw: characteristics } },
        { group: 2, height: performanceHeight, el: performance },
        { group: 3, height: SECTION_H + md + 166 + CAPTION_H, el: bus },
        { group: 3, height: timingH, el: timing },
        { group: 3, height: applicationH, el: application },
        { group: 4, height: mechanicalH, el: mechanical },
        { group: 4, height: simpleH(orders, [120, W - 230, 110]), el: ordering },
        { group: 4, height: simpleH(history, datedHistory ? [64, 112, W - 176] : [64, W - 64]), el: revisions },
        { group: 4, height: sm + 1 + linesOf(legalText, W, smallPx(9)) * smallPx(9) * 1.5, el: legal },
      ],
      ROOM - top - xs,
      gap,
    );

    return (
      <Document
        size="A4"
        margin={[MARGIN_TOP, SIDE, MARGIN_BOTTOM, SIDE]}
        title={`${d.part} ${d.name}, datasheet, revision ${d.revision}`}
        lang={brand.lang ?? "en"}
        dir={brand.dir}
        theme={brand.theme}
        fonts={brand.fonts}
        style={{ backgroundColor: token("colors.background"), color: token("colors.foreground"), fontFamily: token("fonts.body"), fontSize: bodyPx(11.5), lineHeight: textLeading }}
      >
        <PageHeader style={{ padding: [0, 0, sm], border: { bottom: hairline(BORDER) } }}>
          <Row style={{ alignItems: "center", justifyContent: "space-between", gap: sm }}>
            <Image
              src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
              alt={brand.logo.alt}
              style={{ width: logoWidth }}
            />
            <Text style={{ fontFamily: BODY_FONT, fontSize: smallPx(8.5), lineHeight: px(headerLine), color: MUTED, textAlign: "right" }}>
              <Span style={{ color: FOREGROUND, fontWeight: 700 }}>{d.part}</Span> Datasheet{"   ·   "}
              <Span style={{ color: PRIMARY, fontWeight: 700 }}>Rev {d.revision}</Span>
            </Text>
          </Row>
        </PageHeader>

        {pages.map((parts, i) => (
          <Document.Page key={i}>
            <Column style={{ gap, padding: [top, 0, 0] }}>{parts.map((part, j) => (
                <Column key={j}>{part}</Column>
              ))}</Column>
          </Document.Page>
        ))}

        <PageFooter style={{ padding: [sm, 0, 0], border: { top: hairline() } }}>
          <Row style={{ gap: md, alignItems: "center" }}>
            <Text style={{ fontFamily: BODY_FONT, fontSize: footerSize, color: MUTED, lineHeight: px(footerLine) }}><Link href={brand.links.site} style={{ color: MUTED }}>{site}</Link></Text>
            <Text style={{ fontFamily: BODY_FONT, fontSize: footerSize, color: MUTED, lineHeight: px(footerLine), textAlign: "center" }}>{`${d.part} · ${edition}`}</Text>
            <Text style={{ fontFamily: BODY_FONT, fontSize: footerSize, color: MUTED, lineHeight: px(footerLine), textAlign: "right" }}>
              Page <PageNumber /> of <PageNumber total />
            </Text>
          </Row>
        </PageFooter>
      </Document>
    );
  }

  return template({
    id: "documents.Datasheet",
    version: "1.0.0",
    label: "Sensor datasheet",
    description: "An A4 hardware datasheet with a pinout, electrical limits, performance curves, I²C timing, an application schematic and a dimensioned board outline.",
    guidance: "Use one datasheet per part and revision. Set the board dimensions, pins, limits and measurements to build the drawings and tables. Longer tables continue with their column headings on the next page.",
    root: "Document",
    fields,
    rules: {
      require: { core: ["layout/overflow", "document/overflow"] },
      root: { lang: true, title: true },
      links: { domains: brand.links.domains },
    },
    example: wr2,
    render(values) {
      const { board, pins, i2c, curves, revisions, revision, date } = values;
      const perEdge = board.edges === "two" ? Math.ceil(pins.length / 2) : pins.length;
      const needed = perEdge * PITCH;
      if (needed > board.height) {
        throw new Error(`${perEdge} pads on a ${PITCH} mm pitch need an edge of at least ${needed.toFixed(2)} mm. The board is ${board.height} mm tall. Make it taller, or put the pads along two edges.`);
      }
      const { riseNs, maxRiseNs } = i2cPullUp(i2c);
      if (riseNs > maxRiseNs) {
        throw new Error(`i2c.pullUpOhms and i2c.busCapacitancePf give a rise time of ${riseNs.toPrecision(3)} ns. Reduce resistance or capacitance to meet the ${maxRiseNs} ns limit for ${i2c.mode}.`);
      }
      for (const [i, curve] of curves.entries()) {
        const { error } = prepareCurve(curve.points);
        if (error !== undefined) throw new Error(`curves[${i}].points${error}`);
      }
      const latest = revisions[0];
      if (revisions.some((entry, i) => i > 0 && entry.rev >= revisions[i - 1].rev)) {
        throw new Error("revisions: list each revision letter once, in descending order.");
      }
      if (revision !== latest.rev) {
        throw new Error(`revision: cover revision ${revision} must match the newest revision (${latest.rev}).`);
      }
      if (date && latest.date && date !== latest.date) {
        throw new Error(`date: cover month ${date} must match the newest revision's month (${latest.date}).`);
      }
      return renderDatasheet(values);
    },
  });
}

export default datasheet(brand);
