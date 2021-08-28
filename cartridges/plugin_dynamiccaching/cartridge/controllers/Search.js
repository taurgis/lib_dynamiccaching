'use strict';

var server = require('server');
var cache = require('*/cartridge/scripts/middleware/cache');

server.extend(module.superModule);

/**
 * Append the dynamic inventory sensitive cache to all search controllers.
 */
server.append('Show', cache.applyDynamicInventorySensitiveCache);
server.append('ShowAjax', cache.applyDynamicInventorySensitiveCache);
server.append('UpdateGrid', cache.applyDynamicInventorySensitiveCache);

module.exports = server.exports();
