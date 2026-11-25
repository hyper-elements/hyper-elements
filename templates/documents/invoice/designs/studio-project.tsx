import Invoice from "../template";

export const meta = { label: "Studio project" };

export default function StudioProject() {
  return (
    <Invoice
      number="INV-0592"
      billedTo={{
        name: "Lumen & Hale Architects",
        address: ["Unit 4, The Sawmill", "17 Canal Street", "Leeds LS1 4BR", "United Kingdom"],
        taxId: "VAT GB 284 6619 03",
      }}
      poNumber="PO-77310"
      issued="October 6"
      due="November 5"
      lines={[
        { description: "Discovery interviews with partners and project leads", quantity: 4, unitPrice: 320 },
        { description: "Brand workshop, two days on site in Leeds", quantity: 2, unitPrice: 1400 },
        { description: "Competitor and peer review, written up", quantity: 1, unitPrice: 850 },
        { description: "Logo and wordmark, three routes to one", quantity: 1, unitPrice: 3600 },
        { description: "Type and color guidelines", quantity: 1, unitPrice: 1950 },
        { description: "Stationery: letterhead, cards and compliment slips", quantity: 1, unitPrice: 720 },
        { description: "Drawing sheet and title block templates", quantity: 1, unitPrice: 540 },
        { description: "Presentation template, sixteen layouts", quantity: 1, unitPrice: 980 },
        { description: "Website design, home and four pages", quantity: 5, unitPrice: 720 },
        { description: "Project pages, a layout for each kind of building", quantity: 3, unitPrice: 480 },
        { description: "Website build and content entry", quantity: 1, unitPrice: 4200 },
        { description: "Photography, half day at the Kirkstall library", quantity: 1, unitPrice: 650 },
        { description: "Photography, half day at the studio", quantity: 1, unitPrice: 650 },
        { description: "Photo retouching and color grading, per image", quantity: 36, unitPrice: 18 },
        { description: "Signage for the studio entrance, design only", quantity: 1, unitPrice: 600 },
        { description: "Award submission boards", quantity: 2, unitPrice: 275 },
        { description: "Revisions after the partners' review", quantity: 6, unitPrice: 95 },
        { description: "Printing, proofs and couriers, at cost", quantity: 1, unitPrice: 312.4 },
        { description: "Travel to Leeds, rail at cost", quantity: 3, unitPrice: 86.5 },
        { description: "Credit for the cancelled second workshop day", quantity: 1, unitPrice: -700 },
      ]}
      taxes={[{ label: "VAT (20%)", amount: 5099.98 }]}
      note="Thank you for working with us again. The final brand files are in the shared folder; the website handover follows once this invoice is paid."
      payLink="https://orbit.example/billing/INV-0592"
    />
  );
}
