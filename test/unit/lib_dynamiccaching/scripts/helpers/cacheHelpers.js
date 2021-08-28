'use strict';

const expect = require('chai').expect;
const proxyquire = require('proxyquire').noCallThru();
require('app-module-path').addPath(process.cwd() + '/cartridges');

const lPromotions =  [];

const cacheHelpers = proxyquire('lib_dynamiccaching/cartridge/scripts/helpers/cacheHelpers', {
    'dw/system/CacheMgr': {
        getCache: () => {
            return {
                get: (key, callback) => {
                    return callback();
                }
            }
        }
    },
    'dw/campaign/PromotionMgr': {
        getActivePromotions: () => {
            return {
                getProductPromotionsForDiscountedProduct: () => {
                    return {
                        iterator: () => {
                            return {
                                hasNext: () => lPromotions.length > 0,
                                next: () => lPromotions.shift()
                            }
                        }
                    }
                }
            }
        }
    }
});
const oDynamicCacheConfig = require('lib_dynamiccaching/cartridge/config/dynamic-caching');
let productStub;

describe('Dynamic Caching', () => {
    beforeEach(() => {
        productStub = {
            activeData: {
                salesVelocityWeek: 1,
                salesVelocityMonth: 1
            },
            isVariant: () => false,
            isVariationGroup: () => false,
            isMaster: () => false,
            isProduct: () => true,
            availabilityModel: {
                isOrderable: () => true,
                timeToOutOfStock: 10,
                inventoryRecord: {
                    ATS: 20
                }
            }
        }
    });

    it('should return the fallback value if no product is passed.', () => {
        const result = cacheHelpers.calculateProductCacheTime(null);

        expect(result).to.equal(cacheHelpers.FALLBACK_CACHE_TIME * 60);
    });

    it('should return a value for a standard product.', () => {
        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(productStub.availabilityModel.timeToOutOfStock * 60);
    });

    it('should round down if a decimal value is returned.', () => {
        productStub.availabilityModel.timeToOutOfStock = 10.6;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(10 * 60);
    });

    it('should take into account promotions.', () => {
        productStub.availabilityModel.timeToOutOfStock = 10;
        lPromotions.push({
            startDate: new Date()
        });

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(5 * 60);
    });

    it('should not take into account promotions that did not start today.', () => {
        productStub.availabilityModel.timeToOutOfStock = 10;
        lPromotions.push({
            startDate: new Date(2021, 1, 1)
        });

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(10 * 60);
    });

    it('should return the fallback value if the "Time To Out Of Stock" is 0.', () => {
        productStub.availabilityModel.timeToOutOfStock = 0;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(cacheHelpers.FALLBACK_CACHE_TIME * 60);
    });

    it('should return the fallback value if the product is no longer available to order.', () => {
        productStub.availabilityModel.isOrderable = () => false;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(cacheHelpers.FALLBACK_CACHE_TIME * 60);
    });

    it('should return the information from the master if the product is a "Variant".', () => {
        productStub.isVariant = () => true;
        productStub.variationModel = {
            master: {
                isMaster: () => true,
                availabilityModel: {
                    isOrderable: () => true,
                    timeToOutOfStock: 12,
                    SKUCoverage: 0.8
                },
                activeData: {
                    salesVelocityWeek: 1,
                    salesVelocityMonth: 1
                }
            }
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(9 * 60);
    });

    it('should return the information from the master if the product is a "Variation Group".', () => {
        productStub.isVariationGroup = () => true;
        productStub.variationModel = {
            master: {
                isMaster: () => true,
                availabilityModel: {
                    isOrderable: () => true,
                    timeToOutOfStock: 15,
                    SKUCoverage: 0.8
                },
                activeData: {
                    salesVelocityWeek: null,
                    salesVelocityMonth: null
                },
            }
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(10 * 60);
    });

    it('should return a value for a standard product when Active Data is available for the past month.', () => {
        productStub.activeData = {
            salesVelocityWeek: 1,
            salesVelocityMonth: 1
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(10 * 60);
    });

    it('should return the maximum value if the calculated value is higher.', () => {
        productStub.activeData = {
            salesVelocityWeek: 0.3,
            salesVelocityMonth: 0.2
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(oDynamicCacheConfig.maxCacheTime * 60);
    });

    it('should return the minimum value if the calculated hours is lower the minimum.', () => {
        productStub.activeData = {
            salesVelocityWeek: 30,
            salesVelocityMonth: 30
        };

        productStub.availabilityModel.timeToOutOfStock = 0.2;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(oDynamicCacheConfig.minCacheTime * 60);
    });

    it('should not use the custom week & month calculation if the inventory record is missing.', () => {
        productStub.activeData = {
            salesVelocityWeek: 1,
            salesVelocityMonth: 2
        };

        productStub.availabilityModel.inventoryRecord = null;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(productStub.availabilityModel.timeToOutOfStock * 60);
    });

    it('Scenario: Low Sales with high stock.', () => {
        productStub.activeData = {
            salesVelocityWeek: 0.1,
            salesVelocityMonth: 0.1
        };

        productStub.availabilityModel = {
            isOrderable: () => true,
            timeToOutOfStock: 2000,
            inventoryRecord: {
                ATS: 200
            }
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(oDynamicCacheConfig.maxCacheTime * 60);
    });

    it('Scenario: High Sales with high stock.', () => {
        productStub.activeData = {
            salesVelocityWeek: 50,
            salesVelocityMonth: 50
        };

        productStub.availabilityModel = {
            isOrderable: () => true,
            timeToOutOfStock: 8,
            inventoryRecord: {
                ATS: 200
            }
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(5 * 60);
    });

    it('Scenario: High Sales with low stock.', () => {
        productStub.activeData = {
            salesVelocityWeek: 50,
            salesVelocityMonth: 50
        };

        productStub.availabilityModel = {
            isOrderable: () => true,
            timeToOutOfStock: 1,
            inventoryRecord: {
                ATS: 10
            }
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(30);
    });

    it('Scenario: Low Sales with low stock.', () => {
        productStub.activeData = {
            salesVelocityWeek: 0.2,
            salesVelocityMonth: 0.2
        };

        productStub.availabilityModel = {
            isOrderable: () => true,
            timeToOutOfStock: 30,
            inventoryRecord: {
                ATS: 4
            }
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(17 * 60);
    });

    it('Scenario: Medium Sales with low stock.', () => {
        productStub.activeData = {
            salesVelocityWeek: 0.8,
            salesVelocityMonth: 0.7
        };

        productStub.availabilityModel = {
            isOrderable: () => true,
            timeToOutOfStock: 6,
            inventoryRecord: {
                ATS: 4
            }
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(4 * 60);
    });

    it('Scenario: Medium Sales with medium stock.', () => {
        productStub.activeData = {
            salesVelocityWeek: 0.8,
            salesVelocityMonth: 0.7
        };

        productStub.availabilityModel = {
            isOrderable: () => true,
            timeToOutOfStock: 42,
            inventoryRecord: {
                ATS: 30
            }
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(23 * 60);
    });

    it('Scenario: Medium Sales with high stock.', () => {
        productStub.activeData = {
            salesVelocityWeek: 0.8,
            salesVelocityMonth: 0.7
        };

        productStub.availabilityModel = {
            isOrderable: () => true,
            timeToOutOfStock: 42,
            inventoryRecord: {
                ATS: 200
            }
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(24 * 60);
    });
});