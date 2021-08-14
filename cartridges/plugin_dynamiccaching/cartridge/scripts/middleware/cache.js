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
    var start = new Date();

    var cacheHelpers = require('*/cartridge/scripts/helpers/cacheHelpers');
    var oProduct = res.getViewData().product;

    if (oProduct) {
        var dwProduct = oProduct.raw;
        var hoursToCache = cacheHelpers.calculateProductCacheTime(dwProduct);

        res.cachePeriod = hoursToCache;
        res.cachePeriodUnit = 'hours';
        res.personalizedByPricePromotion = true;

        res.getViewData().calculatedCacheHours = hoursToCache;
    }

    res.getViewData().calculatedCacheHoursPerformanceImpact = new Date() - start;

    next();
};

module.exports = base;
