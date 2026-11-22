import Shipping from "../template";

export const meta = { label: "Notebook and pen" };

export default function NotebookAndPen() {
  return (
    <Shipping
      order="10482"
      arrivesBy="March 13"
      carrier="Parcel Post"
      trackingLink="https://orbit.example/orders/10482/track"
      items={[
        { name: "Field notebook, dot grid", quantity: 2 },
        { name: "Brass pen", quantity: 1 },
      ]}
    />
  );
}
