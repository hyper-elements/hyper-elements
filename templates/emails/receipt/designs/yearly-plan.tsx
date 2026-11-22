import Receipt from "../template";

export const meta = { label: "Yearly plan, with a discount and tax" };

export default function YearlyPlan() {
  return (
    <Receipt
      paidOn="September 18"
      method="Mastercard ending 5100"
      number="R-31877"
      items={[
        { description: "Business plan, yearly", amount: 864 },
        { description: "Extra seats × 5", amount: 240 },
        { description: "Priority support, yearly", amount: 60 },
      ]}
      discounts={[{ label: "Yearly plan, 10% off the business plan", amount: -86.4 }]}
      taxes={[{ label: "Sales tax, 8%", amount: 86.21 }]}
    />
  );
}
