import { useCallback, useEffect, useRef, useState } from "react";
import { MiniMask } from "../services/minimask";
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
  const [error, setError] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

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

  const connect = useCallback(async () => {
    try {
      if (!MiniMask.isAvailable()) {
        throw new Error(getUnavailableMessage());
      }

      if (!isInitialized) {
        await MiniMask.initAsync();
        setIsInitialized(true);
      }

      const [nextAddress, nextBalance] = await Promise.all([
        MiniMask.getAddressAsync(),
        MiniMask.balanceAsync()
      ]);
      const normalizedBalances = normalizeTokenBalances(nextBalance);

      setAddress(String(nextAddress ?? ""));
      setTokenBalances(normalizedBalances);
      setBalance(normalizedBalances[0]?.amount ?? String(nextBalance ?? ""));
      setError("");
      return String(nextAddress ?? "");
    } catch (currentError) {
      const message = currentError.message || "Unable to connect MiniMask.";
      setError(message);
      throw new Error(message);
    }
  }, [isInitialized]);

  const refresh = useCallback(async () => {
    try {
      if (!MiniMask.isAvailable()) {
        throw new Error(getUnavailableMessage());
      }

      if (!isInitialized) {
        await MiniMask.initAsync();
        setIsInitialized(true);
      }

      const [nextAddress, nextBalance] = await Promise.all([
        MiniMask.getAddressAsync(),
        MiniMask.balanceAsync()
      ]);
      const normalizedBalances = normalizeTokenBalances(nextBalance);

      setAddress(String(nextAddress ?? ""));
      setBalance(normalizedBalances[0]?.amount ?? String(nextBalance ?? ""));
      setTokenBalances(normalizedBalances);
      setError("");

      return {
        address: String(nextAddress ?? ""),
        balance: normalizedBalances[0]?.amount ?? String(nextBalance ?? ""),
        tokenBalances: normalizedBalances
      };
    } catch (currentError) {
      const message = currentError.message || "Unable to refresh MiniMask.";
      setError(message);
      throw new Error(message);
    }
  }, [isInitialized]);

  const send = useCallback(async (amount, recipientAddress) => {
    try {
      if (!MiniMask.isAvailable()) {
        throw new Error(getUnavailableMessage());
      }

      if (!isInitialized) {
        await MiniMask.initAsync();
        setIsInitialized(true);
      }

      const result = await MiniMask.sendAsync(amount, recipientAddress);
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
    isInitialized,
    installLabel: isChecking ? "Checking for MiniMask..." : "Install MiniMask",
    isAvailable,
    isChecking,
    isReady,
    loadCoins,
    refresh,
    send,
    tokenBalances
  };
}
