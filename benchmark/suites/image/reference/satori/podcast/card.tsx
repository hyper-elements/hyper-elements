export const size = { width: 1080, height: 1080 };

export default function Card({ assets }: { assets: Record<string, string> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", width: "100%", height: "100%", padding: 80, backgroundColor: "#fef3c7", fontFamily: "Inter", textAlign: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <img src={assets["podcast-cover.png"]} width={360} height={360} style={{ borderRadius: 24 }} />
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 3, color: "#b45309" }}>EPISODE 42</div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.15, color: "#1c1917", justifyContent: "center" }}>Designing APIs that agents can read</div>
        <div style={{ display: "flex", fontSize: 32, color: "#44403c" }}>with Priya Natarajan</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#1c1917" }}>The Build Log</div>
        <div style={{ display: "flex", fontSize: 24, color: "#78716c" }}>Listen wherever you get podcasts</div>
      </div>
    </div>
  );
}
