import Quote from "../template";

export const meta = { label: "Design system" };

export default function DesignSystem() {
  return (
    <Quote
      number="Q-0213"
      preparedFor={{ name: "Northwind Traders", address: ["48 Harbor Road", "Portland, OR 97209"] }}
      issued="April 2"
      validUntil="May 2"
      lines={[
        { description: "Design system audit", quantity: 1, unitPrice: 4800 },
        { description: "Workshop day, on site", quantity: 2, unitPrice: 1600 },
        { description: "Component library setup", quantity: 1, unitPrice: 6200 },
      ]}
      terms="on start"
    />
  );
}
