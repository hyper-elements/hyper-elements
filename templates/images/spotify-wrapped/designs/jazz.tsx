import SpotifyWrapped from "../template";

export const meta = { label: "Jazz listener" };

// Invented artists and songs: no real musician's name on a card. Fewer than five of each draws fewer rows, and the
// third song, longer than the card holds, is cut with an ellipsis.
export default function Jazz() {
  return (
    <SpotifyWrapped
      minutes={91507}
      artists={["The Velvet Quarter Trio", "Odessa Brightwater", "Kofi Abernathy Quintet"]}
      songs={["Rain on Larkspur Avenue", "Half Past Midnight", "Café at the End of the Line, Where the Lamps Stay Lit Until the Morning Comes", "Slow Walk Home"]}
      genre="Contemporary Jazz"
    />
  );
}
