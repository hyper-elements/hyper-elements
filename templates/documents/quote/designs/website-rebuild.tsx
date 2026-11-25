import Quote from "../template";

export const meta = { label: "Website rebuild" };

export default function WebsiteRebuild() {
  return (
    <Quote
      number="Q-0388"
      preparedFor={{ name: "Hearth & Crumb Bakery", address: ["9 Weaver's Yard", "Asheville, NC 28801"] }}
      issued="September 15"
      validUntil="October 15"
      lines={[
        { description: "Discovery and site map", detail: "A morning at the bakery with the team, then a map of every page and what it's for", quantity: 1, unitPrice: 1200 },
        { description: "Page designs, desktop and phone", detail: "Two rounds of changes on each page", quantity: 6, unitPrice: 450 },
        { description: "Menu and price list you can edit", quantity: 1, unitPrice: 900 },
        { description: "Online ordering for pickup", detail: "Orders by the dozen, pickup times by the half hour, and a daily cutoff", quantity: 1, unitPrice: 2400 },
        { description: "Photography, a morning of the bakes", quantity: 1, unitPrice: 650 },
        { description: "Moving the old site's recipes and posts", detail: "About forty pages, with their links kept", quantity: 40, unitPrice: 12 },
        { description: "Hosting and care plan, first quarter", quantity: 3, unitPrice: 120 },
      ]}
      taxes={[{ label: "Sales tax (7%)", amount: 608.3 }]}
      terms="50% deposit"
    />
  );
}
