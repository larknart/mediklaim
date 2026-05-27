import React from "react";
import { View, Text } from "@react-pdf/renderer";

const STATUS_WATERMARK: Record<string, { text: string; color: string }> = {
  APPROVED:  { text: "DILULUSKAN",  color: "#1c5e2f" },
  PAID:      { text: "DIBAYAR",     color: "#1c5e2f" },
  REJECTED:  { text: "DITOLAK",     color: "#c62828" },
  WITHDRAWN: { text: "TARIK BALIK", color: "#888888" },
};

/**
 * Returns a diagonal status watermark for claim cover sheets.
 * Returns null for non-final statuses (SUBMITTED, HEAD_APPROVED, FINANCE_REVIEWED, DRAFT).
 * `fixed` ensures it renders on every PDF page.
 */
export function claimWatermark(status: string): React.ReactElement | null {
  const wm = STATUS_WATERMARK[status];
  if (!wm) return null;
  return (
    <View
      fixed
      style={{
        position: "absolute",
        top: "35%",
        left: 0,
        right: 0,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 72,
          fontFamily: "Helvetica-Bold",
          color: wm.color,
          opacity: 0.12,
          // String form: valid per TransformExpandedStyle (transform: string | Transform[])
          transform: "rotate(-45deg)",
        }}
      >
        {wm.text}
      </Text>
    </View>
  );
}

/**
 * Returns a fixed org-identity watermark for laporan PDFs.
 * Always rendered. Shows org name + "DOKUMEN RASMI" stacked, diagonal, grey.
 * `fixed` ensures it renders on every PDF page.
 */
export function reportWatermark(orgName: string): React.ReactElement {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        top: "35%",
        left: 0,
        right: 0,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 60,
          fontFamily: "Helvetica-Bold",
          color: "#888888",
          opacity: 0.10,
          // String form: valid per TransformExpandedStyle (transform: string | Transform[])
          transform: "rotate(-45deg)",
          textAlign: "center",
        }}
      >
        {orgName || "ORGANISASI"}{"\n"}DOKUMEN RASMI
      </Text>
    </View>
  );
}
