// cache-handler.js
// Example cache handler implementation

const NodeCache = require('node-cache');
const cache = new NodeCache();

module.exports = {
  get(key) {
    return cache.get(key);
  },
  set(key, value, ttl = 3600) { // Default TTL is 1 hour
    cache.set(key, value, ttl);
  },
  del(key) {
    cache.del(key);
  },
  clear() {
    cache.flushAll();
  },
};
