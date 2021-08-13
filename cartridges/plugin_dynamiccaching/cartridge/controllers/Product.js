'use strict';

var server = require('server');
var cache = require('*/cartridge/scripts/middleware/cache');

server.extend(module.superModule);

/**
 * Append the dynamic inventory sensitive cache to all product detail controllers.
 */
server.append('Show', cache.applyDynamicInventorySensitiveCache);
server.append('ShowInCategory', cache.applyDynamicInventorySensitiveCache);
server.append('ShowQuickView', cache.applyDynamicInventorySensitiveCache);
server.append('Variation', cache.applyDynamicInventorySensitiveCache);

module.exports = server.exports();
