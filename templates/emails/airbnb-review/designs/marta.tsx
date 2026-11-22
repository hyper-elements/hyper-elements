import AirbnbReview from "../template";

export const meta = { label: "Marta's review" };

export default function Marta() {
  return (
    <AirbnbReview
      reviewer={{ name: "Marta" }}
      review={
        "Jonah and his two friends were lovely guests for a long weekend. They kept me posted on their arrival, left the kitchen spotless, and even watered the herbs on the balcony.\n\nThey asked good questions about the neighborhood before they came, and left a kind note in the guest book. Happy to host them again."
      }
      reply="https://www.airbnb.com/messages/thread-4417"
    />
  );
}
