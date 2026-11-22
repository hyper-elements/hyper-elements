import Shipping from "../template";

export const meta = { label: "Studio kit" };

export default function StudioKit() {
  return (
    <Shipping
      order="11907"
      arrivesBy="October 24"
      carrier="Northline Freight"
      trackingNumber="NLF-4471-0093-2218"
      trackingLink="https://orbit.example/orders/11907/track"
      items={[
        { name: "Desk lamp, warm white", quantity: 1 },
        { name: "Linen desk mat, large", quantity: 1 },
        { name: "Cable clips, set of six", quantity: 3 },
      ]}
    />
  );
}
