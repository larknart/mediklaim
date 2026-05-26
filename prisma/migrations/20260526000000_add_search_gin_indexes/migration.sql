-- Expression GIN indexes for global search (full-text, 'simple' dictionary)
-- 'simple': lowercase + tokenise only — no English stemming on Malay words/ref numbers

CREATE INDEX IF NOT EXISTS claim_fts_idx ON "Claim" USING GIN (
  to_tsvector('simple',
    coalesce("refNo", '') || ' ' ||
    coalesce("voucherNo", '')
  )
);

CREATE INDEX IF NOT EXISTS receipt_fts_idx ON "Receipt" USING GIN (
  to_tsvector('simple', coalesce(vendor, ''))
);

CREATE INDEX IF NOT EXISTS user_fts_idx ON "User" USING GIN (
  to_tsvector('simple',
    coalesce(name, '') || ' ' ||
    coalesce(email, '') || ' ' ||
    coalesce("staffNo", '')
  )
);

CREATE INDEX IF NOT EXISTS auditlog_fts_idx ON "AuditLog" USING GIN (
  to_tsvector('simple',
    coalesce("actorName", '') || ' ' ||
    coalesce(action, '') || ' ' ||
    coalesce(entity, '') || ' ' ||
    coalesce("entityId", '')
  )
);
