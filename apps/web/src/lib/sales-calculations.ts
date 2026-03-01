
export const calculateItemCost = (
    netWeight: number,
    dailyGoldRatePer8g: number,
    costCalculationMethod: string | undefined,
    costRatePercentage: number | undefined,
    makingCharges: number,
    wastagePercentage: number | undefined,
    hallmarkCharges: number | undefined,
    stoneValue: number
): number => {
    // Rate based method check
    const isRateBased = costCalculationMethod === 'rate_based' || (costRatePercentage !== undefined && costRatePercentage > 0);

    if (isRateBased && costRatePercentage) {
        // Formula: (Gold Rate per 8g / 8) * Weight * (Rate% / 100)
        // This calculates the TOTAL cost based on the rate percentage of the gold value.
        const goldRatePerGram = dailyGoldRatePer8g / 8;
        const cost = goldRatePerGram * netWeight * (costRatePercentage / 100);
        return cost + stoneValue;
    }
    // Making charges method
    else {
        // Formula: [((Weight ÷ 8 × Wastage%) + Weight) ÷ 8 × Rate × (22÷24)] + Making Charges
        const wastageWeight = (netWeight / 8) * ((wastagePercentage || 0) / 100);
        const totalWeight = wastageWeight + netWeight;
        const goldCost = (totalWeight / 8) * dailyGoldRatePer8g * (22 / 24);
        return goldCost + makingCharges + (hallmarkCharges || 0) + stoneValue;
    }
};

export const calculateEstimatedPrice = (
    currentCost: number,
    markupPercentage: number = 15
): number => {
    return currentCost * (1 + markupPercentage / 100);
};

export const calculateDiscount = (
    estimatedPrice: number,
    unitPrice: number
): number => {
    return Math.max(0, estimatedPrice - unitPrice);
};
