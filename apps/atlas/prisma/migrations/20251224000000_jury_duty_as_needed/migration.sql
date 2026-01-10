-- Make Jury Duty leave "as needed" (no practical annual cap).
--
-- Existing seed policy used 30 days/year, but our handbook defines Jury Duty as "as needed".
-- We represent this by setting daysPerYear to 365 (greater than any possible business-day total).

UPDATE "LeavePolicy"
SET
  "daysPerYear" = 365,
  "updatedAt" = NOW()
WHERE
  "leaveType" = 'JURY_DUTY'
  AND "daysPerYear" <> 365;

-- Align any existing employee balances that were created from the old 30-day policy.
UPDATE "LeaveBalance"
SET
  "allocated" = 365,
  "updatedAt" = NOW()
WHERE
  "leaveType" = 'JURY_DUTY'
  AND "allocated" < 365;
