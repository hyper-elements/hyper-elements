import AppleReceipt from "../template";

export const meta = { label: "Yearly plan and a filter pack" };

export default function YearlyAndPack() {
  return (
    <AppleReceipt
      preview="Your Apple receipt: Lumen Pro (Yearly) and the Film Filters pack, $110.75"
      account="ines.carvalho@example.com"
      invoiceDate="3 Oct"
      orderId="MQ7T2K9041"
      documentNo="204518837260"
      billedTo={{ payment: "Mastercard .... 0318", name: "Ines Carvalho", address: ["48 Harbor Lane", "Portland, ME 04101", "USA"] }}
      items={[
        {
          icon: { src: "https://hyperelements.dev/generated/gallery/assets/companies/apple/app-icon.png", width: 120, height: 120 },
          name: "Lumen: Photo Journal",
          plan: "Lumen Pro (Yearly)",
          renews: "Renews Oct 3",
          price: 99.99,
        },
        {
          icon: { src: "https://hyperelements.dev/generated/gallery/assets/companies/apple/app-icon.png", width: 120, height: 120 },
          name: "Lumen: Photo Journal",
          plan: "Film Filters pack",
          price: 4.99,
        },
      ]}
      taxes={[{ label: "Sales tax (5.5%)", amount: 5.77 }]}
      offer={false}
    />
  );
}
