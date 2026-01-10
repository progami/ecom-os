-- Baseline ATLAS employee numbering to start at 2000.
--
-- Requirements:
-- - Jarrar should be employeeNumber 2000 (EMP-2000)
-- - Mehdi should be employeeNumber 2001 (EMP-2001)
-- - All other employees should follow sequentially (stable order)
-- - New rows should continue after the current max
--
-- Notes:
-- - This is safe for empty databases: it sets the identity sequence so the first
--   generated employeeNumber will be 2000.
-- - This preserves deterministic ordering for everyone else by current
--   employeeNumber, then createdAt/id (so existing order stays stable).

-- 1) Compute deterministic renumbering plan into a temp table.
CREATE TEMP TABLE "EmployeeRenumberPlan" AS
WITH ranked AS (
  SELECT
    e."id" AS id,
    ROW_NUMBER() OVER (
      ORDER BY
        CASE
          WHEN lower(e."firstName") = 'jarrar' THEN 0
          WHEN lower(e."firstName") = 'mehdi' OR lower(e."lastName") = 'mehdi' THEN 1
          ELSE 2
        END,
        e."employeeNumber",
        e."createdAt",
        e."id"
    ) AS rn
  FROM "Employee" e
),
stats AS (
  SELECT COALESCE(MAX("employeeNumber"), 0) AS max_num FROM "Employee"
)
SELECT
  r.id,
  1999 + r.rn AS new_num,
  s.max_num + r.rn AS temp_num
FROM ranked r
CROSS JOIN stats s;

-- 2) Move everyone to a safe temporary range/ID (avoids unique collisions).
UPDATE "Employee" e
SET
  "employeeNumber" = p.temp_num,
  "employeeId" = 'TMP-REN-' || e."id"
FROM "EmployeeRenumberPlan" p
WHERE e."id" = p.id;

-- 3) Apply final numbering (2000+), with employeeId derived from employeeNumber.
UPDATE "Employee" e
SET
  "employeeNumber" = p.new_num,
  "employeeId" = 'EMP-' || LPAD(
    p.new_num::TEXT,
    GREATEST(4, LENGTH(p.new_num::TEXT)),
    '0'
  )
FROM "EmployeeRenumberPlan" p
WHERE e."id" = p.id;

DROP TABLE "EmployeeRenumberPlan";

-- 4) Ensure identity continues from the current max (but never below 1999).
DO $$
DECLARE
  seq_name text;
BEGIN
  SELECT pg_get_serial_sequence('"Employee"', 'employeeNumber') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    EXECUTE format(
      'SELECT setval(%L::regclass, (SELECT GREATEST(COALESCE(MAX("employeeNumber"), 0), 1999) FROM "Employee"))',
      seq_name
    );
  END IF;
END $$;

