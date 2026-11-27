import Datasheet from "../template";

export const meta = { label: "WR-4 six-axis motion sensor" };

const values = {
  part: "WR-4",
  name: "Motion sensor",
  revision: "A",
  date: "September",
  summary: "A six-axis gyroscope and accelerometer on a 30 × 22 mm board, read over I²C or SPI.",
  highlights: [
    { value: "±2000 °/s", label: "Gyroscope, full scale" },
    { value: "±16 g", label: "Accelerometer, full scale" },
    { value: "0.9 mA", label: "Both sensors running" },
    { value: "6.4 kHz", label: "Fastest output rate" },
  ],
  features: [
    "Three-axis gyroscope and three-axis accelerometer on one clock",
    "Trimmed in the factory: ±0.5 °/s and ±20 mg offsets at 25 °C",
    "Runs from 2.4 to 5.5 V; logic stays at 3.3 V",
    "I²C at up to 1 MHz, or SPI at up to 10 MHz",
    "Two interrupt pins: data ready, motion and free fall",
    "Ten castellated pads on two edges, and four M2.5 holes",
  ],
  applications: [
    "Drones and model aircraft",
    "Gait and posture logging",
    "Vibration monitoring",
    "Camera stabilisers",
  ],
  description: "WR-4 measures rotation on three axes and acceleration on three more, and stamps every sample from one clock so the two line up. Read it over I²C or SPI. Its two interrupts can wake a host on motion or free fall, so the host can sleep the rest of the time.",
  board: { width: 30, height: 22, thickness: 1.6, parts: 1, hole: 2.7, edges: "two" },
  pins: [
    { name: "VIN", type: "Power", description: "Supply, 2.4 to 5.5 V." },
    { name: "GND", type: "Ground", description: "Ground." },
    { name: "SCL", type: "Input", description: "I²C clock, or SPI clock. Pull up to 3.3 V for I²C.", pullUp: true },
    { name: "SDA", type: "I/O", description: "I²C data, or SPI data in. Pull up to 3.3 V for I²C.", pullUp: true },
    { name: "SDO", type: "Output", description: "SPI data out. In I²C it sets the address: 0x68 low, 0x69 high." },
    { name: "CS", type: "Input", description: "SPI chip select, active low. Held high on the board for I²C." },
    { name: "INT1", type: "Output", description: "Interrupt 1: data ready, or motion." },
    { name: "INT2", type: "Output", description: "Interrupt 2: free fall, or the FIFO full." },
    { name: "FSYNC", type: "Input", description: "Frame sync from a camera. Tie to GND if unused." },
    { name: "GND", type: "Ground", description: "Ground." },
  ],
  ratings: [
    { parameter: "Supply voltage", symbol: "V_IN", min: "−0.3", max: "6.0", unit: "V" },
    { parameter: "Voltage on any signal pin", symbol: "V_IO", min: "−0.3", max: "3.6", unit: "V" },
    { parameter: "Mechanical shock, 0.2 ms", symbol: "a_MAX", max: "10 000", unit: "g" },
    { parameter: "Operating temperature", symbol: "T_A", min: "−40", max: "85", unit: "°C" },
    { parameter: "Storage temperature", symbol: "T_STG", min: "−40", max: "125", unit: "°C" },
    { parameter: "Electrostatic discharge, human body model", symbol: "V_ESD", max: "±2", unit: "kV" },
  ],
  characteristics: [
    { group: "Gyroscope", parameter: "Full scale", symbol: "FS_G", conditions: "Selectable", min: "±125", max: "±2000", unit: "°/s" },
    { group: "Gyroscope", parameter: "Zero-rate offset", symbol: "ZRO", conditions: "25 °C", typ: "±0.5", max: "±1.5", unit: "°/s" },
    { group: "Gyroscope", parameter: "Sensitivity error", conditions: "25 °C", typ: "±0.4", max: "±1.0", unit: "%" },
    { group: "Gyroscope", parameter: "Noise, rms", conditions: "100 Hz bandwidth", typ: "0.04", unit: "°/s" },
    { group: "Accelerometer", parameter: "Full scale", symbol: "FS_A", conditions: "Selectable", min: "±2", max: "±16", unit: "g" },
    { group: "Accelerometer", parameter: "Offset", conditions: "25 °C", typ: "±20", max: "±50", unit: "mg" },
    { group: "Accelerometer", parameter: "Noise, rms", conditions: "100 Hz bandwidth", typ: "0.8", unit: "mg" },
    { group: "Supply", parameter: "Supply voltage", symbol: "V_IN", min: "2.4", typ: "3.3", max: "5.5", unit: "V" },
    {
      group: "Supply",
      parameter: "Current, both running",
      symbol: "I_DD",
      conditions: "1.6 kHz output rate",
      typ: "0.9",
      max: "1.2",
      unit: "mA",
    },
    { group: "Supply", parameter: "Current, asleep", symbol: "I_SLP", typ: "6", max: "12", unit: "µA" },
    { group: "Interface", parameter: "I²C clock", symbol: "f_SCL", max: "1000", unit: "kHz" },
    { group: "Interface", parameter: "SPI clock", symbol: "f_SCK", max: "10", unit: "MHz" },
    {
      group: "Interface",
      parameter: "Start-up time",
      symbol: "t_ST",
      conditions: "Power on to first sample",
      typ: "35",
      max: "50",
      unit: "ms",
    },
  ],
  characteristicsNote: "Limits are guaranteed by design and characterisation.",
  curves: [
    {
      title: "Gyroscope offset",
      x: "Temperature, °C",
      y: "Offset, °/s",
      points: [
        { x: -40, typ: -0.6, limit: 2.5 },
        { x: -20, typ: -0.35, limit: 2 },
        { x: 0, typ: -0.12, limit: 1.6 },
        { x: 25, typ: 0, limit: 1.5 },
        { x: 50, typ: 0.1, limit: 1.6 },
        { x: 70, typ: 0.28, limit: 2 },
        { x: 85, typ: 0.5, limit: 2.4 },
      ],
    },
    {
      title: "Accelerometer offset",
      x: "Temperature, °C",
      y: "Offset, mg",
      points: [
        { x: -40, typ: 18, limit: 80 },
        { x: -20, typ: 11, limit: 65 },
        { x: 0, typ: 5, limit: 55 },
        { x: 25, typ: 0, limit: 50 },
        { x: 50, typ: -4, limit: 55 },
        { x: 70, typ: -9, limit: 65 },
        { x: 85, typ: -14, limit: 75 },
      ],
    },
  ],
  i2c: {
    mode: "Fast-mode Plus",
    pullUpOhms: 1000,
    busCapacitancePf: 100,
    notes: [
      "WR-4 answers at 0x68 with SDO low and at 0x69 with SDO high. The board holds CS high, so it starts in I²C.",
    ],
  },
  application: [
    "Put C1 within 5 mm of VIN, between VIN and GND.",
    "Mount WR-4 flat and rigid: foam or a loose screw passes vibration straight into the readings.",
  ],
  ordering: [
    { part: "WR-4-A", description: "WR-4, revision A, castellated pads", pack: "Tray of 50" },
    { part: "WR-4-A-H", description: "WR-4 with two 5-way 2.54 mm headers fitted", pack: "Bag of 10" },
  ],
  revisions: [
    { rev: "A", date: "September", changes: "First release." },
  ],
} satisfies Parameters<typeof Datasheet>[0];

export default function Wr4() {
  return <Datasheet {...values} />;
}
