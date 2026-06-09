import { ClaimStatus } from "@/generated/prisma";

export type ClaimStatusVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info";

export interface ClaimStatusInfo {
  label: string;
  variant: ClaimStatusVariant;
}

/**
 * Canonical claim status config — single source of truth for labels and badge variants.
 * Use this everywhere instead of local STATUS_LABELS / STATUS_CONFIG maps.
 */
export const CLAIM_STATUS_CONFIG: Record<ClaimStatus, ClaimStatusInfo> = {
  DRAFT:            { label: "Draf",               variant: "secondary" },
  SUBMITTED:        { label: "Menunggu Sokongan",  variant: "warning" },
  HEAD_APPROVED:    { label: "Menunggu Kewangan",  variant: "info" },
  FINANCE_REVIEWED: { label: "Menunggu Kelulusan", variant: "info" },
  APPROVED:         { label: "Diluluskan",         variant: "success" },
  REJECTED:         { label: "Ditolak",            variant: "destructive" },
  PAID:             { label: "Dibayar",            variant: "success" },
  WITHDRAWN:        { label: "Tarik Balik",        variant: "secondary" },
};

/**
 * Inline pill classes for compact status chips (e.g. global-search results).
 * Covers both ClaimStatus and ReceiptStatus strings.
 */
export const STATUS_PILL_CLASSES: Record<string, string> = {
  // Claim statuses
  DRAFT:            "bg-muted text-muted-foreground",
  SUBMITTED:        "bg-warning/10 text-warning",
  HEAD_APPROVED:    "bg-info/10 text-info",
  FINANCE_REVIEWED: "bg-info/10 text-info",
  APPROVED:         "bg-success/10 text-success",
  REJECTED:         "bg-destructive/10 text-destructive",
  PAID:             "bg-success/10 text-success",
  WITHDRAWN:        "bg-muted text-muted-foreground",
  // Receipt statuses
  UNSORTED:         "bg-muted text-muted-foreground",
  ATTACHED:         "bg-muted text-muted-foreground",
  ARCHIVED:         "bg-success/10 text-success",
};
