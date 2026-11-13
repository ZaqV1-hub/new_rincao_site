BEGIN;

-- Independent date paths avoid scanning every voucher for each day in a report.
CREATE INDEX IF NOT EXISTS voucher_operational_start_date ON voucher(dtinicio_validade) WHERE dtinicio_validade IS NOT NULL;
CREATE INDEX IF NOT EXISTS voucher_legacy_agenda ON voucher(idagenda) WHERE dtinicio_validade IS NULL;
CREATE INDEX IF NOT EXISTS idx_voucher_dtuso ON voucher(dtuso);

COMMIT;
