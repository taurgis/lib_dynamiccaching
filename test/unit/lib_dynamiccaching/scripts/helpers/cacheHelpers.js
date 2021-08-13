
'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');

require('app-module-path').addPath(process.cwd() + '/cartridges');


const cacheHelpers = require('lib_dynamiccaching/cartridge/scripts/helpers/cacheHelpers');
let productStub;

describe('Sentry Service', () => {
    beforeEach(() => {
        productStub = {
            isVariant: () => false,
            isVariationGroup: () => false,
            availabilityModel: {
                isOrderable: () => true,
                timeToOutOfStock: 10
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
});