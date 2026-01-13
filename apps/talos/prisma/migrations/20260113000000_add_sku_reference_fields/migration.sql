-- Add reference fields for category, size tier, referral fee, and FBA fee
ALTER TABLE skus ADD COLUMN category VARCHAR(255);
ALTER TABLE skus ADD COLUMN size_tier VARCHAR(100);
ALTER TABLE skus ADD COLUMN referral_fee_percent DECIMAL(5, 2);
ALTER TABLE skus ADD COLUMN fba_fulfillment_fee DECIMAL(12, 2);
