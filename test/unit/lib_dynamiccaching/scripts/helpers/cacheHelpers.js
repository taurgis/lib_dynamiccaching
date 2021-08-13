
'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');

require('app-module-path').addPath(process.cwd() + '/cartridges');


const cacheHelpers = require('lib_dynamiccaching/cartridge/scripts/helpers/cacheHelpers');
let productStub;

describe('Sentry Service', () => {
    beforeEach(() => {
        productStub = {
            activeData: {
                unitsWeek: null,
                unitsMonth: null
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

    it('should round down if a decimal value is returned by Salesforce.', () => {
        productStub.availabilityModel.timeToOutOfStock = 10.6;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(Math.floor(productStub.availabilityModel.timeToOutOfStock));
    });

    it('should return the fallback value if the "Time To Out Of Stock" is 0.', () => {
        productStub.availabilityModel.timeToOutOfStock = 0;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(cacheHelpers.FALLBACK_CACHE_TIME);
    });

    it('should return the fallback value if the "Time To Out Of Stock" is unknown (not able to calculate).', () => {
        productStub.availabilityModel.timeToOutOfStock = 0;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(cacheHelpers.FALLBACK_CACHE_TIME);
    });

    it('should return the fallback value if the product is no longer available to order.', () => {
        productStub.availabilityModel.isOrderable = () => false;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(cacheHelpers.FALLBACK_CACHE_TIME);
    });

    it('should return the information from the master if the product is a variant.', () => {
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

    it('should return the information from the master if the product is a variation group.', () => {
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

    it('should return a value for a standard product when active data is available.', () => {
        productStub.activeData = {
          unitsWeek: 150,
          unitsMonth: 300
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(13);
    });

    it('should return the maximum value if the calculated hours is higher than that with Active Data taken into account for week and month..', () => {
        productStub.activeData = {
            unitsWeek: 20,
            unitsMonth: 100
        };

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(cacheHelpers.LONG_CACHE_TIME);
    });

    it('should return the maximum value if the calculated hours is higher than that with Active Data taken into account for week and month..', () => {
        productStub.activeData = {
            unitsWeek: 1000,
            unitsMonth: 10000
        };

        productStub.availabilityModel.timeToOutOfStock = 0.2;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(cacheHelpers.SHORT_CACHE_TIME);
    });

    it('should not use the custom week & month calculation if the inventory record is missing.', () => {
        productStub.activeData = {
            unitsWeek: 1,
            unitsMonth: 2
        };

        productStub.availabilityModel.inventoryRecord = null;

        const result = cacheHelpers.calculateProductCacheTime(productStub);

        expect(result).to.equal(productStub.availabilityModel.timeToOutOfStock);
    });
});