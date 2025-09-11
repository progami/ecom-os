// Client-side FBA fee calculation for immediate UI updates
// These are approximations - actual fees are calculated server-side on save

export function calculateFBAFeeClient(
  weightOz: number,
  sizeTier: string,
  price: number,
  marketplace: string = 'US'
): { fee: number; isLowPrice: boolean; feeType: string; weightRange: string } {
  // Price thresholds for low-price FBA
  const priceThresholds: Record<string, number> = {
    'US': 10,
    'UK': 10,
    'DE': 10,
    'FR': 10,
    'IT': 10,
    'ES': 10,
    'JP': 1500
  }
  
  const threshold = priceThresholds[marketplace] || 10
  const isLowPrice = price < threshold
  
  // Determine weight range
  let weightRange = ''
  if (sizeTier === 'Small standard') {
    if (weightOz <= 4) weightRange = '0-4 oz'
    else if (weightOz <= 8) weightRange = '4-8 oz'
    else if (weightOz <= 12) weightRange = '8-12 oz'
    else if (weightOz <= 16) weightRange = '12-16 oz'
    else weightRange = `${weightOz.toFixed(1)} oz`
  } else if (sizeTier === 'Large standard') {
    if (weightOz <= 4) weightRange = '0-4 oz'
    else if (weightOz <= 8) weightRange = '4-8 oz'
    else if (weightOz <= 12) weightRange = '8-12 oz'
    else if (weightOz <= 16) weightRange = '12-16 oz'
    else if (weightOz <= 20) weightRange = '16-20 oz'
    else if (weightOz <= 24) weightRange = '20-24 oz'
    else if (weightOz <= 28) weightRange = '24-28 oz'
    else if (weightOz <= 32) weightRange = '28-32 oz'
    else if (weightOz <= 36) weightRange = '32-36 oz'
    else if (weightOz <= 40) weightRange = '36-40 oz'
    else if (weightOz <= 44) weightRange = '40-44 oz'
    else if (weightOz <= 48) weightRange = '44-48 oz'
    else weightRange = `${(weightOz/16).toFixed(1)} lb`
  } else {
    weightRange = `${weightOz.toFixed(1)} oz`
  }
  
  // US FBA fee structure (approximation)
  let fee = 0
  
  if (isLowPrice) {
    // Low-price FBA fees
    if (sizeTier === 'Small standard') {
      if (weightOz <= 4) fee = 2.45
      else if (weightOz <= 8) fee = 2.63
      else if (weightOz <= 12) fee = 2.81
      else if (weightOz <= 16) fee = 3.00
      else fee = 3.00 + ((weightOz - 16) * 0.16 / 8) // Approximate for heavier
    } else if (sizeTier === 'Large standard') {
      if (weightOz <= 4) fee = 3.09
      else if (weightOz <= 8) fee = 3.31
      else if (weightOz <= 12) fee = 3.47
      else if (weightOz <= 16) fee = 3.98
      else if (weightOz <= 20) fee = 4.63
      else if (weightOz <= 24) fee = 4.71
      else fee = 4.71 + ((weightOz - 24) * 0.16 / 8) // Approximate for heavier
    } else {
      fee = 5.00 // Default for other size tiers
    }
  } else {
    // Standard FBA fees
    if (sizeTier === 'Small standard') {
      if (weightOz <= 4) fee = 3.22
      else if (weightOz <= 8) fee = 3.40
      else if (weightOz <= 12) fee = 3.58
      else if (weightOz <= 16) fee = 3.77
      else fee = 3.77 + ((weightOz - 16) * 0.16 / 8) // Approximate for heavier
    } else if (sizeTier === 'Large standard') {
      if (weightOz <= 4) fee = 3.86
      else if (weightOz <= 8) fee = 4.08
      else if (weightOz <= 12) fee = 4.24
      else if (weightOz <= 16) fee = 4.75
      else if (weightOz <= 20) fee = 5.40
      else if (weightOz <= 24) fee = 5.48
      else if (weightOz <= 28) fee = 5.73
      else if (weightOz <= 32) fee = 5.81
      else if (weightOz <= 36) fee = 5.94
      else if (weightOz <= 40) fee = 6.10
      else if (weightOz <= 44) fee = 6.20
      else if (weightOz <= 48) fee = 6.30
      else {
        // $0.16 per half-pound above 3 lb (48 oz)
        const additionalHalfPounds = Math.ceil((weightOz - 48) / 8)
        fee = 6.30 + (additionalHalfPounds * 0.16)
      }
    } else {
      fee = 7.00 // Default for other size tiers
    }
  }
  
  return {
    fee,
    isLowPrice,
    feeType: isLowPrice ? 'Low-Price FBA' : 'Standard FBA',
    weightRange
  }
}