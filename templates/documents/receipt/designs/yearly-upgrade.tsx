import Receipt from "../template";

export const meta = { label: "Yearly upgrade" };

export default function YearlyUpgrade() {
  return (
    <Receipt
      number="R-31877"
      paidBy="Fernhill Community Clinic"
      datePaid="August 19"
      paidWith="Mastercard ending 0381"
      lines={[
        { description: "Business plan, yearly", quantity: 1, unitPrice: 2880 },
        { description: "Extra seats, yearly", quantity: 15, unitPrice: 96 },
        { description: "Guest seats for visiting clinicians, yearly", quantity: 4, unitPrice: 48 },
        { description: "Onboarding session, two hours", quantity: 1, unitPrice: 350 },
        { description: "Data import from the old scheduling system", quantity: 1, unitPrice: 600 },
        { description: "Priority support add-on", quantity: 1, unitPrice: 480 },
        { description: "Extra storage, 100 GB, yearly", quantity: 2, unitPrice: 60 },
        { description: "Credit for unused monthly plan", quantity: 1, unitPrice: -112 },
      ]}
      discounts={[{ label: "Nonprofit discount (15%)", amount: 892.5 }]}
      taxes={[{ label: "Sales tax (6.25%)", amount: 316.09 }]}
    />
  );
}
