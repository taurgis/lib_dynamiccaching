'use strict';

var base = module.superModule;

/**
 * Applies dynamic caching based on ATS and sales velocity.
 *
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @param {Function} next - Next call in the middleware chain.
 */
base.applyDynamicInventorySensitiveCache = function (req, res, next) {
    var { calculateProductCacheTime, calculateSearchCacheTime } = require('*/cartridge/scripts/helpers/cacheHelpers');
    var start = new Date();
    var oProduct = res.getViewData().product;
    var oProductSearch = res.getViewData().productSearch;

    if (oProduct) {
        var dwProduct = oProduct.raw;
        var nMinutesToCacheProduct = calculateProductCacheTime(dwProduct);

        res.cachePeriod = nMinutesToCacheProduct;
        res.cachePeriodUnit = 'minutes';
        res.personalizedByPricePromotion = true;

        res.getViewData().calculatedCacheMinutes = nMinutesToCacheProduct;
    }

    if (oProductSearch) {
        var nMinutesToCacheSearch = calculateSearchCacheTime(oProductSearch);

        res.cachePeriod = nMinutesToCacheSearch;
        res.cachePeriodUnit = 'minutes';
        res.personalizedByPricePromotion = true;

        res.getViewData().calculatedCacheMinutes = nMinutesToCacheSearch;
    }

    res.getViewData().calculatedCachePerformanceImpact = new Date() - start;

    next();
};

module.exports = base;
