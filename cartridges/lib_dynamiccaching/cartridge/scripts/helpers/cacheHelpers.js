'use strict';

// Set to true if stock levels are updated multiple times a day.
var STOCK_LEVELS_CHANGE_OFTEN = false;
var SHORT_CACHE_TIME = 1;
var LONG_CACHE_TIME = 24;
var FALLBACK_CACHE_TIME = STOCK_LEVELS_CHANGE_OFTEN ? SHORT_CACHE_TIME : LONG_CACHE_TIME;
// The amount of hours shoppers are active on a site (lets not take nights into account, unless that is your business)
var ACTIVE_HOURS_IN_DAY = 14;

/**
 * Calculate the optimal time the product can be cached based on inventory level and purchase history taking into account
 * the past week and month active data.
 *
 * @param {dw.catalog.Product} dwProduct - The product to determine the cache timing off.
 *
 * @returns {null|number} - The amount of hours to cache a page or component related to the product
 */
function calculateWeekAndMonthBasedCacheTime(dwProduct) {
    var nSalesVelocityWeek = dwProduct.activeData.salesVelocityWeek / (ACTIVE_HOURS_IN_DAY / 24);
    var nSalesVelocityMonth = dwProduct.activeData.salesVelocityMonth / (ACTIVE_HOURS_IN_DAY / 24);

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
    var iTimeToOutOfStock = dwAvailabilityModel.timeToOutOfStock;

    /**
     * If the product is not available for ordering or the time to out of stock is incalculable or 0,
     * fall back to default values.
     */
    if (!dwAvailabilityModel.isOrderable() || (iTimeToOutOfStock === 0)) {
        return FALLBACK_CACHE_TIME;
    }

    var nTimeToCacheBasedOnPreviousDay = Math.min(LONG_CACHE_TIME, Math.max(SHORT_CACHE_TIME, Math.floor(iTimeToOutOfStock)));
    if ((dwProductToUse.isMaster() && !dwProduct.isMaster())
        || (!dwProductToUse.isMaster() && dwProductToUse.isProduct())) {
        var nTimeToCacheBasedOnLongerTimePeriod = calculateWeekAndMonthBasedCacheTime(dwProduct);

        if (nTimeToCacheBasedOnLongerTimePeriod) {
            var nAverageTimeToCache = Math.floor((nTimeToCacheBasedOnPreviousDay + nTimeToCacheBasedOnLongerTimePeriod) / 2);

            return Math.min(LONG_CACHE_TIME, Math.max(SHORT_CACHE_TIME, nAverageTimeToCache));
        }
    }

    return nTimeToCacheBasedOnPreviousDay;
}

module.exports = {
    calculateProductCacheTime: calculateProductCacheTime,
    FALLBACK_CACHE_TIME: FALLBACK_CACHE_TIME,
    SHORT_CACHE_TIME: SHORT_CACHE_TIME,
    LONG_CACHE_TIME: LONG_CACHE_TIME
};
