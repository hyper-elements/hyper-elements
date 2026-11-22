import Invoice from "../template";

export const meta = { label: "Onboarding workshop, overdue, with a credit" };

export default function Workshop() {
  return (
    <Invoice
      number="INV-0522"
      customer="Harbor & Pine Studio"
      status="overdue"
      dueOn="November 15"
      lines={[
        { description: "Onboarding workshop, two days", amount: 1600 },
        { description: "Workspace setup and migration", amount: 420 },
        { description: "Business plan, November × 4", amount: 120 },
        { description: "Credit for the rescheduled first session", amount: -200 },
      ]}
      payLink="https://orbit.example/billing/INV-0522"
    />
  );
}
