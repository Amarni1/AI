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

function unwrapResponse(result, fallback = "") {
  if (result && typeof result === "object") {
    if ("response" in result && Array.isArray(result.response)) {
      return result.response;
    }

    if ("response" in result && result.response && typeof result.response === "object") {
      if ("address" in result.response) {
        return result.response.address;
      }

      if ("balance" in result.response) {
        return result.response.balance;
      }
    }
  }

  return result ?? fallback;
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
      callback?.(unwrapResponse(result, result));
    });
  },

  getAddress(callback) {
    ensureMiniMask();
    window.MINIMASK.account.getAddress((result) => {
      callback(unwrapResponse(result));
    });
  },

  balance(callback) {
    ensureMiniMask();
    window.MINIMASK.account.balance((result) => {
      callback(unwrapResponse(result));
    });
  },

  send(amount, address, callback) {
    ensureMiniMask();
    const safeAmount = String(amount);
    const state = { 0: safeAmount, 1: address };

    window.MINIMASK.account.send(safeAmount, address, "0x00", state, (result) => {
      callback(unwrapResponse(result, result));
    });
  },

  coins(callback) {
    ensureMiniMask();

    if (typeof window.MINIMASK.account.coins !== "function") {
      throw new Error("MiniMask transaction history is not available in this wallet.");
    }

    window.MINIMASK.account.coins((result) => {
      callback(unwrapResponse(result, []));
    });
  },

  checkTxPow(txpowid, callback) {
    const minimask = getMiniMask();

    if (typeof minimask.meg?.checktxpow !== "function") {
      throw new Error("MiniMask confirmation checks are not available in this wallet.");
    }

    minimask.meg.checktxpow(txpowid, (result) => {
      callback(unwrapResponse(result, result));
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

  sendAsync(amount, address) {
    return new Promise((resolve, reject) => {
      try {
        this.send(amount, address, (result) => resolve(result));
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
