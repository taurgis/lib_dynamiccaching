'use strict';

var oDynamicCacheConfig = require('../../config/dynamic-caching.json');
var FALLBACK_CACHE_TIME = oDynamicCacheConfig.stockLevelsChangeOften ? oDynamicCacheConfig.shortCacheTime : oDynamicCacheConfig.longCacheTime;

/**
 * Calculate the optimal time the product can be cached based on inventory level and purchase history taking into account
 * the past week and month active data.
 *
 * @param {dw.catalog.Product} dwProduct - The product to determine the cache timing off.
 *
 * @returns {null|number} - The amount of hours to cache a page or component related to the product
 */
function calculateWeekAndMonthBasedCacheTime(dwProduct) {
    var nSalesVelocityWeek = (dwProduct.activeData.salesVelocityWeek / (oDynamicCacheConfig.activeHoursInDay / 24))
        * oDynamicCacheConfig.modifiers.week;
    var nSalesVelocityMonth = (dwProduct.activeData.salesVelocityMonth / (oDynamicCacheConfig.activeHoursInDay / 24))
        * oDynamicCacheConfig.modifiers.month;

    if (!nSalesVelocityWeek || !nSalesVelocityMonth) return null;

    var oInventoryRecord = dwProduct.availabilityModel.inventoryRecord;

    if (!oInventoryRecord) return null;

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
        return FALLBACK_CACHE_TIME;
    }

    var dwProductToUse = (dwProduct.isVariant() || dwProduct.isVariationGroup())
        ? dwProduct.variationModel.master : dwProduct;

    // If for some reason the product is not available, return the fallback cache time
    if (!dwProductToUse) {
        return FALLBACK_CACHE_TIME;
    }

    var dwAvailabilityModel = dwProductToUse.availabilityModel;
    var iTimeToOutOfStock = dwAvailabilityModel.timeToOutOfStock / oDynamicCacheConfig.modifiers.day;

    /**
     * If the product is not available for ordering or the time to out of stock is incalculable or 0,
     * fall back to default values.
     */
    if (!dwAvailabilityModel.isOrderable() || (iTimeToOutOfStock === 0)) {
        return FALLBACK_CACHE_TIME;
    }

    var nTimeToCacheBasedOnPreviousDay = Math.min(oDynamicCacheConfig.longCacheTime, Math.max(oDynamicCacheConfig.shortCacheTime, Math.floor(iTimeToOutOfStock)));

    if ((dwProductToUse.isMaster() && !dwProduct.isMaster())
        || (!dwProductToUse.isMaster() && dwProductToUse.isProduct())) {
        var nTimeToCacheBasedOnLongerTimePeriod = calculateWeekAndMonthBasedCacheTime(dwProduct);

        if (nTimeToCacheBasedOnLongerTimePeriod) {
            var nAverageTimeToCache = Math.floor((nTimeToCacheBasedOnPreviousDay + nTimeToCacheBasedOnLongerTimePeriod) / 2);

            return Math.min(oDynamicCacheConfig.longCacheTime, Math.max(oDynamicCacheConfig.shortCacheTime, nAverageTimeToCache));
        }
    }

    return nTimeToCacheBasedOnPreviousDay;
}

module.exports = {
    calculateProductCacheTime: calculateProductCacheTime,
    FALLBACK_CACHE_TIME: FALLBACK_CACHE_TIME
};
