// cache-handler.js
// Simple in-memory cache handler for Next.js

const cache = new Map();

module.exports = {
  get(key) {
    return cache.get(key);
  },
  set(key, value, ttl = 3600) {
    cache.set(key, value);
    if (ttl) {
      setTimeout(() => cache.delete(key), ttl * 1000);
    }
  },
  del(key) {
    cache.delete(key);
  },
  clear() {
    cache.clear();
  },
};
