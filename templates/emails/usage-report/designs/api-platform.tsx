import UsageReport from "../template";

export const meta = { label: "API requests approaching the Scale limit" };

export default function ApiPlatform() {
  return (
    <UsageReport
      workspace="Northwind Labs"
      month="October"
      yearsAgo={1}
      unit={{ singular: "request", plural: "requests" }}
      metricLabel="API requests"
      daily={[
        1_245_000, 1_516_000, 1_084_000, 892_000, 1_414_000, 1_605_000, 1_738_000,
        1_573_000, 1_722_000, 963_000, 1_019_000, 1_406_000, 1_687_000, 1_805_000,
        1_612_000, 1_945_000, 1_135_000, 1_082_000, 1_738_000, 1_953_000, 1_785_000,
        1_939_000, 2_421_000, 1_188_000, 1_078_000, 1_747_000, 1_832_000, 2_061_000,
        1_936_000, 1_865_000, 1_214_000,
      ]}
      previousTotal={43_047_000}
      planName="Scale"
      planLimit={60_000_000}
      breakdownTitle="Top endpoints"
      breakdown={[
        { name: "/v1/events", count: 18_740_618 },
        { name: "/v1/resolve", count: 11_369_082 },
        { name: "/v1/tokens", count: 7_803_154 },
        { name: "/v1/projects", count: 4_221_703 },
      ]}
      performanceTitle="Gateway performance"
      performance={[
        { label: "Median latency", value: 42, previous: 39, unit: "ms", better: "lower" },
        { label: "P95 latency", value: 118, previous: 126, unit: "ms", better: "lower" },
        { label: "Cache hit rate", value: 96.4, previous: 94.8, unit: "%", better: "higher" },
      ]}
      usageUrl="https://orbit.example/northwind/usage"
      planUrl="https://orbit.example/northwind/plan"
    />
  );
}
