import Invoice from "../template";

export const meta = { label: "Team plan" };

export default function TeamPlan() {
  return (
    <Invoice
      number="INV-0417"
      customer="Northwind Traders"
      dueOn="March 31"
      attached={true}
      lines={[
        { description: "Team plan, March × 12", amount: 348 },
        { description: "Extra workspaces × 2", amount: 30 },
      ]}
      payLink="https://orbit.example/billing/INV-0417"
    />
  );
}
