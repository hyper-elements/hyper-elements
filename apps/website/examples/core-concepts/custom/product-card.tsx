import {
  Button,
  Column,
  Heading,
  Image,
  Text,
  defineElement,
  prop,
} from "@hyper-elements/react";

export const ProductCard = defineElement({
  type: "acme.ProductCard",
  label: "Product card",
  props: {
    name: prop.text({ label: "Name", required: true }),
    photo: prop.image({ label: "Photo", required: true }),
    href: prop.link({ label: "Link", required: true }),
    price: prop.text({ label: "Price" }),
    accent: prop.color({ label: "Accent", default: "#4f46e5" }),
    size: prop.choice(["compact", "large"], {
      label: "Size",
      default: "compact",
    }),
    soldOut: prop.boolean({ label: "Sold out", default: false }),
  },
  render: ({ name, photo, href, price, accent, size, soldOut }) => (
    <Column id="card" style={{ gap: 8 }}>
      <Image src={photo} alt={name} />
      <Heading level={3} style={{ fontSize: size === "large" ? 22 : 16 }}>
        {name}
      </Heading>
      {price ? <Text>{price}</Text> : null}
      <Button
        href={href}
        style={{ backgroundColor: soldOut ? "#a1a1aa" : accent }}
      >
        {soldOut ? "Sold out" : "Buy"}
      </Button>
    </Column>
  ),
});
