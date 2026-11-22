import Ticket from "../template";

export const meta = { label: "Product Summit" };

export default function ProductSummit() {
  return (
    <Ticket
      event="Spring Product Summit and Design Leadership Day"
      date="April 22–23"
      holder="Jordan Okafor"
      doorsOpen="8:30 AM each day"
      venue="Harbor Hall, 2 Pier Road, Baltimore"
      code="PS-0937-Q2"
      qr={{ src: "https://hyperelements.dev/generated/gallery/assets/images/ticket-qr.png", width: 348, height: 348 }}
    />
  );
}
