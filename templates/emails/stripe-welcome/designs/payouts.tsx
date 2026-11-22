import StripeWelcome from "../template";

export const meta = { label: "Payouts turned on" };

export default function Payouts() {
  return (
    <StripeWelcome
      subject="Your payouts are turned on"
      preview="Your bank account is verified, so your balance now pays out on your schedule"
      intro={[
        "Your bank account is verified. From now on, your available balance is paid out to it automatically, on the schedule you choose.",
        "You can follow each payout, and the payments it includes, from your dashboard.",
      ]}
      button={{ label: "View your payouts", href: "https://stripe.com/dashboard/payouts" }}
      paragraphs={[
        [
          { text: "Payouts are made every business day to start with. To be paid weekly or monthly instead, change your " },
          { text: "payout schedule", href: "https://stripe.com/dashboard/settings/payouts" },
          { text: "." },
        ],
        [
          { text: "Payout timing", href: "https://stripe.com/docs/payouts" },
          { text: " depends on your bank: most payouts arrive within two business days. You can " },
          { text: "pause payouts", href: "https://stripe.com/docs/payouts/pause" },
          { text: " when you need to, or send an " },
          { text: "instant payout", href: "https://stripe.com/docs/payouts/instant" },
          { text: " that arrives in minutes." },
        ],
        [
          { text: "Each payout shows up on your bank statement with the description you set in your " },
          { text: "statement settings", href: "https://stripe.com/dashboard/settings/statement" },
          { text: "." },
        ],
        [
          { text: "Questions about a payout? You can find answers and get in touch with us on our " },
          { text: "support site", href: "https://stripe.com/support" },
          { text: "." },
        ],
      ]}
    />
  );
}
