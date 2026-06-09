"use client";

import { Check, X } from "lucide-react";
import type { PasswordPolicy } from "@/lib/password-policy";

interface Props { policy: PasswordPolicy; password: string }

export function PasswordPolicyHints({ policy, password }: Props) {
  const rules: { label: string; ok: boolean }[] = [
    { label: `Sekurang-kurangnya ${policy.minLength} aksara`, ok: password.length >= policy.minLength },
  ];
  if (policy.requireUppercase) rules.push({ label: "Satu huruf besar (A-Z)", ok: /[A-Z]/.test(password) });
  if (policy.requireNumber)    rules.push({ label: "Satu nombor (0-9)",       ok: /[0-9]/.test(password) });
  if (policy.requireSymbol)    rules.push({ label: "Satu simbol",             ok: /[^A-Za-z0-9]/.test(password) });
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {rules.map((r) => (
        <li key={r.label} className={`flex items-center gap-1.5 ${r.ok ? "text-primary" : "text-gray-400"}`}>
          {r.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          <span>{r.label}</span>
        </li>
      ))}
    </ul>
  );
}
