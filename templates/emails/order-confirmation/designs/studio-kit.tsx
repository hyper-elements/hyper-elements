import OrderConfirmation from "../template";

export const meta = { label: "Studio kit, no name on file, shipped abroad" };

export default function StudioKit() {
  return (
    <OrderConfirmation
      order="11907"
      placedOn="October 21"
      items={[
        { name: "Desk lamp, warm white", quantity: 1, price: 84 },
        { name: "Linen desk mat, large", quantity: 1, price: 46 },
        { name: "Cable clips, set of six", quantity: 3, price: 9 },
      ]}
      shippingCost={12}
      discount={{ label: "Welcome code, 10% off", amount: -15.7 }}
      taxes={[{ label: "VAT, 20%", amount: 28.26 }]}
      shipTo={{ name: "Juno Marlow", lines: ["7 Orchard Lane", "Unit 3", "Bristol", "BS1 4DJ", "United Kingdom"] }}
      orderLink="https://orbit.example/orders/11907"
    />
  );
}
