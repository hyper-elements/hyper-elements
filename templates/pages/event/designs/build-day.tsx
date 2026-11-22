import Event from "../template";

export const meta = { label: "Build Day" };

export default function BuildDay() {
  return (
    <Event
      name="Build Day"
      tagline="A day of talks and workshops for the people who build and ship software."
      date="May 14"
      time="9:30 AM to 6:00 PM"
      venue="The Foundry"
      address={["120 Mill Street", "Pittsburgh"]}
      tickets="Free, with lunch"
      registerLink="https://orbit.example/events/build-day"
      schedule={[
        { time: "9:30 AM", title: "Doors open, coffee and breakfast" },
        { time: "10:00 AM", title: "Opening talk: shipping weekly without breaking anything" },
        { time: "11:30 AM", title: "Lightning talks" },
        { time: "1:00 PM", title: "Workshops, in four rooms" },
        { time: "5:00 PM", title: "Closing panel, then drinks on the roof" },
      ]}
      speakers={[
        { name: "Rosa Lindqvist", role: "Staff engineer, Northwind", talk: "Shipping weekly without breaking anything" },
        { name: "Dev Okafor", role: "Design lead, Fieldnote", talk: "Design systems people actually use" },
        { name: "Mei Tanaka", role: "Founder, Lattice", talk: "What we learned from a year of open source" },
      ]}
    />
  );
}
