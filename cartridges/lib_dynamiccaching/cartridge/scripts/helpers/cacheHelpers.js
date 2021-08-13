'use strict';

// Set to true if stock levels are updated multiple times a day.
var STOCK_LEVELS_CHANGE_OFTEN = false;
var SHORT_CACHE_TIME = 1;
var LONG_CACHE_TIME = 24;
var FALLBACK_CACHE_TIME = STOCK_LEVELS_CHANGE_OFTEN ? SHORT_CACHE_TIME : LONG_CACHE_TIME;

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

    return Math.min(LONG_CACHE_TIME, Math.max(SHORT_CACHE_TIME, Math.floor(iTimeToOutOfStock)));
}

module.exports = {
    calculateProductCacheTime: calculateProductCacheTime,
    FALLBACK_CACHE_TIME: FALLBACK_CACHE_TIME,
    SHORT_CACHE_TIME: SHORT_CACHE_TIME
};
