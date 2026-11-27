import Datasheet, { wr2 } from "../template";

export const meta = { label: "WR-2 environmental sensor" };

export default function Wr2() {
  return <Datasheet {...wr2} />;
}
