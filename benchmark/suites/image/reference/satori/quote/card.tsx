export const size = { width: 1200, height: 675 };

export default function Card({ assets }: { assets: Record<string, string> }) {
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: "#ffffff", borderLeft: "12px solid #6d5efc" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: 72 }}>
        <div style={{ display: "flex", fontFamily: "Lora", fontStyle: "italic", fontSize: 44, lineHeight: 1.4, color: "#111827" }}>
          We replaced four template systems with one. Our emails, invoices and social cards now ship from the same components.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontFamily: "Inter" }}>
          <img src={assets["avatar-daniel.png"]} width={72} height={72} style={{ borderRadius: 36 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flexGrow: 1 }}>
            <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#111827" }}>Daniel Okafor</div>
            <div style={{ display: "flex", fontSize: 24, color: "#6b7280" }}>Head of Platform, Northwind</div>
          </div>
          <img src={assets["orbit-logo.png"]} width={100} height={51} />
        </div>
      </div>
    </div>
  );
}
