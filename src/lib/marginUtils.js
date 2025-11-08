/**
 * Industry-standard margin calculations for commercial truck sales
 * Based on industry guidance:
 * - Chassis + OEM up-fits: 2-6% margin
 * - Upfit/accessory portion: 5-10% margin (can vary)
 * - Total sale (vehicle + upfit): 3-8% gross margin
 */

/**
 * Calculate dealer cost for pricing components
 * Returns cost multipliers that reflect industry-standard margins
 * 
 * @param {Object} order - Optional order object for variable margin calculation
 * @returns {Object} Cost multipliers for chassis, body, and labor
 */
export function getCostMultipliers(order = null) {
  // Use order ID or index to create deterministic but variable margins
  let seed = 0
  if (order?.id) {
    // Create a seed from order ID for consistent but varied margins
    seed = order.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 100
  } else if (order?.pricingJson) {
    // Use pricing total as seed for variation
    seed = (order.pricingJson.total || 0) % 100
  }
  
  // Chassis margin: 2-6% (industry standard for vehicle portion)
  // Cost multiplier: 0.94-0.98 (dealer pays 94-98% of MSRP, margin is 2-6%)
  const chassisBase = 0.96
  const chassisVariation = ((seed % 5) - 2) * 0.01 // -2% to +2% variation
  const chassisMultiplier = Math.max(0.94, Math.min(0.98, chassisBase + chassisVariation))
  
  // Body/Upfit margin: 5-10% (higher margin on upfit portion)
  // Cost multiplier: 0.90-0.95 (dealer pays 90-95% of MSRP, margin is 5-10%)
  const bodyBase = 0.925
  const bodyVariation = ((seed % 6) - 2.5) * 0.01 // -2.5% to +2.5% variation
  const bodyMultiplier = Math.max(0.90, Math.min(0.95, bodyBase + bodyVariation))
  
  // Labor margin: 5-10% (similar to body/upfit)
  // Cost multiplier: 0.90-0.95
  const laborBase = 0.925
  const laborVariation = ((seed % 6) - 2.5) * 0.01
  const laborMultiplier = Math.max(0.90, Math.min(0.95, laborBase + laborVariation))
  
  return {
    chassis: chassisMultiplier,
    body: bodyMultiplier,
    labor: laborMultiplier
  }
}

/**
 * Calculate estimated dealer cost for an order
 * 
 * @param {Object} pricingJson - Pricing data from order
 * @param {Object} order - Optional order object for variable margin calculation
 * @returns {number} Estimated dealer cost
 */
export function calculateDealerCost(pricingJson, order = null) {
  if (!pricingJson) return 0
  
  const multipliers = getCostMultipliers(order)
  
  const chassisCost = (pricingJson.chassisMsrp || 0) * multipliers.chassis
  const bodyCost = (pricingJson.bodyPrice || 0) * multipliers.body
  const laborCost = (pricingJson.labor || 0) * multipliers.labor
  const optionsCost = (pricingJson.optionsPrice || 0) * multipliers.body // Options use body multiplier
  const freightCost = pricingJson.freight || 0 // Freight is typically pass-through
  
  return chassisCost + bodyCost + laborCost + optionsCost + freightCost
}

/**
 * Calculate gross margin for an order
 * 
 * @param {Object} pricingJson - Pricing data from order
 * @param {Object} order - Optional order object for variable margin calculation
 * @returns {Object} Margin data including dollar amount and percentage
 */
export function calculateMargin(pricingJson, order = null) {
  if (!pricingJson || !pricingJson.total) {
    return { margin: 0, marginPercent: 0, cost: 0 }
  }
  
  const cost = calculateDealerCost(pricingJson, order)
  const margin = pricingJson.total - cost
  const marginPercent = pricingJson.total > 0 ? (margin / pricingJson.total) * 100 : 0
  
  return {
    margin: Math.round(margin),
    marginPercent: Math.round(marginPercent * 10) / 10, // Round to 1 decimal
    cost: Math.round(cost)
  }
}

