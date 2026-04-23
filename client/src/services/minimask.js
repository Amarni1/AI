function ensureMiniMask() {
  if (typeof window === "undefined" || !window.MINIMASK?.account) {
    throw new Error("MiniMask is not available in this browser session.");
  }
}

function getMiniMask() {
  if (typeof window === "undefined" || !window.MINIMASK) {
    throw new Error("MiniMask is not available in this browser session.");
  }

  return window.MINIMASK;
}

function logUnknownFormat(operation, response) {
  console.warn(`[MiniMask] Unknown ${operation} response format:`, response);
}

function extractPayload(response) {
  if (!response || typeof response !== "object") {
    return response;
  }

  if ("response" in response) {
    return response.response;
  }

  if ("data" in response) {
    return response.data;
  }

  return response;
}

export function extractAddress(response) {
  if (!response) {
    return null;
  }

  if (typeof response === "string") {
    return response;
  }

  if (response.response?.address) {
    return response.response.address;
  }

  if (response.data?.address) {
    return response.data.address;
  }

  if (typeof response.data === "string") {
    return response.data;
  }

  if (typeof response.response === "string") {
    return response.response;
  }

  if (response.address) {
    return response.address;
  }

  return null;
}

function extractBalance(response) {
  if (response === undefined || response === null) {
    return null;
  }

  if (typeof response === "string" || typeof response === "number" || Array.isArray(response)) {
    return response;
  }

  if (response.response?.balance !== undefined) {
    return response.response.balance;
  }

  if (response.data?.balance !== undefined) {
    return response.data.balance;
  }

  if (response.balance !== undefined) {
    return response.balance;
  }

  const payload = extractPayload(response);
  if (payload !== undefined && payload !== response) {
    return payload;
  }

  return null;
}

function extractCoins(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.response)) {
    return response.response;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response?.response?.coins)) {
    return response.response.coins;
  }

  if (Array.isArray(response?.data?.coins)) {
    return response.data.coins;
  }

  if (Array.isArray(response?.coins)) {
    return response.coins;
  }

  return null;
}

export const MiniMask = {
  isAvailable() {
    return typeof window !== "undefined" && Boolean(window.MINIMASK?.account);
  },

  init(callback) {
    const minimask = getMiniMask();

    if (typeof minimask.init !== "function") {
      callback?.();
      return;
    }

    minimask.init((result) => {
      callback?.(extractPayload(result) ?? result);
    });
  },

  getAddress(callback) {
    ensureMiniMask();
    window.MINIMASK.account.getAddress((result) => {
      const address = extractAddress(result);

      if (address) {
        callback(address);
        return;
      }

      logUnknownFormat("getAddress", result);
      callback(null);
    });
  },

  balance(callback) {
    ensureMiniMask();
    window.MINIMASK.account.balance((result) => {
      const balance = extractBalance(result);

      if (balance !== null) {
        callback(balance);
        return;
      }

      logUnknownFormat("balance", result);
      callback([]);
    });
  },

  send(amount, address, callback, options = {}) {
    ensureMiniMask();
    const safeAmount = String(amount);
    const tokenid = options.tokenid || "0x00";
    const state = options.state || { 0: safeAmount, 1: address };

    window.MINIMASK.account.send(safeAmount, address, tokenid, state, (result) => {
      callback(extractPayload(result) ?? result);
    });
  },

  coins(callback) {
    ensureMiniMask();

    if (typeof window.MINIMASK.account.coins !== "function") {
      throw new Error("MiniMask transaction history is not available in this wallet.");
    }

    window.MINIMASK.account.coins((result) => {
      const coins = extractCoins(result);

      if (coins) {
        callback(coins);
        return;
      }

      logUnknownFormat("coins", result);
      callback([]);
    });
  },

  checkTxPow(txpowid, callback) {
    const minimask = getMiniMask();

    if (typeof minimask.meg?.checktxpow !== "function") {
      throw new Error("MiniMask confirmation checks are not available in this wallet.");
    }

    minimask.meg.checktxpow(txpowid, (result) => {
      callback(extractPayload(result) ?? result);
    });
  },

  getAddressAsync() {
    return new Promise((resolve, reject) => {
      try {
        this.getAddress((result) => resolve(result));
      } catch (error) {
        reject(error);
      }
    });
  },

  initAsync() {
    return new Promise((resolve, reject) => {
      try {
        this.init((result) => resolve(result));
      } catch (error) {
        reject(error);
      }
    });
  },

  balanceAsync() {
    return new Promise((resolve, reject) => {
      try {
        this.balance((result) => resolve(result));
      } catch (error) {
        reject(error);
      }
    });
  },

  sendAsync(amount, address, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        this.send(amount, address, (result) => resolve(result), options);
      } catch (error) {
        reject(error);
      }
    });
  },

  coinsAsync() {
    return new Promise((resolve, reject) => {
      try {
        this.coins((result) => resolve(result));
      } catch (error) {
        reject(error);
      }
    });
  },

  checkTxPowAsync(txpowid) {
    return new Promise((resolve, reject) => {
      try {
        this.checkTxPow(txpowid, (result) => resolve(result));
      } catch (error) {
        reject(error);
      }
    });
  }
};
