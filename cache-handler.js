// cache-handler.js
// Example cache handler implementation

const NodeCache = require('node-cache');

class CurCacheHandler {
  constructor() {
    this.cache = new NodeCache();
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value, ttl = 3600) { // Default TTL is 1 hour
    this.cache.set(key, value, ttl);
  }

  del(key) {
    this.cache.del(key);
  }

  clear() {
    this.cache.flushAll();
  }
}

module.exports = new CurCacheHandler();
