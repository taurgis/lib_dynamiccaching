'use strict';

var oDynamicCacheConfig = require('../../config/dynamic-caching.json');
var FALLBACK_CACHE_TIME = oDynamicCacheConfig.inventoryLevelsChangeOften ? oDynamicCacheConfig.minCacheTime : oDynamicCacheConfig.maxCacheTime;

/**
 * Check if there are promotions active on the product that we need to take into account with the velocity.
 *
 * @param {dw.catalog.Product} oProduct - The product
 * @return {boolean} - True if we need to keep in mind promotions
 */
function isInfluencedByPromotions(oProduct) {
    var PromotionMgr = require('dw/campaign/PromotionMgr');
    var lActivePromotions = PromotionMgr.getActivePromotions().getProductPromotionsForDiscountedProduct(oProduct).iterator();

    while (lActivePromotions.hasNext()) {
        var oCurentPromotion = lActivePromotions.next();
        var dPromotionStartDate = oCurentPromotion.startDate || oCurentPromotion.campaign.startDate || oCurentPromotion.campaign.lastModified;

        if (dPromotionStartDate) {
            var dCurrentDate = new Date();

            if (dPromotionStartDate.getFullYear() === dCurrentDate.getFullYear()
                && dPromotionStartDate.getMonth() === dCurrentDate.getMonth()
                && dPromotionStartDate.getDate() === dCurrentDate.getDate()) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Calculate the optimal time the product can be cached based on inventory level and purchase history taking into account
 * the past week and month active data.
 *
 * @param {dw.catalog.Product} dwProduct - The product to determine the cache timing off.
 * @param {dw.catalog.ProductInventoryRecord} oInventoryRecord - The inventory record to use
 *
 * @returns {null|number} - The amount of hours to cache a page or component related to the product
 */
function calculateWeekAndMonthBasedCacheTime(dwProduct, oInventoryRecord) {
    if (!oInventoryRecord) return null;

    // Take into account the amount of products that are sold out, this will increase the Sales Velocity (possibly).
    var nSKUCoverage = dwProduct.isMaster() ? dwProduct.availabilityModel.SKUCoverage : 1;

    var nSalesVelocityWeek = ((dwProduct.activeData.salesVelocityWeek / (oDynamicCacheConfig.activeHoursInDay / 24))
        * oDynamicCacheConfig.modifiers.week) / nSKUCoverage;
    var nSalesVelocityMonth = ((dwProduct.activeData.salesVelocityMonth / (oDynamicCacheConfig.activeHoursInDay / 24))
        * oDynamicCacheConfig.modifiers.month) / nSKUCoverage;

    if (!nSalesVelocityWeek || !nSalesVelocityMonth) return null;

    var nATS = oInventoryRecord.ATS;
    var nExpectedUnitsSoldPerHour = (nSalesVelocityWeek + nSalesVelocityMonth) / 2;

    return nATS / nExpectedUnitsSoldPerHour;
}

/**
 * Calculate the optimal time the product can be cached based on inventory level and purchase history.
 *
 * @param {dw.catalog.Product} dwProduct - The product to determine the cache timing off.
 *
 * @returns {number} - The amount of hours to cache a page or component related to the product
 */
function calculateProductCacheTime(dwProduct) {
    // If no product is passed, return the fallback cache time
    if (!dwProduct) {
        return FALLBACK_CACHE_TIME * 60;
    }

    var dwProductToUse = (dwProduct.isVariant() || dwProduct.isVariationGroup())
        ? dwProduct.variationModel.master : dwProduct;

    // If for some reason the product is not available, return the fallback cache time
    if (!dwProductToUse) {
        return FALLBACK_CACHE_TIME * 60;
    }

    var dwAvailabilityModel = dwProduct.availabilityModel;
    var iTimeToOutOfStock = dwAvailabilityModel.timeToOutOfStock / oDynamicCacheConfig.modifiers.day;

    /**
     * If the product is not available for ordering or the time to out of stock is incalculable or 0,
     * fall back to default values.
     */
    if (!dwAvailabilityModel.isOrderable() || (iTimeToOutOfStock === 0)) {
        return FALLBACK_CACHE_TIME * 60;
    }

    /**
     * Calculate the time we should cache based on the Active Data
     */
    var nTimeToCacheBasedOnPreviousDay = Math.min(oDynamicCacheConfig.maxCacheTime, Math.max(oDynamicCacheConfig.minCacheTime, Math.floor(iTimeToOutOfStock)));

    /**
     * Calculate on the long term on the passed product to get a good mix.
     */
    var nTimeToCacheBasedOnLongerTimePeriod = calculateWeekAndMonthBasedCacheTime(dwProductToUse, dwAvailabilityModel.inventoryRecord);
    var nPromotionInfluence = isInfluencedByPromotions(dwProductToUse) ? oDynamicCacheConfig.promotionInfluence : 1;

    if (nTimeToCacheBasedOnLongerTimePeriod) {
        var nAverageTimeToCache = Math.floor(((nTimeToCacheBasedOnPreviousDay + nTimeToCacheBasedOnLongerTimePeriod) / 2) * nPromotionInfluence);

        return Math.min(oDynamicCacheConfig.maxCacheTime, Math.max(oDynamicCacheConfig.minCacheTime, nAverageTimeToCache)) * 60;
    }

    return (nTimeToCacheBasedOnPreviousDay * nPromotionInfluence) * 60;
}

module.exports = {
    calculateProductCacheTime: calculateProductCacheTime,
    FALLBACK_CACHE_TIME: FALLBACK_CACHE_TIME
};
