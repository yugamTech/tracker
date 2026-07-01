// Test stub — the api-client barrel imports axios.ts, which imports
// expo-secure-store (an RN-only native module). Unit tests run in Node, so we
// stub it with in-memory no-ops.
const store = new Map();
module.exports = {
  getItemAsync: async (k) => (store.has(k) ? store.get(k) : null),
  setItemAsync: async (k, v) => void store.set(k, v),
  deleteItemAsync: async (k) => void store.delete(k),
};
