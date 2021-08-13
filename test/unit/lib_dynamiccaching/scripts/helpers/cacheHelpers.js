'use strict';

const expect = require('chai').expect;

require('app-module-path').addPath(process.cwd() + '/cartridges');

const cacheHelpers = require('lib_dynamiccaching/cartridge/scripts/helpers/cacheHelpers');
let productStub;

describe('Dynamic Caching', () => {
    beforeEach(() => {
        productStub = {
            activeData: {
                salesVelocityWeek: null,
                salesVelocityMonth: null
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

        expect(result).to.equal(cacheHelpers.FALLBACK_CACHE_TIME);
    });

    it('should return a value for a standard product.', () => {
        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(productStub.availabilityModel.timeToOutOfStock);
    });

    it('should round down if a decimal value is returned.', () => {
        productStub.availabilityModel.timeToOutOfStock = 10.6;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(Math.floor(productStub.availabilityModel.timeToOutOfStock));
    });

    it('should return the fallback value if the "Time To Out Of Stock" is 0.', () => {
        productStub.availabilityModel.timeToOutOfStock = 0;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(cacheHelpers.FALLBACK_CACHE_TIME);
    });

    it('should return the fallback value if the product is no longer available to order.', () => {
        productStub.availabilityModel.isOrderable = () => false;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(cacheHelpers.FALLBACK_CACHE_TIME);
    });

    it('should return the information from the master if the product is a "Variant".', () => {
        productStub.isVariant = () => true;
        productStub.variationModel = {
            master: {
                isMaster: () => true,
                availabilityModel: {
                    isOrderable: () => true,
                    timeToOutOfStock: 12
                }
            }
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(productStub.variationModel.master.availabilityModel.timeToOutOfStock);
    });

    it('should return the information from the master if the product is a "Variation Group".', () => {
        productStub.isVariationGroup = () => true;
        productStub.variationModel = {
            master: {
                isMaster: () => true,
                availabilityModel: {
                    isOrderable: () => true,
                    timeToOutOfStock: 15
                }
            }
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(productStub.variationModel.master.availabilityModel.timeToOutOfStock);
    });

    it('should return a value for a standard product when Active Data is available for the past month.', () => {
        productStub.activeData = {
            salesVelocityWeek: 1,
            salesVelocityMonth: 1
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(15);
    });

    it('should return the maximum value if the calculated value is higher.', () => {
        productStub.activeData = {
            salesVelocityWeek: 0.5,
            salesVelocityMonth: 0.3
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(cacheHelpers.LONG_CACHE_TIME);
    });

    it('should return the minimum value if the calculated hours is lower the minimum.', () => {
        productStub.activeData = {
            salesVelocityWeek: 30,
            salesVelocityMonth: 30
        };

        productStub.availabilityModel.timeToOutOfStock = 0.2;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(cacheHelpers.SHORT_CACHE_TIME);
    });

    it('should not use the custom week & month calculation if the inventory record is missing.', () => {
        productStub.activeData = {
            salesVelocityWeek: 1,
            salesVelocityMonth: 2
        };

        productStub.availabilityModel.inventoryRecord = null;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(productStub.availabilityModel.timeToOutOfStock);
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

        expect(result).to.equal(cacheHelpers.LONG_CACHE_TIME);
    });

    it('Scenario: High Sales with high stock.', () => {
        productStub.activeData = {
            salesVelocityWeek: 50, // 50 results in 4 hours
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

        expect(result).to.equal(6);
    });

    it('Scenario: High Sales with low stock.', () => {
        productStub.activeData = {
            salesVelocityWeek: 50, // 50 results in 0.2 hours
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

        expect(result).to.equal(1);
    });

    it('Scenario: Low Sales with low stock.', () => {
        productStub.activeData = {
            salesVelocityWeek: 0.2,
            salesVelocityMonth: 0.2
        };

        productStub.availabilityModel = {
            isOrderable: () => true,
            timeToOutOfStock: 50,
            inventoryRecord: {
                ATS: 4
            }
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(22);
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

        expect(result).to.equal(5);
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

        expect(result).to.equal(24);
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

        expect(result).to.equal(24);
    });
});