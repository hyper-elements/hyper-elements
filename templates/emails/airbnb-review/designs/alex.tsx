import AirbnbReview from "../template";

export const meta = { label: "Alex's review" };

export default function Alex() {
  return (
    <AirbnbReview
      reviewer={{ name: "Alex", photo: { src: "https://hyperelements.dev/generated/gallery/assets/companies/airbnb/reviewer.jpg", width: 225, height: 225 } }}
      review="Alan was a great guest! Easy communication, the apartment was left in great condition, very polite, and respectful of all house rules. He’s welcome back anytime and would easily recommend him to any host!"
      reply="https://www.airbnb.com/messages"
    />
  );
}
