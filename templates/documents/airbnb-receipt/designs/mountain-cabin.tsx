import AirbnbReceipt from "../template";

export const meta = { label: "Mountain cabin" };

export default function MountainCabin() {
  return (
    <AirbnbReceipt
      receiptId="RCQ72WTN5B"
      date="January 9"
      city="Asheville"
      listing="Cedar cabin with a wood stove and a mountain view, entire cabin hosted by Marisol"
      checkIn="Feb 13"
      checkout="Feb 20"
      guests="4 adults, 1 child, 1 pet"
      confirmationCode="HMB8PZ3LQE"
      prices={[
        { label: "$212.00 x 7 nights", amount: 1484 },
        { label: "Weekly stay discount", amount: -148.4 },
        { label: "Early booking discount", amount: -66.78 },
        { label: "Cleaning fee", amount: 95 },
        { label: "Pet fee", amount: 40 },
        { label: "Firewood bundle, picked up on arrival", amount: 25 },
        { label: "Service fee", amount: 201.65 },
        { label: "North Carolina sales tax", amount: 92.5 },
        { label: "Buncombe County occupancy tax", amount: 85.02 },
      ]}
      paidWith="Mastercard •••• 2209, January 9"
      cancellation="strict"
    />
  );
}
