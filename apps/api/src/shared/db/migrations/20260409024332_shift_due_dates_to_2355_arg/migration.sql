-- Shift all open installment due dates from 20:00 UTC (5 PM ARG) to 02:55 UTC next day (23:55 ARG).
-- Only PENDING and PARTIALLY_PAID installments are updated; settled ones are left as historical records.
UPDATE "installments"
SET "dueDate" = "dueDate" + INTERVAL '6 hours 55 minutes'
WHERE status IN ('PENDING', 'PARTIALLY_PAID');
