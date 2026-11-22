import StripeInvoice from "../template";

export const meta = { label: "Growth plan" };

export default function GrowthPlan() {
  return (
    <StripeInvoice
      number="A1B2C3D4-0017"
      issued="March 1"
      due="March 31"
      billTo={{ name: "Northwind Traders", address: ["48 Harbor Road", "Portland, OR 97209"], email: "ap@northwind.example" }}
      payLink="https://stripe.com/invoices/pay/A1B2C3D4-0017"
      lines={[
        { description: "Growth plan", period: "Mar 1 – Mar 31", quantity: 1, unitPrice: 299 },
        { description: "Additional seats", period: "Mar 1 – Mar 31", quantity: 4, unitPrice: 15 },
        { description: "Usage: API calls over plan", period: "Billed in arrears", quantity: 1900, unitPrice: 0.01 },
      ]}
    />
  );
}
