import OrderConfirmation from "../template";

export const meta = { label: "Notebook and pen" };

export default function NotebookAndPen() {
  return (
    <OrderConfirmation
      order="10482"
      placedOn="March 9"
      firstName="Ada"
      items={[
        { name: "Field notebook, dot grid", quantity: 2, price: 14 },
        { name: "Brass pen", quantity: 1, price: 38 },
      ]}
      shipTo={{ name: "Ada Park", lines: ["48 Harbor Road", "Portland, OR 97209"] }}
      orderLink="https://orbit.example/orders/10482"
    />
  );
}
