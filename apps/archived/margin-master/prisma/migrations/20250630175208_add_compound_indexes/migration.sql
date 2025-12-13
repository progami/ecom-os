-- CreateIndex
CREATE INDEX "low_inventory_fees_marketplaceGroup_tierGroup_daysOfSupplyL_idx" ON "low_inventory_fees"("marketplaceGroup", "tierGroup", "daysOfSupplyLowerBound");

-- CreateIndex
CREATE INDEX "low_price_fees_marketplace_sizeTierName_rateWeightLowerBoun_idx" ON "low_price_fees"("marketplace", "sizeTierName", "rateWeightLowerBoundKg");

-- CreateIndex
CREATE INDEX "referral_fees_marketplaceGroup_productCategory_priceLowerBo_idx" ON "referral_fees"("marketplaceGroup", "productCategory", "priceLowerBound");

-- CreateIndex
CREATE INDEX "sipp_discounts_marketplace_sizeTierName_rateWeightLowerBoun_idx" ON "sipp_discounts"("marketplace", "sizeTierName", "rateWeightLowerBoundKg");

-- CreateIndex
CREATE INDEX "standard_fees_marketplace_sizeTierName_rateWeightLowerBound_idx" ON "standard_fees"("marketplace", "sizeTierName", "rateWeightLowerBoundKg");

-- CreateIndex
CREATE INDEX "storage_fees_marketplaceGroup_productSize_period_idx" ON "storage_fees"("marketplaceGroup", "productSize", "period");
