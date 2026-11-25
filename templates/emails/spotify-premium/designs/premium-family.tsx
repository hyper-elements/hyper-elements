import SpotifyPremium from "../template";

export const meta = { label: "Premium Family" };

export default function Family() {
  return (
    <SpotifyPremium
      subject="Your Premium Family plan has started"
      preview="Six Premium accounts under one roof, and a mix made for all of you."
      headline="Premium, for everyone at home."
      intro="Thanks for starting Premium Family. Invite up to five people who live with you, and each gets:"
      perks={[
        { title: "A Premium account of their own", text: "Their own music, playlists and picks." },
        { title: "Family Mix", text: "One playlist of the music you all listen to." },
        { title: "Explicit content filter", text: "Choose what each account can play." },
      ]}
      button={{ label: "Invite your family", href: "https://www.spotify.com/account/family" }}
      plan={{ name: "Premium Family", price: 199.99, period: "year" }}
      email="dana.okafor@example.com"
    />
  );
}
