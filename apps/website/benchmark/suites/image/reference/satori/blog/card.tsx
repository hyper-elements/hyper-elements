export const size = { width: 1200, height: 630 };

export default function Card({ assets }: { assets: Record<string, string> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: 72, backgroundColor: "#0f172a", fontFamily: "Inter" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <img src={assets["orbit-logo-white.png"]} width={126} height={64} />
          <div style={{ display: "flex", fontSize: 20, fontWeight: 700, letterSpacing: 2, color: "#ffffff", backgroundColor: "#2563eb", borderRadius: 999, padding: "8px 16px" }}>
            ENGINEERING
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 60, fontWeight: 700, lineHeight: 1.15, color: "#ffffff" }}>
          How we cut our build times in half with incremental bundling
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <img src={assets["avatar-maya.png"]} width={64} height={64} style={{ borderRadius: 32 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#ffffff" }}>Maya Chen</div>
          <div style={{ display: "flex", fontSize: 24, color: "#94a3b8" }}>June 12, 2027 · 8 min read</div>
        </div>
      </div>
    </div>
  );
}
