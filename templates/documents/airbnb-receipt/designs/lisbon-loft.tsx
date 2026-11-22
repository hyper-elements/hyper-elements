import AirbnbReceipt from "../template";

export const meta = { label: "Lisbon loft" };

export default function LisbonLoft() {
  return (
    <AirbnbReceipt
      receiptId="RCMJ9HJ4K2"
      date="March 18"
      city="Lisbon"
      listing="Sunny loft with a view of the river, entire rental unit hosted by Inês"
      checkIn="Apr 3"
      checkout="Apr 6"
      guests="2 adults"
      confirmationCode="HMXK4RT2ZQ"
      prices={[
        { label: "$148.00 x 3 nights", amount: 444 },
        { label: "Cleaning fee", amount: 65 },
        { label: "Service fee", amount: 71.86 },
        { label: "Occupancy taxes", amount: 52.18 },
      ]}
      paidWith="Visa •••• 7461, March 18"
      cancellation="flexible"
    />
  );
}
