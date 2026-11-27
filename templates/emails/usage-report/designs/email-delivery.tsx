import UsageReport from "../template";

export const meta = { label: "Email delivery over the Dispatch limit" };

export default function EmailDelivery() {
  return (
    <UsageReport
      workspace="Fieldnote Supply"
      month="June"
      yearsAgo={1}
      unit={{ singular: "email", plural: "emails" }}
      metricLabel="Emails sent"
      daily={[
        34_900, 36_720, 39_081, 40_490, 42_760, 21_300, 20_612,
        43_567, 45_200, 48_010, 48_860, 50_600, 25_300, 22_800,
        47_780, 49_830, 51_300, 53_700, 55_400, 25_400, 24_100,
        52_200, 53_500, 58_800, 81_740, 54_600, 29_200, 26_600,
        55_800, 57_300,
      ]}
      previousTotal={1_189_000}
      planName="Dispatch"
      planLimit={1_000_000}
      breakdownTitle="Top senders"
      breakdown={[
        { name: "Order confirmations", count: 448_362 },
        { name: "Warehouse dispatch and returns", count: 313_278 },
        { name: "Account notifications", count: 220_018 },
        { name: "Password reset", count: 109_032 },
      ]}
      usageUrl="https://orbit.example/fieldnote/usage"
      planUrl="https://orbit.example/fieldnote/plan"
    />
  );
}
