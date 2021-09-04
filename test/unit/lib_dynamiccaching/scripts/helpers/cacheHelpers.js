'use strict';

const expect = require('chai').expect;
const proxyquire = require('proxyquire').noCallThru();
require('app-module-path').addPath(process.cwd() + '/cartridges');

const lPromotions =  [];

const cacheHelpers = proxyquire('lib_dynamiccaching/cartridge/scripts/helpers/cacheHelpers', {
    '../../config/dynamic-caching.json': {
        "inventoryLevelsChangeOften": false,
        "activeHoursInDay": 14,
        "minCacheTime": 0.5,
        "maxCacheTime": 24,
        "promotionInfluence": 0.5,
        "modifiers": {
            "day": 1,
            "week": 1,
            "month": 1
        }
    },
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

        /**
         * Last Day: 10 hours (calculated by Salesforce)
         * Last Week: 1 / hour --> 20 / (1 / (14 / 24)) =  11.67 hours
         * Last Month: 1 / hour --> 20/ (1 / (14 / 24 )) = 11.67 hours
         *
         * Average = 10.835 --> floored = 10
         */
        expect(result).to.equal(10 * 60);
    });

    it('should round down if a decimal value is returned.', () => {
        productStub.availabilityModel.timeToOutOfStock = 10.6;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        /**
         * Last Day: 10.6 hours (calculated by Salesforce) --> floored to 10
         * Last Week: 1 / hour --> 20 / (1 / (14 / 24)) =  11.67 hours
         * Last Month: 1 / hour --> 20/ (1 / (14 / 24 )) = 11.67 hours
         *
         * Average = 10.835 --> floored = 10
         */
        expect(result).to.equal(10 * 60);
    });

    it('should take into account promotions.', () => {
        productStub.availabilityModel.timeToOutOfStock = 10;
        lPromotions.push({
            startDate: new Date()
        });

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        /**
         * Last Day: 10 hours (calculated by Salesforce)
         * Last Week: 1 / hour --> 20 / (1 / (14 / 24)) =  11.67 hours
         * Last Month: 1 / hour --> 20/ (1 / (14 / 24 )) = 11.67 hours
         *
         * Average = 10.835 --> floored = 10
         * Promotions taken into account: 10 * 0.5 = 5
         */
        expect(result).to.equal(5 * 60);
    });

    it('should not take into account promotions that did not start today.', () => {
        productStub.availabilityModel.timeToOutOfStock = 10;

        lPromotions.push({
            startDate: new Date(2021, 1, 1)
        });

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        /**
         * Last Day: 10 hours (calculated by Salesforce)
         * Last Week: 1 / hour --> 20 / (1 / (14 / 24)) =  11.67 hours
         * Last Month: 1 / hour --> 20/ (1 / (14 / 24 )) = 11.67 hours
         *
         * Average = 10.835 --> floored = 10
         */
        expect(result).to.equal(10 * 60);
    });

    it('should return the fallback value if the "Time To Out Of Stock" is 0.', () => {
        productStub.availabilityModel.timeToOutOfStock = 0;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        /**
         * Last Day: 0 hours (calculated by Salesforce)
         */
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

        /**
         * Last Day: 12 hours (calculated by Salesforce) * 0.8 = 9.6
         * Last Week: 1 / hour --> 20 / (1 / (14 / 24)) * 0.8 =  9.4 hours
         * Last Month: 1 / hour --> 20/ (1 / (14 / 24 )) * 0.8 = 9.4 hours
         *
         * Average = 9.5 --> floored = 9
         */
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

        /**
         * Last Day: 10 hours (calculated by Salesforce)
         */
        expect(result).to.equal(10 * 60);
    });

    it('should return a value for a standard product when Active Data is available for the past month.', () => {
        productStub.activeData = {
            salesVelocityWeek: 1,
            salesVelocityMonth: 1
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        /**
         * Last Day: 10 hours (calculated by Salesforce)
         * Last Week: 1 / hour --> 20 / (1 / (14 / 24)) =  11.67 hours
         * Last Month: 1 / hour --> 20/ (1 / (14 / 24 )) = 11.67 hours
         *
         * Average = 10.8 --> floored = 10
         */
        expect(result).to.equal(10 * 60);
    });

    it('should return the maximum value if the calculated value is higher.', () => {
        productStub.activeData = {
            salesVelocityWeek: 0.3,
            salesVelocityMonth: 0.2
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        /**
         * Last Day: 10 hours (calculated by Salesforce)
         * Last Week: 0.3 / hour --> 20 / (0.3 / (14 / 24)) =  38.89 hours
         * Last Month: 0.2 / hour --> 20/ (0.2 / (14 / 24 )) = 58.33 hours
         *
         * Average > max --> use configured max
         */
        expect(result).to.equal(oDynamicCacheConfig.maxCacheTime * 60);
    });

    it('should return the minimum value if the calculated hours is lower the minimum.', () => {
        productStub.activeData = {
            salesVelocityWeek: 30,
            salesVelocityMonth: 30
        };

        productStub.availabilityModel.timeToOutOfStock = 0.2;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        /**
         * Last Day: 0.2 hours (calculated by Salesforce)
         * Last Week: 30 / hour --> 20 / (30 / (14 / 24)) =  0.39 hours
         * Last Month: 30 / hour --> 20/ (30 / (14 / 24 )) = 0.39 hours
         *
         * Average < min --> use configured min
         */
        expect(result).to.equal(oDynamicCacheConfig.minCacheTime * 60);
    });

    it('should not use the custom week & month calculation if the inventory record is missing.', () => {
        productStub.activeData = {
            salesVelocityWeek: 1,
            salesVelocityMonth: 2
        };

        productStub.availabilityModel.inventoryRecord = null;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        /**
         * Last Day: 10 hours (calculated by Salesforce)
         */
        expect(result).to.equal(10 * 60);
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

        /**
         * Last Day: 2000 hours (calculated by Salesforce)
         * Last Week: 0.1 / hour --> 200 / (0.1 / (14 / 24)) =  1166.67 hours
         * Last Month: 0.1 / hour --> 200 / (0.1 / (14 / 24 )) = 1166.67 hours
         *
         * Average > max --> use configured max
         */
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

        /**
         * Last Day: 8 hours (calculated by Salesforce)
         * Last Week: 50 / hour --> 200 / (50 / (14 / 24)) =  2.34 hours
         * Last Month: 50 / hour --> 200 / (50 / (14 / 24 )) = 2.34 hours
         *
         * Average = 5.17 --> floored = 5
         */
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

        /**
         * Last Day: 1 hour (calculated by Salesforce)
         * Last Week: 50 / hour --> 10 / (50 / (14 / 24)) =  0.12 hours
         * Last Month: 50 / hour --> 10 / (50 / (14 / 24 )) = 0.12 hours
         *
         * Average = 0.56 --> floored = 0 --> use configured min
         */
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

        /**
         * Last Day: 30 hour (calculated by Salesforce) --> becomes 24h as configured max
         * Last Week: 0.2 / hour --> 4 / (0.2 / (14 / 24)) =  11.67 hours
         * Last Month: 0.2 / hour --> 4 / (0.2 / (14 / 24 )) = 11.67 hours
         *
         * Average =  17.84 --> floored = 17
         */
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

        /**
         * Last Day: 6 hour (calculated by Salesforce)
         * Last Week: 0.8 / hour --> 4 / (0.8 / (14 / 24)) =  2.92 hours
         * Last Month: 0.7 / hour --> 4 / (0.7 / (14 / 24 )) = 3.33 hours
         *
         * Average =  4.56 --> floored = 4
         */
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

        /**
         * Last Day: 42 hour (calculated by Salesforce) --> converted to 24 because of configured max
         * Last Week: 0.8 / hour --> 30 / (0.8 / (14 / 24)) =  21.88 hours
         * Last Month: 0.7 / hour --> 30 / (0.7 / (14 / 24 )) = 25 hours
         *
         * Average =  23.72 --> floored = 23
         */
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

        /**
         * Last Day: 42 hour (calculated by Salesforce) --> converted to 24 because of configured max
         * Last Week: 0.8 / hour --> 200 / (0.8 / (14 / 24)) =  145.83 hours
         * Last Month: 0.7 / hour --> 200 / (0.7 / (14 / 24 )) = 166.67 hours
         *
         * Average > max --> use configured max
         */
        expect(result).to.equal(24 * 60);
    });
});