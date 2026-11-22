import Receipt from "../template";

export const meta = { label: "Monthly plan" };

export default function MonthlyPlan() {
  return (
    <Receipt
      number="R-20418"
      paidBy="Northwind Traders"
      datePaid="March 4"
      paidWith="Visa ending 4242"
      lines={[
        { description: "Pro plan, monthly", quantity: 1, unitPrice: 24 },
        { description: "Extra seats", quantity: 3, unitPrice: 8 },
      ]}
    />
  );
}
