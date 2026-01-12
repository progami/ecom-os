-- Truncate existing descriptions to 64 characters
UPDATE skus SET description = LEFT(description, 64) WHERE LENGTH(description) > 64;

-- Alter column to VarChar(64)
ALTER TABLE skus ALTER COLUMN description TYPE VARCHAR(64);
