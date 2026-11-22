import NikeShipping from "../template";

export const meta = { label: "An away jersey" };

const ASSETS = "https://hyperelements.dev/generated/gallery/assets/companies/nike/";

export default function AwayJersey() {
  return (
    <NikeShipping
      subject="It's On Its Way."
      preview="Get your order summary, estimated delivery date and more"
      headline="It's On Its Way."
      message={[
        "Your order is on its way. Use the link above to track its progress.",
        "We've also charged your payment method for the cost of your order and will be removing any authorization holds. For payment details, please visit your Orders page on nike.com or in the Nike app.",
      ]}
      trackingNumber="1ZV218970300071628"
      trackingLink="https://www.nike.com/orders/track"
      shipTo={{ name: "Alan Mercer", address: ["2125 Chestnut St, San Francisco, CA 94123"] }}
      items={[{ image: { src: `${ASSETS}product.jpg`, width: 560, height: 560 }, name: "Brazil Stadium Away Women's Dri-FIT Soccer Jersey", details: "Size L (12–14)" }]}
      orderNumber="C0106373851"
      orderDate="Sep 22"
      picks={[
        { image: { src: `${ASSETS}pick-1.jpg`, width: 320, height: 400 }, name: "USWNT Stadium Home", kind: "Women's Dri-FIT Soccer Jersey", link: "https://www.nike.com/t/uswnt-stadium-home" },
        { image: { src: `${ASSETS}pick-2.jpg`, width: 320, height: 400 }, name: "Brazil Stadium Goalkeeper", kind: "Men's Dri-FIT Short-Sleeve Football Shirt", link: "https://www.nike.com/t/brazil-stadium-goalkeeper" },
        { image: { src: `${ASSETS}pick-4.jpg`, width: 320, height: 400 }, name: "FFF", kind: "Women's Soccer Jacket", link: "https://www.nike.com/t/fff-soccer-jacket" },
      ]}
    />
  );
}
