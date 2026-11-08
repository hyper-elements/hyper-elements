export const size = { width: 1200, height: 630 };

export default function Card({ assets }: { assets: Record<string, string> }) {
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", position: "relative", fontFamily: "Inter" }}>
      <img src={assets["orbit-card-bg.png"]} width={1200} height={630} style={{ position: "absolute", top: 0, left: 0 }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, width: "100%", height: "100%", padding: 72, position: "relative" }}>
        <img src={assets["orbit-logo-white.png"]} width={126} height={64} />
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, color: "#ffffff", textAlign: "center", justifyContent: "center" }}>Ship every surface from one codebase</div>
        <div style={{ display: "flex", fontSize: 30, color: "#c7d2fe" }}>Live previews, typed templates and one-click deploys.</div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#ffffff", backgroundColor: "#6d5efc", borderRadius: 999, padding: "14px 28px" }}>orbit.dev/2</div>
      </div>
    </div>
  );
}
