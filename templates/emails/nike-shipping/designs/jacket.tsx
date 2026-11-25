import NikeShipping from "../template";

export const meta = { label: "A jacket, shipped" };

const ASSETS = "https://hyperelements.dev/generated/gallery/assets/companies/nike/";

export default function Jacket() {
  return (
    <NikeShipping
      subject="Your jacket has shipped."
      preview="Your jacket is on the way: track it, and see when it should arrive"
      headline="Your Jacket Has Shipped."
      message={["Your order left our warehouse today. Use the link above to follow it to your door."]}
      trackingNumber="1ZW604215501882390"
      trackingLink="https://www.nike.com/orders/track"
      carrier="UPS"
      arrives="Mar 8–9"
      shipTo={{ name: "Priya Lindqvist", address: ["77 Alder Road, Unit 4", "Austin, TX 78704", "USA"] }}
      items={[
        {
          image: { src: `${ASSETS}pick-4.jpg`, width: 320, height: 400 },
          name: "FFF Women's Soccer Jacket",
          details: "Size M",
          link: "https://www.nike.com/t/fff-soccer-jacket",
        },
      ]}
      orderNumber="C0219448207"
      orderDate="Mar 4"
    />
  );
}
