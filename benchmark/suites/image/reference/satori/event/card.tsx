export const size = { width: 1500, height: 500 };

export default function Card(_: { assets: Record<string, string> }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", height: "100%", padding: 64, backgroundColor: "#111827", fontFamily: "Inter" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 4, color: "#f87171" }}>LUMEN CONF 2027</div>
        <div style={{ display: "flex", fontSize: 80, fontWeight: 700, color: "#ffffff" }}>Build what's next.</div>
        <div style={{ display: "flex", fontSize: 32, color: "#d1d5db" }}>March 18–19, 2027 · Lisbon</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, width: 420, padding: 32, borderRadius: 16, backgroundColor: "#1f2937" }}>
        <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: "#ffffff" }}>Early-bird tickets</div>
        <div style={{ display: "flex", fontSize: 24, color: "#9ca3af" }}>Until January 31</div>
        <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: "#ffffff", backgroundColor: "#ef4444", borderRadius: 999, padding: "12px 24px" }}>Get tickets</div>
      </div>
    </div>
  );
}
