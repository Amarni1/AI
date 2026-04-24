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

export function extractPublicKey(response) {
  if (!response) {
    return null;
  }

  if (typeof response === "string") {
    return response;
  }

  if (response.response?.publickey) {
    return response.response.publickey;
  }

  if (response.response?.publicKey) {
    return response.response.publicKey;
  }

  if (response.data?.publickey) {
    return response.data.publickey;
  }

  if (response.data?.publicKey) {
    return response.data.publicKey;
  }

  if (typeof response.data === "string") {
    return response.data;
  }

  if (response.publickey) {
    return response.publickey;
  }

  if (response.publicKey) {
    return response.publicKey;
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

function extractBlock(response) {
  const payload = extractPayload(response);

  const candidates = [
    payload?.block,
    payload?.blocknumber,
    payload?.blockNumber,
    payload?.height,
    payload?.tip,
    payload?.txpow?.header?.block,
    response?.block,
    response?.blocknumber,
    response?.blockNumber,
    response?.height
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
}

function ensureMegMethod(methodName) {
  const minimask = getMiniMask();

  if (typeof minimask.meg?.[methodName] !== "function") {
    throw new Error(`MiniMask does not support meg.${methodName} in this browser session.`);
  }

  return minimask.meg[methodName].bind(minimask.meg);
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

  getPublicKey(callback) {
    ensureMiniMask();

    if (typeof window.MINIMASK.account.getPublicKey !== "function") {
      throw new Error("MiniMask public key access is not available in this wallet.");
    }

    window.MINIMASK.account.getPublicKey((result) => {
      const publicKey = extractPublicKey(result);

      if (publicKey) {
        callback(publicKey);
        return;
      }

      logUnknownFormat("getPublicKey", result);
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

  sign(txndata, post, callback) {
    ensureMiniMask();

    if (typeof window.MINIMASK.account.sign !== "function") {
      throw new Error("MiniMask raw transaction signing is not available in this wallet.");
    }

    window.MINIMASK.account.sign(txndata, post, (result) => {
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

  block(callback) {
    const method = ensureMegMethod("block");
    method((result) => {
      const block = extractBlock(result);

      if (block !== null) {
        callback(block, extractPayload(result) ?? result);
        return;
      }

      logUnknownFormat("block", result);
      callback(null, extractPayload(result) ?? result);
    });
  },

  random(callback) {
    const method = ensureMegMethod("random");
    method((result) => {
      callback(extractPayload(result) ?? result);
    });
  },

  createSeed(seedPhrase, callback) {
    const method = ensureMegMethod("createseed");
    method(seedPhrase, (result) => {
      callback(extractPayload(result) ?? result);
    });
  },

  balanceFull(address, depth = 3, includeCoins = true, includeTokens = true, callback) {
    const method = ensureMegMethod("balancefull");
    method(address, depth, includeCoins, includeTokens, (result) => {
      callback(extractPayload(result) ?? result);
    });
  },

  megSend(amount, address, tokenid, fromAddress, privateKey, script, keyUses, split, callback) {
    const method = ensureMegMethod("send");
    method(
      String(amount),
      address,
      tokenid,
      fromAddress,
      privateKey,
      script,
      keyUses,
      split,
      (result) => {
        callback(extractPayload(result) ?? result);
      }
    );
  },

  rawTxn(inputs, outputs, scripts, state, callback) {
    const method = ensureMegMethod("rawtxn");
    method(inputs, outputs, scripts, state, (result) => {
      callback(extractPayload(result) ?? result);
    });
  },

  signTxn(txndata, privateKey, keyUses, post, callback) {
    const method = ensureMegMethod("signtxn");
    method(txndata, privateKey, keyUses, post, (result) => {
      callback(extractPayload(result) ?? result);
    });
  },

  viewTxn(txndata, callback) {
    const method = ensureMegMethod("viewtxn");
    method(txndata, (result) => {
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

  getPublicKeyAsync() {
    return new Promise((resolve, reject) => {
      try {
        this.getPublicKey((result) => resolve(result));
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

  signAsync(txndata, post) {
    return new Promise((resolve, reject) => {
      try {
        this.sign(txndata, post, (result) => resolve(result));
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
  },

  blockAsync() {
    return new Promise((resolve, reject) => {
      try {
        this.block((result, raw) => resolve(result ?? raw));
      } catch (error) {
        reject(error);
      }
    });
  },

  randomAsync() {
    return new Promise((resolve, reject) => {
      try {
        this.random((result) => resolve(result));
      } catch (error) {
        reject(error);
      }
    });
  },

  createSeedAsync(seedPhrase) {
    return new Promise((resolve, reject) => {
      try {
        this.createSeed(seedPhrase, (result) => resolve(result));
      } catch (error) {
        reject(error);
      }
    });
  },

  balanceFullAsync(address, depth = 3, includeCoins = true, includeTokens = true) {
    return new Promise((resolve, reject) => {
      try {
        this.balanceFull(address, depth, includeCoins, includeTokens, (result) => resolve(result));
      } catch (error) {
        reject(error);
      }
    });
  },

  megSendAsync(amount, address, tokenid, fromAddress, privateKey, script, keyUses, split = 1) {
    return new Promise((resolve, reject) => {
      try {
        this.megSend(
          amount,
          address,
          tokenid,
          fromAddress,
          privateKey,
          script,
          keyUses,
          split,
          (result) => resolve(result)
        );
      } catch (error) {
        reject(error);
      }
    });
  },

  rawTxnAsync(inputs, outputs, scripts, state) {
    return new Promise((resolve, reject) => {
      try {
        this.rawTxn(inputs, outputs, scripts, state, (result) => resolve(result));
      } catch (error) {
        reject(error);
      }
    });
  },

  signTxnAsync(txndata, privateKey, keyUses, post) {
    return new Promise((resolve, reject) => {
      try {
        this.signTxn(txndata, privateKey, keyUses, post, (result) => resolve(result));
      } catch (error) {
        reject(error);
      }
    });
  },

  viewTxnAsync(txndata) {
    return new Promise((resolve, reject) => {
      try {
        this.viewTxn(txndata, (result) => resolve(result));
      } catch (error) {
        reject(error);
      }
    });
  }
};
