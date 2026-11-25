import SpotifyWrapped from "../template";

export const meta = { label: "Indie pop listener" };

// Invented artists and songs: no real musician's name on a card.
export default function IndiePop() {
  return (
    <SpotifyWrapped
      minutes={48213}
      artists={["Juniper Vale", "The Low Hours", "Mara Okafor", "Neon Orchard", "Sol & Static"]}
      songs={["Paper Moons", "Slow Burn Summer", "Glasshouse", "Night Bus Home", "Everything, Again"]}
      genre="Indie Pop"
    />
  );
}
