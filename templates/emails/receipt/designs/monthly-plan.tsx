import Receipt from "../template";

export const meta = { label: "Monthly plan" };

export default function MonthlyPlan() {
  return (
    <Receipt
      paidOn="March 4"
      method="Visa ending 4242"
      number="R-20418"
      items={[
        { description: "Pro plan, monthly", amount: 24 },
        { description: "Extra seats × 3", amount: 24 },
      ]}
    />
  );
}
