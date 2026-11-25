import AppleReceipt from "../template";

export const meta = { label: "Monthly subscription" };

export default function Monthly() {
  return (
    <AppleReceipt
      preview="Your Apple receipt: Lumen Pro (Monthly), $14.99"
      account="alan.mercer@example.com"
      invoiceDate="18 Jan"
      orderId="ML4F5L8522"
      documentNo="186623754793"
      billedTo={{ payment: "Visa .... 7461", name: "Alan Mercer", address: ["2125 Chestnut St", "San Francisco, CA 94123", "USA"] }}
      items={[
        {
          icon: { src: "https://hyperelements.dev/generated/gallery/assets/companies/apple/app-icon.png", width: 120, height: 120 },
          name: "Lumen: Photo Journal",
          plan: "Lumen Pro (Monthly)",
          renews: "Renews Aug 20",
          price: 14.99,
        },
      ]}
    />
  );
}
