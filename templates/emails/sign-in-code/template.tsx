/**
 * A sign-in code. Everything but the code and how long it works is locked: the logo, the words around the code, the
 * note for a reader who didn't ask, and the footer (the company's address and its links). It's made from a brand
 * (`signInCode(brand)`), which sets its colors, fonts, logo and company details, and the domains its links may go to.
 */
import { Column, Divider, Email, Heading, Image, Link, Text, prop, token } from "@hyper-elements/react";
import { template } from "@hyper-elements/react/template";
import { lint } from "@hyper-elements/lint";
import type { Brand } from "../../_brand";
import { brand } from "../../_brands/orbit";

const fields = {
  code: prop.text({
    label: "Code",
    required: true,
    pattern: "^[0-9A-Z-]{4,12}$",
    guidance: "4 to 12 digits, capital letters and dashes, shown as given: 482-913",
  }),
  expires: prop.number({ label: "Expires in", required: true, min: 1, max: 60, integer: true, guidance: "How long the code works, in the unit below: 10" }),
  unit: prop.choice(["minutes", "hours", "days"], { label: "Unit", required: true, guidance: "The unit of how long the code works: minutes" }),
};

/** How long something works, as a reader says it: "10 minutes", "1 hour". */
const duration = (n: number, unit: "minutes" | "hours" | "days") => `${n} ${n === 1 ? unit.slice(0, -1) : unit}`;

export function signInCode(brand: Brand) {
  const small = { fontSize: token("fontSizes.small"), color: token("colors.muted"), textAlign: "center" } as const;
  return template({
    id: "emails.SignInCode",
    version: "1.0.0",
    label: "Sign-in code",
    description: "A one-time code, large and centered in a box of its own, with when it expires and what to do if it wasn't you",
    root: "Email",
    fields,
    rules: {
      plugins: { lint: lint({ kind: "transactional" }) },
      require: { lint: ["preview-text", "link-text", "alt-text", "contrast", "text-size", "lang"], core: ["layout/overflow"] },
      links: { domains: [...brand.links.domains] },
    },
    example: {
      code: "120-457",
      expires: 10,
      unit: "minutes",
    },
    render: (v) => (
      <Email
        width={560}
        title={`Your ${brand.name} code`}
        previewText={`Your code is ${v.code}. It expires in ${duration(v.expires, v.unit)}.`}
        lang={brand.lang ?? "en"}
        dir={brand.dir}
        theme={brand.theme}
        fonts={brand.fonts}
        style={{
          backgroundColor: token("colors.surface"),
          fontSize: token("fontSizes.body"),
          lineHeight: token("lineHeights.body"),
        }}
      >
        <Column
          style={{
            padding: [token("spacing.xl"), token("spacing.md"), token("spacing.lg")],
            gap: token("spacing.lg"),
          }}
        >
          <Column style={{ alignItems: "center" }}>
            <Image
              src={{ src: brand.logo.src, width: brand.logo.width, height: brand.logo.height }}
              alt={brand.logo.alt}
              style={{ width: 150 }}
            />
          </Column>
          <Column
            style={{
              backgroundColor: token("colors.background"),
              borderRadius: token("radii.md"),
              border: { width: 1, style: "solid", color: token("colors.border") },
            }}
          >
            <Column style={{ padding: token("spacing.xl"), gap: token("spacing.md") }}>
              <Column style={{ gap: token("spacing.md"), alignItems: "center", textAlign: "center" }}>
                <Text
                  style={{
                    fontSize: token("fontSizes.small"),
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: token("colors.primary"),
                  }}
                >
                  Your {brand.name} code
                </Text>
                <Heading level={1}>Here's your code to sign in</Heading>
                <Text>Enter it in the window where you asked for it.</Text>
                <Column
                  style={{
                    width: "100%",
                    backgroundColor: token("colors.surface"),
                    border: { width: 2, style: "dashed", color: token("colors.border") },
                    borderRadius: token("radii.md"),
                    padding: [token("spacing.lg"), token("spacing.md")],
                    gap: token("spacing.xs"),
                  }}
                >
                  <Text
                    field="code"
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      letterSpacing: 6,
                      lineHeight: 1.2,
                      textAlign: "center",
                      // A long code is smaller on a phone, so it stays on one line.
                      ...(v.code.length > 7 ? { mobile: { fontSize: 24, letterSpacing: 2 } } : {}),
                    }}
                  >
                    {v.code}
                  </Text>
                  <Text field="expires" style={small}>
                    Expires in {duration(v.expires, v.unit)}
                  </Text>
                </Column>
                <Divider />
                <Text style={{ fontSize: token("fontSizes.small"), color: token("colors.muted") }}>
                  Didn't ask for a code? Someone may have typed your email address by mistake. You can ignore this email: nobody can sign in without the code.
                </Text>
              </Column>
            </Column>
          </Column>
          <Column style={{ gap: token("spacing.xs") }}>
            <Text style={small}>
              {brand.name}
              {brand.address && ` · ${brand.address}`}
            </Text>
            <Text style={small}>
              <Link href={`${brand.links.site}/`}>Visit {brand.name}</Link>
              {" · "}
              <Link href={brand.links.help}>Get help from {brand.name}</Link>
            </Text>
          </Column>
        </Column>
      </Email>
    ),
  });
}

export default signInCode(brand);
