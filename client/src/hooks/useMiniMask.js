import { useCallback, useEffect, useRef, useState } from "react";
import { buildWalletScript } from "../services/dexEngine";
import { MiniMask } from "../services/minimask";
import {
  buildFallbackSendableBalances,
  normalizeSendableBalances
} from "../services/sendableBalances";
import { normalizeTokenBalances } from "../services/walletData";

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 10000;

function getUnavailableMessage() {
  if (typeof window === "undefined") {
    return "MiniMask detection is only available in the browser.";
  }

  if (!window.isSecureContext && window.location.hostname !== "localhost") {
    return "MiniMask requires a secure HTTPS page to connect.";
  }

  return "MiniMask was not detected. Install MiniMask and refresh this page.";
}

export function useMiniMask() {
  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);
  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState("");
  const [tokenBalances, setTokenBalances] = useState([]);
  const [sendableBalances, setSendableBalances] = useState([]);
  const [fullBalance, setFullBalance] = useState(null);
  const [publicKey, setPublicKey] = useState("");
  const [walletScript, setWalletScript] = useState("");
  const [error, setError] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const detectMiniMask = useCallback(() => {
    const available = MiniMask.isAvailable();
    setIsAvailable(available);
    setIsReady(available);

    if (available) {
      setIsChecking(false);
      setError("");
      clearTimers();
    }

    return available;
  }, [clearTimers]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setIsChecking(false);
      return undefined;
    }

    const startPolling = () => {
      if (detectMiniMask()) {
        return;
      }

      setIsChecking(true);

      intervalRef.current = window.setInterval(() => {
        detectMiniMask();
      }, POLL_INTERVAL_MS);

      timeoutRef.current = window.setTimeout(() => {
        clearTimers();
        setIsChecking(false);
        setIsReady(false);
        setIsAvailable(MiniMask.isAvailable());
        if (!MiniMask.isAvailable()) {
          setError(getUnavailableMessage());
        }
      }, POLL_TIMEOUT_MS);
    };

    if (document.readyState === "complete") {
      startPolling();
    } else {
      window.addEventListener("load", startPolling, { once: true });
    }

    return () => {
      window.removeEventListener("load", startPolling);
      clearTimers();
    };
  }, [clearTimers, detectMiniMask]);

  const readWalletState = useCallback(async () => {
    if (!MiniMask.isAvailable()) {
      throw new Error(getUnavailableMessage());
    }

    if (!isInitialized) {
      await MiniMask.initAsync();
      setIsInitialized(true);
    }

    const nextAddress = await MiniMask.getAddressAsync();

    if (!nextAddress) {
      throw new Error("Unable to fetch wallet address.");
    }

    const [nextBalance, nextFullBalance, nextPublicKey] = await Promise.all([
      MiniMask.balanceAsync(),
      MiniMask.balanceFullAsync(nextAddress, 3, true, true).catch(() => null),
      MiniMask.getPublicKeyAsync().catch(() => "")
    ]);

    const normalizedBalances = normalizeTokenBalances(nextBalance);
    const normalizedSendable = nextFullBalance
      ? normalizeSendableBalances(nextFullBalance)
      : buildFallbackSendableBalances(normalizedBalances);
    const primaryBalance =
      normalizedSendable.find((item) => item.symbol === "MINIMA")?.sendable ||
      normalizedSendable[0]?.sendable ||
      normalizedBalances[0]?.amount ||
      String(nextBalance ?? "");

    const nextScript = buildWalletScript(nextPublicKey);

    setAddress(String(nextAddress ?? ""));
    setTokenBalances(normalizedBalances);
    setSendableBalances(normalizedSendable);
    setFullBalance(nextFullBalance);
    setPublicKey(String(nextPublicKey || ""));
    setWalletScript(nextScript);
    setBalance(primaryBalance);
    setError("");

    return {
      address: String(nextAddress ?? ""),
      balance: primaryBalance,
      fullBalance: nextFullBalance,
      publicKey: String(nextPublicKey || ""),
      sendableBalances: normalizedSendable,
      tokenBalances: normalizedBalances,
      walletScript: nextScript
    };
  }, [isInitialized]);

  const connect = useCallback(async () => {
    setIsSyncing(true);
    try {
      const nextState = await readWalletState();
      return nextState.address;
    } catch (currentError) {
      const message = currentError.message || "Unable to connect MiniMask.";
      setError(message);
      throw new Error(message);
    } finally {
      setIsSyncing(false);
    }
  }, [readWalletState]);

  const refresh = useCallback(async () => {
    setIsSyncing(true);
    try {
      return await readWalletState();
    } catch (currentError) {
      const message = currentError.message || "Unable to refresh MiniMask.";
      setError(message);
      throw new Error(message);
    } finally {
      setIsSyncing(false);
    }
  }, [readWalletState]);

  const send = useCallback(async (amount, recipientAddress, options = {}) => {
    try {
      if (!MiniMask.isAvailable()) {
        throw new Error(getUnavailableMessage());
      }

      if (!isInitialized) {
        await MiniMask.initAsync();
        setIsInitialized(true);
      }

      const result = await MiniMask.sendAsync(amount, recipientAddress, options);
      setError("");
      return result;
    } catch (currentError) {
      const message = currentError.message || "Unable to send with MiniMask.";
      setError(message);
      throw new Error(message);
    }
  }, [isInitialized]);

  const loadCoins = useCallback(async () => {
    try {
      if (!MiniMask.isAvailable()) {
        throw new Error(getUnavailableMessage());
      }

      if (!isInitialized) {
        await MiniMask.initAsync();
        setIsInitialized(true);
      }

      return await MiniMask.coinsAsync();
    } catch (currentError) {
      const message = currentError.message || "Unable to load MiniMask coins.";
      setError(message);
      throw new Error(message);
    }
  }, [isInitialized]);

  return {
    address,
    balance,
    connect,
    error,
    fullBalance,
    isInitialized,
    isSyncing,
    installLabel: isChecking ? "Checking for MiniMask..." : "Install MiniMask",
    isAvailable,
    isChecking,
    isReady,
    loadCoins,
    publicKey,
    refresh,
    send,
    sendableBalances,
    tokenBalances,
    walletScript
  };
}
