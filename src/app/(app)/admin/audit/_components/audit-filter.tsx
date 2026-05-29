"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const ACTIONS = [
  "LOGIN","LOGOUT","LOGIN_FAILED","ACCOUNT_LOCKED","PASSWORD_CHANGED",
  "RECEIPT_UPLOADED","RECEIPT_EXTRACTED","RECEIPT_EXTRACTION_FAILED","RECEIPT_EDITED","RECEIPT_DELETED","RECEIPT_DUPLICATE_BLOCKED",
  "CLAIM_CREATED","CLAIM_SUBMITTED","CLAIM_WITHDRAWN","CLAIM_RESUBMITTED","CLAIM_RESUBMIT_INITIATED",
  "HEAD_APPROVED","HEAD_REJECTED","HEAD_SKIPPED_SELF_CLAIM","FINANCE_REVIEWED",
  "CLAIM_APPROVED","CLAIM_REJECTED","CLAIM_OVERRIDDEN","CLAIM_PAID",
  "LIMIT_RESET","LIMIT_UPDATED","ALLOCATION_CREATED",
  "USER_CREATED","USER_UPDATED","USER_DEACTIVATED","USER_PASSWORD_RESET",
  "DEPT_CREATED","DEPT_UPDATED","DEPT_DELETED","DEPARTMENT_CREATED","DEPARTMENT_UPDATED",
  "BLACKLIST_ADDED","BLACKLIST_REMOVED","BLACKLIST_UPDATED","SETTINGS_UPDATED",
  "CLAIM_COMMENT_ADDED","CLAIM_COMMENT_DELETED",
  "HOLIDAY_ADDED","HOLIDAY_DELETED",
  "DELEGATION_CREATED","DELEGATION_DELETED",
  "PDPA_EXPORT","REMINDER_SENT","AUDIT_PURGE",
];

interface AuditFilterProps {
  filterAction: string | null;
  filterEntity: string | null;
  filterActor: string | null;
  filterFrom: string | null;
  filterTo: string | null;
  entities: string[];
}

export function AuditFilter({
  filterAction,
  filterEntity,
  filterActor,
  filterFrom,
  filterTo,
  entities,
}: AuditFilterProps) {
  const router = useRouter();
  const actorRef = useRef<HTMLInputElement>(null);

  function push(overrides: Record<string, string | null>) {
    const current: Record<string, string | null> = {
      action: filterAction,
      entity: filterEntity,
      actor: filterActor,
      from: filterFrom,
      to: filterTo,
      ...overrides,
    };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(current)) {
      if (v) params.set(k, v);
    }
    router.push(`/admin/audit?${params}`);
  }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {/* Action */}
          <Select value={filterAction ?? ""} onValueChange={(v) => push({ action: v || null })}>
            <SelectTrigger className="text-sm">
              <span className="truncate">{filterAction ?? "Semua tindakan"}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua tindakan</SelectItem>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Entity */}
          <Select value={filterEntity ?? ""} onValueChange={(v) => push({ entity: v || null })}>
            <SelectTrigger className="text-sm">
              <span>{filterEntity ?? "Semua entiti"}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua entiti</SelectItem>
              {entities.map((e) => (
                <SelectItem key={e} value={e}>{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Actor */}
          <Input
            ref={actorRef}
            defaultValue={filterActor ?? ""}
            placeholder="Pelaku..."
            className="text-sm"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (filterActor ?? "")) push({ actor: v || null });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />

          {/* From */}
          <Input
            type="date"
            defaultValue={filterFrom ?? ""}
            className="text-sm"
            onChange={(e) => push({ from: e.target.value || null })}
          />

          {/* To */}
          <Input
            type="date"
            defaultValue={filterTo ?? ""}
            className="text-sm"
            onChange={(e) => push({ to: e.target.value || null })}
          />

          {/* Reset */}
          <Button
            variant="outline"
            size="sm"
            className="text-sm flex items-center gap-1"
            onClick={() => {
              if (actorRef.current) actorRef.current.value = "";
              router.push("/admin/audit");
            }}
          >
            <X className="w-3 h-3" />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
