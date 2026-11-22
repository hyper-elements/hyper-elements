import StripeWelcome from "../template";

export const meta = { label: "Ready for live payments" };

export default function LivePayments() {
  return (
    <StripeWelcome
      subject="Welcome to Stripe"
      preview="You're now ready to make live transactions with Stripe!"
      intro={[
        "Thanks for submitting your account information. You're now ready to make live transactions with Stripe!",
        "You can view your payments and a variety of other information about your account right from your dashboard.",
      ]}
      button={{ label: "View your Stripe Dashboard", href: "https://stripe.com/dashboard" }}
      paragraphs={[
        [
          { text: "If you haven't finished your integration, you might find our " },
          { text: "docs", href: "https://stripe.com/docs/dashboard/basics" },
          { text: " handy." },
        ],
        [
          { text: "Once you're ready to start accepting payments, you'll just need to use your live " },
          { text: "API keys", href: "https://stripe.com/dashboard/apikeys" },
          {
            text: " instead of your test API keys. Your account can simultaneously be used for both test and live requests, so you can continue testing while accepting live payments. Check out our ",
          },
          { text: "tutorial about account basics", href: "https://stripe.com/docs/dashboard/basics" },
          { text: "." },
        ],
        [
          { text: "Finally, we've put together a " },
          { text: "quick checklist", href: "https://stripe.com/docs/get-started/checklist/website" },
          { text: " to ensure your website conforms to card network standards." },
        ],
        [
          { text: "We'll be here to help you with any step along the way. You can find answers to most questions and get in touch with us on our " },
          { text: "support site", href: "https://stripe.com/support" },
          { text: "." },
        ],
      ]}
    />
  );
}
