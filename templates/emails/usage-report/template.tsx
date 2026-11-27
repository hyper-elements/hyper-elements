/** A month of metered usage. The chart, plan, forecast and rankings all use the same daily ledger. */
import { Fragment } from "react";
import { Button, Column, Divider, Email, Heading, Html, Image, Link, Row, Span, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

export const meta = { author: "adityasarade" };

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const maxDaily = 1_000_000_000_000;
const maxMonthly = maxDaily * 31;
const nameField = (label: string, maxLength: number, guidance: string) =>
  prop.text({ label, maxLength, required: true, pattern: "\\S", guidance });

const fields = {
  workspace: nameField("Workspace", 36, "Use the name shown in the customer's account."),
  month: prop.choice(months, { label: "Billing month", required: true, guidance: "Choose the completed UTC calendar month covered by the report." }),
  yearsAgo: prop.number({
    label: "Calendar years back", default: 0, min: 0, max: 100, integer: true,
    guidance: "Use 0 for this UTC calendar year, 1 for last year. This sets weekends and the length of February.",
  }),
  metricLabel: nameField("Headline metric", 36, "Name what you measured, such as API requests or emails sent."),
  unit: prop.object({
    singular: nameField("Singular", 20, "The unit for a quantity of one, such as request."),
    plural: nameField("Plural", 20, "The unit for all other quantities, such as requests."),
  }, { label: "Billing unit", required: true }),
  daily: prop.list(prop.number({ label: "Daily usage", min: 0, max: maxDaily }), {
    label: "Daily usage", required: true, min: 28, max: 31,
    guidance: "Give one count per UTC day in order, including zero for inactive days. Fractional quantities are allowed.",
  }),
  previousTotal: prop.number({ label: "Previous month's total", required: true, min: 0, max: maxMonthly, guidance: "Use the same unit. Enter zero if there was no usage." }),
  planName: nameField("Plan", 24, "Use the name of the workspace's plan."),
  planLimit: prop.number({ label: "Included usage", required: true, min: 0.000001, max: maxMonthly, guidance: "The monthly allowance in the same unit as daily usage." }),
  breakdownTitle: nameField("Breakdown heading", 36, "Name the groups being ranked, such as Top endpoints."),
  breakdown: prop.list(prop.object({
    name: nameField("Group name", 48, "Give each group a distinct route, service or sender name."),
    count: prop.number({ label: "Group usage", required: true, min: 0, max: maxMonthly, guidance: "Usage attributable to this group in the billing month." }),
  }, { label: "Group" }), { label: "Breakdown", max: 5, guidance: "Use non-overlapping groups. Together they may account for all or part of the total." }),
  performanceTitle: prop.text({ label: "Performance heading", maxLength: 36, guidance: "Optionally name the performance section." }),
  performance: prop.list(prop.object({
    label: nameField("Measure", 24, "Name the measure, such as Median latency."),
    value: prop.number({ label: "Current value", required: true, min: -maxDaily, max: maxDaily, guidance: "Use the month's measured value." }),
    unit: nameField("Measure unit", 8, "Use ms for milliseconds or % for percentages."),
    previous: prop.number({ label: "Previous value", min: -maxDaily, max: maxDaily, guidance: "Include last month's value to show the change. Percentage changes are in points." }),
    better: prop.choice(["higher", "lower"], { label: "Better direction", default: "lower", guidance: "Choose lower for latency or higher for uptime." }),
  }, { label: "Performance measure" }), { label: "Performance", max: 3, guidance: "Include up to three measures or leave this section out." }),
  usageUrl: prop.link({ label: "Usage dashboard", required: true, guidance: "Link to the workspace's full usage report on the brand's site." }),
  planUrl: prop.link({ label: "Plan settings", required: true, guidance: "Link to the workspace's plan and upgrade options on the brand's site." }),
};

type QuantityUnit = { singular: string; plural: string };

const exact = new Intl.NumberFormat("en", { maximumSignificantDigits: 15 });
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumSignificantDigits: 3 });
const decimal = new Intl.NumberFormat("en", { maximumSignificantDigits: 3 });
const scientific = new Intl.NumberFormat("en", { notation: "scientific", maximumSignificantDigits: 3 });
const percent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 });

function formatNumber(value: number) {
  const magnitude = Math.abs(value);
  if (magnitude >= 1e15 || (magnitude > 0 && magnitude < 0.001)) return scientific.format(value);
  return magnitude >= 999.5 ? compact.format(value) : decimal.format(value);
}

// Daily quantities can be fractional. Drop rounding noise before comparing them with a plan limit.
function normalize(value: number) {
  return Number(value.toPrecision(15));
}

function sumUsage(values: readonly number[]) {
  return normalize(values.reduce((sum, value) => sum + value, 0));
}

function monthlyUsage(daily: readonly number[], items: readonly { name: string; count: number }[]) {
  const names = new Set<string>();
  for (const [index, { name, count }] of items.entries()) {
    const field = `breakdown[${index}]`;
    if (names.has(name.trim())) throw new RangeError(`${field}.name: duplicate breakdown name “${name}”.`);
    names.add(name.trim());
    if (!Number.isFinite(count) || count < 0) throw new RangeError(`${field}.count: expected finite, nonnegative usage.`);
  }

  // Compare in common decimal units so 0.1 + 0.2 equals 0.3 and a small overage still counts.
  const parts = [...daily, ...items.map(({ count }) => count)].map((value) => {
    const [mantissa, power] = value.toExponential().split("e");
    const [whole, fraction = ""] = mantissa.split(".");
    return { digits: BigInt(whole + fraction), power: Number(power) - fraction.length };
  });
  const power = Math.min(...parts.map((part) => part.power));
  const units = parts.map((part) => part.digits * 10n ** BigInt(part.power - power));
  const total = units.slice(0, daily.length).reduce((sum, count) => sum + count, 0n);
  const asNumber = (count: bigint) => Number(`${count}e${power}`);
  const breakdown = units.slice(daily.length);
  const oversized = breakdown.findIndex((count) => count > total);
  if (oversized >= 0) throw new RangeError(`breakdown[${oversized}].count: ${items[oversized].count} exceeds the month's total of ${asNumber(total)}.`);
  const subtotal = breakdown.reduce((sum, count) => sum + count, 0n);
  if (subtotal > total) throw new RangeError(`breakdown: the counts combined exceed the month's total of ${asNumber(total)}.`);
  return asNumber(total);
}

function quantity(value: number, unit: QuantityUnit, format = formatNumber) {
  return `${format(value)} ${value === 1 ? unit.singular : unit.plural}`;
}

function chartCeiling(peak: number) {
  if (peak === 0) return 1;
  const halfStep = 10 ** Math.floor(Math.log10(peak)) / 2 || peak;
  return Math.ceil(peak / halfStep) * halfStep;
}

function usagePercent(ratio: number) {
  if (ratio < 0.8 && ratio >= 0.7995) return "<80%";
  if (ratio < 1 && ratio >= 0.9995) return "<100%";
  if (ratio > 1 && ratio < 1.0005) return ">100%";
  return ratio >= 10 ? `${formatNumber(ratio * 100)}%` : percent.format(ratio);
}

function billingPeriod(month: typeof months[number], yearsAgo: number) {
  const today = new Date();
  const year = today.getUTCFullYear() - yearsAgo;
  const index = months.indexOf(month);
  if (Date.UTC(year, index, 1) > +today) throw new RangeError(`month: ${month} is a future UTC billing month.`);
  if (year === today.getUTCFullYear() && index === today.getUTCMonth()) throw new RangeError(`month: ${month} is still in progress.`);
  return {
    days: new Date(Date.UTC(year, index + 1, 0)).getUTCDate(),
    firstWeekday: new Date(Date.UTC(year, index, 1)).getUTCDay(),
    previous: months[(index + 11) % 12],
    next: months[(index + 1) % 12],
    nextDays: new Date(Date.UTC(year, index + 2, 0)).getUTCDate(),
  };
}

function forecast(period: ReturnType<typeof billingPeriod>, total: number, limit: number, unit: QuantityUnit) {
  const pace = total / period.days;
  const projection = normalize(pace * period.nextDays);
  if (projection > limit) {
    const crossing = Math.min(period.nextDays, Math.floor(normalize(limit / pace)) + 1);
    return `At this pace, you’ll pass your limit around ${crossing} ${period.next}.`;
  }
  return `At this pace, ${period.next} closes at ${quantity(projection, unit)}, ${usagePercent(projection / limit)} of your limit.`;
}

function monthChange(total: number, previous: number, month: string) {
  if (previous === 0) return `No usage in ${month}`;
  if (total === previous) return `Unchanged from ${month}`;
  const change = Math.abs((total - previous) / previous);
  const amount = change < 0.0005 ? "less than 0.1%" : change >= 10 ? `${formatNumber(change * 100)}%` : percent.format(change);
  return `${total > previous ? "Up" : "Down"} ${amount} from ${month}`;
}

const table = { role: "presentation", width: "100%", cellPadding: 0, cellSpacing: 0, border: 0 } as const;
const cell = { fontSize: 0, lineHeight: 0, msoLineHeightRule: "exactly" } as const;

/** A fixed-layout table keeps the days on one line. Word reads the height and valign attributes
 * even when it drops CSS. Only the nested cell is painted, so shorter bars sit on the same baseline. */
function dailyChart(daily: readonly number[], month: string, firstWeekday: number, unit: QuantityUnit,
  palette: { weekday: string; weekend: string; peak: string; label: string }, height: number, gutter: number, labelSize: number) {
  const high = Math.max(...daily);
  const low = Math.min(...daily);
  const peakDay = daily.indexOf(high);
  const ceiling = chartCeiling(high);
  const date = (i: number) => `${i + 1} ${month}`;
  const weekly: string[] = [];
  for (let i = 0; i < daily.length; i += 7) {
    const end = Math.min(i + 7, daily.length);
    weekly.push(`Days ${i + 1}–${end} totaled ${quantity(sumUsage(daily.slice(i, end)), unit, exact.format)}.`);
  }
  const summary = high === 0 ? `No ${unit.plural} were recorded in ${month}.` :
    `Busiest day was ${date(peakDay)} with ${quantity(high, unit, exact.format)}. Quietest day was ${date(daily.indexOf(low))} with ${quantity(low, unit, exact.format)}.`;
  const story = [summary, ...weekly].join(" ");
  return (
    <Html text={story}>
      <div role="img" aria-label={story}>
        <style>{"#usage-total, #usage-breakdown, #usage-performance, #usage-plan { font-variant-numeric: tabular-nums; }"}</style>
        <table {...table} dir="ltr" style={{ tableLayout: "fixed", borderCollapse: "collapse" }}>
          <tbody><tr>{daily.map((count, i) => {
            const weekday = (firstWeekday + i) % 7;
            const color = i === peakDay ? palette.peak : weekday === 0 || weekday === 6 ? palette.weekend : palette.weekday;
            const bar = Math.max(1, Math.round(height * (count / ceiling)));
            return (
              <td key={i} height={height} valign="bottom" style={{ ...cell, paddingRight: i === daily.length - 1 ? 0 : gutter }}>
                {count > 0 && <table {...table}><tbody><tr>
                  <td height={bar} {...{ bgcolor: color }} style={{ ...cell, height: bar, backgroundColor: color }}>&nbsp;</td>
                </tr></tbody></table>}
              </td>
            );
          })}</tr></tbody>
        </table>
        <table {...table} dir="ltr" style={{ fontSize: labelSize, fontVariantNumeric: "tabular-nums", color: palette.label }}>
          <tbody><tr>
            <td align="left">1 {month}</td>
            <td align="center">{Math.ceil(daily.length / 2)}</td>
            <td align="right">{daily.length} {month}</td>
          </tr></tbody>
        </table>
      </div>
    </Html>
  );
}

/** Both shares are explicit cells, including the excess beyond the allowance. */
function meter(share: number, fill: string, rest: string, height: number) {
  const filled = Number((share * 100).toFixed(4));
  return (
    <Html text="">
      <table {...table} aria-hidden="true" dir="ltr" style={{ tableLayout: "fixed" }}><tbody><tr>
        {filled > 0 && <td width={`${filled}%`} height={height} {...{ bgcolor: fill }} style={{ ...cell, backgroundColor: fill }}>&nbsp;</td>}
        {filled < 100 && <td width={`${100 - filled}%`} height={height} {...{ bgcolor: rest }} style={{ ...cell, backgroundColor: rest }}>&nbsp;</td>}
      </tr></tbody></table>
    </Html>
  );
}

// Pick the darker of the brand's two inks for a consistent chart silhouette, including in dark brands.
function brightness(hex: string) {
  const rgb = Number.parseInt(hex.replace("#", ""), 16);
  return 0.2126 * (rgb >> 16) + 0.7152 * ((rgb >> 8) & 255) + 0.0722 * (rgb & 255);
}

function figureValue(value: number, unit: string) {
  return `${formatNumber(value).replaceAll("-", "−")}${unit === "%" ? "%" : ` ${unit}`}`;
}

export function usageReport(brand: Brand) {
  const colors = brand.theme.colors as Record<string, string>;
  const { xs, sm, md, lg, xl } = brand.theme.spacing as Record<string, number>;
  const { body, small: labelSize } = brand.theme.fontSizes as Record<string, number>;
  const light = brightness(colors.background) > brightness(colors.foreground);
  const plot = light ? colors.foreground : colors.surface;
  const plotText = light ? colors.background : colors.foreground;
  const weekend = light ? colors.border : colors.foreground;
  // The peak in the accent, or the primary where the accent is too close to the other bars to stand out (a pale accent).
  const apart = (c: string) => Math.min(Math.abs(brightness(c) - brightness(colors.muted)), Math.abs(brightness(c) - brightness(weekend)));
  const peakColor = apart(colors.accent) >= apart(colors.primary) ? colors.accent : colors.primary;
  const palette = { weekday: colors.muted, weekend, peak: peakColor, label: plotText };
  const { alt, ...logo } = brand.logo;
  const small = { color: token("colors.muted"), fontSize: token("fontSizes.small") } as const;
  const band = { padding: [lg, xl], gap: sm, mobile: { padding: [md, lg] } } as const;
  const rule = { borderTop: { width: 1, style: "solid", color: token("colors.border") } } as const;
  return template({
    id: "emails.UsageReport",
    version: "1.0.0",
    label: "Monthly usage report",
    description: "A workspace’s daily usage, plan allowance and next-month forecast, with a ranked breakdown and optional performance figures.",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "transactional" }) },
      require: { lint: ["preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains], tags: "deny" },
    },
    example: {
      workspace: "Morrow Works", month: "April", yearsAgo: 1, metricLabel: "API requests", unit: { singular: "request", plural: "requests" },
      daily: [0, 9630, 10574, 11160, 12800, 11620, 1842, 411, 10430, 12460, 40980, 15846, 11912, 1064, 796,
        13970, 11062, 12264, 11685, 10482, 1209, 0, 12377, 13683, 11401, 12616, 10688, 1524, 10470, 10920],
      previousTotal: 332600, planName: "Starter", planLimit: 2000000, breakdownTitle: "Top endpoints",
      breakdown: [{ name: "/v2/schemas/validate", count: 92718 }, { name: "/v2/events", count: 70631 }, { name: "/v2/keys", count: 44122 }],
      usageUrl: `${brand.links.site}/morrow/usage`, planUrl: `${brand.links.site}/morrow/plan`,
    },
    render(v) {
      const period = billingPeriod(v.month, v.yearsAgo);
      if (v.daily.length !== period.days) throw new RangeError(`daily: expected ${period.days} values for ${v.month}, received ${v.daily.length}.`);
      const total = monthlyUsage(v.daily, v.breakdown);
      const ratio = total / v.planLimit;
      const over = total > v.planLimit;
      const status = over ? "Over the limit" : total === v.planLimit ? "Limit reached" : ratio >= 0.8 ? "Approaching limit" : "Within limit";
      const peak = Math.max(...v.daily);
      const included = over ? Math.max(0.01, Math.min(0.99, 1 / ratio)) : ratio;
      const ranked = [...v.breakdown].sort((a, b) => b.count - a.count);
      return (
        <Email width={616} lang={brand.lang ?? "en"} dir={brand.dir} theme={brand.theme} fonts={brand.fonts}
          title={`${brand.name} usage report · ${v.month}`}
          previewText={`${v.workspace} used ${quantity(total, v.unit)} in ${v.month}, ${usagePercent(ratio)} of the ${v.planName} plan.`}
          style={{ backgroundColor: token("colors.background"), color: token("colors.foreground"), fontFamily: token("fonts.body"), lineHeight: token("lineHeights.body") }}>
          <Row stackOnMobile={false} style={{ padding: [md, xl], alignItems: "center", mobile: { padding: [sm, lg] } }}>
            <Column><Image src={logo} alt={alt} style={{ width: body * 7 }} /></Column>
            <Column><Text style={{ ...small, textAlign: "right" }}>Monthly usage report</Text></Column>
          </Row>
          <Column style={band}>
            <Divider style={rule} />
            <Text style={{ ...small, padding: [sm, 0, 0] }}>{v.month} · {v.workspace}</Text>
            <Heading id="usage-total" level={1} style={{ fontFamily: token("fonts.body"), fontSize: body * 4, mobile: { fontSize: body * 3 } }}>{formatNumber(total)}</Heading>
            <Text><Span style={{ fontWeight: 700 }}>{v.metricLabel}</Span> · {monthChange(total, v.previousTotal, period.previous)}</Text>
          </Column>
          <Column style={{ ...band, backgroundColor: plot, color: plotText }}>
            <Heading level={2} style={{ color: plotText }}>{v.unit.plural.charAt(0).toUpperCase() + v.unit.plural.slice(1)} per day</Heading>
            <Text style={{ fontSize: token("fontSizes.small"), color: plotText }}>
              {peak > 0 ? <><Span style={{ backgroundColor: palette.peak }}> </Span> Peak of {formatNumber(peak)} on {v.daily.indexOf(peak) + 1} {v.month}</> : "No usage recorded"}
              {" · "}<Span style={{ backgroundColor: palette.weekend }}> </Span> Weekends
            </Text>
            {dailyChart(v.daily, v.month, period.firstWeekday, v.unit, palette, body * 7, Math.max(1, Math.round(xs / 2)), labelSize)}
          </Column>
          <Column id="usage-plan" style={{ ...band, backgroundColor: token("colors.surface") }}>
            <Heading level={2}>{v.planName} plan</Heading>
            <Text><Span style={{ color: token("colors.primary"), fontWeight: 700 }}>{status}</Span> · {usagePercent(ratio)} used</Text>
            {meter(included, ratio >= 0.8 && !over ? colors.primary : colors.muted, over ? colors.accent : colors.border, sm)}
            <Text style={small}>{formatNumber(total)} of {quantity(v.planLimit, v.unit)} included</Text>
            {over && <Text style={{ fontWeight: 700 }}><Span style={{ backgroundColor: colors.accent }}> </Span> {quantity(normalize(total - v.planLimit), v.unit)} over the limit</Text>}
            <Text>{forecast(period, total, v.planLimit, v.unit)}</Text>
          </Column>
          <Column id="usage-breakdown" style={band}>
            <Heading level={2}>{v.breakdownTitle}</Heading>
            {ranked.length === 0 && <Text style={small}>No breakdown data for this month.</Text>}
            {ranked.map(({ name, count }) => (
              <Fragment key={name}>
                <Text><Span style={{ fontWeight: 700 }}>{name}</Span> · {formatNumber(count)}</Text>
                {meter(total ? count / total : 0, colors.primary, colors.border, xs)}
              </Fragment>
            ))}
          </Column>
          {v.performance.length > 0 && <Column id="usage-performance" style={band}>
            <Divider style={rule} />
            <Heading level={2}>{v.performanceTitle || "Performance"}</Heading>
            {v.performance.some((f) => f.previous !== undefined) && <Text style={small}>Change from {period.previous}</Text>}
            <Row style={{ gap: md }}>
              {v.performance.map(({ label, value, unit, previous, better }, i) => {
                const change = previous === undefined ? undefined : normalize(value - previous);
                const improved = change !== undefined && (better === "higher" ? change > 0 : change < 0);
                return <Column key={i} style={{ gap: xs }}>
                  <Text style={small}>{label}</Text>
                  <Text style={{ fontSize: body * 1.25, fontWeight: 700 }}>{figureValue(value, unit)}</Text>
                  {change !== undefined && <Text style={{ ...small, color: improved ? colors.primary : colors.muted }}>
                    {change === 0 ? "Unchanged" : `${change > 0 ? "+" : "−"}${figureValue(Math.abs(change), unit === "%" ? "pp" : unit)} · ${improved ? "better" : "worse"}`}
                  </Text>}
                </Column>;
              })}
            </Row>
          </Column>}
          <Column style={band}>
            <Button href={over ? v.planUrl : v.usageUrl} style={{ padding: [sm, md], borderRadius: token("radii.sm"), backgroundColor: colors.primary, color: colors.primaryForeground }}>
              {over ? "Upgrade plan" : "See full usage"}
            </Button>
            <Text><Link href={over ? v.usageUrl : v.planUrl}>{over ? "See full usage" : "Change plan"}</Link></Text>
            <Divider style={rule} />
            <Text style={small}>Usage updates for {v.workspace}. <Link href={brand.links.preferences}>Manage notifications</Link></Text>
            <Text style={small}>{[brand.name, brand.address].filter(Boolean).join(" · ")}</Text>
          </Column>
        </Email>
      );
    },
  });
}

export default usageReport(brand);
