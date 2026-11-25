import StripeInvoice from "../template";

export const meta = { label: "Workshop series" };

export default function WorkshopSeries() {
  return (
    <StripeInvoice
      number="F7K2Q9LM-0042"
      issued="October 12"
      due="November 11"
      billTo={{
        name: "Marlow Street Cooperative",
        address: ["Suite 300", "210 Marlow Street", "Austin, TX 78701"],
        email: "accounts.payable@marlowstreetcooperative.example",
        taxId: "US EIN 74-2918830",
      }}
      payLink="https://stripe.com/invoices/pay/F7K2Q9LM-0042"
      lines={[
        { description: "Facilitation, four half-day workshops", period: "Oct 3 – Oct 24", quantity: 4, unitPrice: 380 },
        { description: "Workshop planning calls with the steering group", period: "Sep 19 – Sep 30", quantity: 3, unitPrice: 90 },
        { description: "Workbooks, printed and bound", quantity: 24, unitPrice: 12.5 },
        { description: "Facilitator's guide for running the sessions again", quantity: 1, unitPrice: 240 },
        { description: "Venue hire", period: "Oct 3 – Oct 24", quantity: 4, unitPrice: 45 },
        { description: "Lunch and coffee for each session", period: "Oct 3 – Oct 24", quantity: 4, unitPrice: 160 },
        { description: "Recording and transcripts of each session", quantity: 4, unitPrice: 35 },
        { description: "Follow-up survey and summary report", quantity: 1, unitPrice: 300 },
      ]}
      discounts={[{ label: "Cooperative member (10% off)", amount: 359 }]}
      taxes={[{ label: "Sales tax on printed goods (8.25%)", amount: 44.55 }]}
    />
  );
}
