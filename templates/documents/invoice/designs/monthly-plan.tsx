import Invoice from "../template";

export const meta = { label: "Monthly plan" };

export default function MonthlyPlan() {
  return (
    <Invoice
      number="INV-0417"
      billedTo={{ name: "Northwind Traders", address: ["48 Harbor Road", "Portland, OR 97209"] }}
      issued="March 1"
      due="March 31"
      lines={[
        { description: "Team plan, March", quantity: 12, unitPrice: 29 },
        { description: "Extra workspaces", quantity: 2, unitPrice: 15 },
      ]}
      payLink="https://orbit.example/billing/INV-0417"
    />
  );
}
