import SpotifyPremium from "../template";

export const meta = { label: "Premium Individual" };

export default function Individual() {
  return (
    <SpotifyPremium
      subject="Welcome to Spotify Premium"
      preview="Ad-free music, offline listening and more. Here's what you get now."
      headline="Welcome to Premium."
      intro="Thanks for joining Spotify Premium. Here's what you get now:"
      perks={[
        { title: "Ad-free music listening", text: "Enjoy uninterrupted music." },
        { title: "Download to listen offline", text: "Save your data by listening offline." },
        { title: "Play songs in any order", text: "No more shuffle-only." },
        { title: "High audio quality", text: "Hear the full detail of your music." },
      ]}
      button={{ label: "Open Spotify", href: "https://www.spotify.com/open" }}
      plan={{ name: "Premium Individual", price: 11.99, period: "month", trial: "20 December" }}
      email="alan.mercer@example.com"
    />
  );
}
