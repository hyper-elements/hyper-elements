import Ticket from "../template";

export const meta = { label: "Build Day" };

export default function BuildDay() {
  return <Ticket event="Build Day" date="May 14" holder="Ada Park" doorsOpen="9:00 AM" venue="The Foundry, 120 Mill Street, Pittsburgh" code="BD-4821-K7" />;
}
