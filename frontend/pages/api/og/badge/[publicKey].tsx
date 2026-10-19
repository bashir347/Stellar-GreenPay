import { ImageResponse } from "@vercel/og";
import type { NextRequest } from "next/server";
import { formatXLM } from "@/utils/format";

export const config = { runtime: "edge" };

const BADGE_META: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  seedling: { emoji: "🌱", label: "Seedling", color: "#10b981", bg: "#ecfdf5" },
  tree: { emoji: "🌳", label: "Tree", color: "#22c55e", bg: "#f0fdf4" },
  forest: { emoji: "🌲", label: "Forest", color: "#14b8a6", bg: "#f0fdfa" },
  earth: { emoji: "🌍", label: "Earth Guardian", color: "#3b82f6", bg: "#eff6ff" },
};

export default async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const publicKey = searchParams.get("publicKey");
  if (!publicKey) return new Response("Missing publicKey", { status: 400 });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  let donor: any;
  try {
    const res = await fetch(`${apiUrl}/api/donors/${encodeURIComponent(publicKey)}`);
    const body = await res.json();
    donor = body.data || body;
  } catch {
    return new Response("Donor not found", { status: 404 });
  }
  if (!donor) return new Response("Donor not found", { status: 404 });

  const displayName = donor.displayName || publicKey.slice(0, 6) + "…" + publicKey.slice(-6);
  const totalDonated = donor.totalDonatedXLM || "0";
  const totalCO2 = donor.totalCO2OffsetKg || 0;
  
  // Get highest badge tier
  const badges = donor.badges || [];
  const tierOrder = ["seedling", "tree", "forest", "earth"];
  let highestTier = "seedling";
  let highestIdx = -1;
  for (const b of badges) {
    const idx = tierOrder.indexOf(b.tier);
    if (idx > highestIdx) {
      highestIdx = idx;
      highestTier = b.tier;
    }
  }
  
  const meta = BADGE_META[highestTier] || BADGE_META.seedling;

  return new ImageResponse(
    (
      <div style={{ width: "1200px", height: "630px", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px", background: `linear-gradient(135deg, #0a1628 0%, #0f2847 50%, ${meta.color}40 100%)`, color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
              {meta.emoji}
            </div>
            <span style={{ fontSize: "20px", color: "#94a3b8", fontWeight: 500 }}>Stellar GreenPay</span>
          </div>
          <h1 style={{ fontSize: "48px", fontWeight: 700, margin: 0, lineHeight: 1.1 }}>{displayName}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "24px", color: "#94a3b8" }}>
            <span style={{ background: `${meta.bg}`, color: `${meta.color}`, padding: "8px 16px", borderRadius: "8px", fontWeight: 600, fontSize: "20px" }}>
              {meta.emoji} {meta.label}
            </span>
            <span>•</span>
            <span>{formatXLM(totalDonated)} donated</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontSize: "22px", color: "#e2e8f0" }}>
            <span style={{ fontWeight: 600, color: meta.color }}>{totalCO2.toLocaleString()} kg</span> CO₂ offset
          </div>
          <div style={{ fontSize: "18px", color: "#94a3b8" }}>
            Climate impact on Stellar GreenPay
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
