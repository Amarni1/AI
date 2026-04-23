function compactHex(value) {
  if (!value) {
    return "Unknown";
  }

  const safeValue = String(value);
  if (safeValue.length <= 14) {
    return safeValue;
  }

  return `${safeValue.slice(0, 8)}...${safeValue.slice(-4)}`;
}

function readAmount(record) {
  const candidates = [
    record.amount,
    record.balance,
    record.total,
    record.value,
    record.confirmed
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate !== "") {
      return String(candidate);
    }
  }

  return "0";
}

function readLabel(record, fallbackKey = "Minima") {
  if (record.tokenid === "0x00") {
    return "Minima";
  }

  return (
    record.name ||
    record.token ||
    record.symbol ||
    record.label ||
    fallbackKey ||
    compactHex(record.tokenid)
  );
}

function normalizeArrayBalances(rawBalance) {
  return rawBalance
    .map((record, index) => ({
      id: record.tokenid || record.id || `token-${index}`,
      token: readLabel(record, `Token ${index + 1}`),
      tokenId: record.tokenid || "",
      amount: readAmount(record)
    }))
    .filter((record) => record.amount !== "");
}

function normalizeObjectBalances(rawBalance) {
  if (
    rawBalance &&
    typeof rawBalance === "object" &&
    ("amount" in rawBalance || "balance" in rawBalance || "tokenid" in rawBalance)
  ) {
    return [
      {
        id: rawBalance.tokenid || "token-0",
        token: readLabel(rawBalance, "Minima"),
        tokenId: rawBalance.tokenid || "0x00",
        amount: readAmount(rawBalance)
      }
    ];
  }

  return Object.entries(rawBalance).map(([key, value], index) => {
    if (value && typeof value === "object") {
      return {
        id: value.tokenid || key || `token-${index}`,
        token: readLabel(value, key),
        tokenId: value.tokenid || key,
        amount: readAmount(value)
      };
    }

    return {
      id: key || `token-${index}`,
      token: key === "0x00" ? "Minima" : key,
      tokenId: key,
      amount: String(value ?? "0")
    };
  });
}

export function normalizeTokenBalances(rawBalance) {
  if (Array.isArray(rawBalance)) {
    return normalizeArrayBalances(rawBalance);
  }

  if (rawBalance && typeof rawBalance === "object") {
    return normalizeObjectBalances(rawBalance);
  }

  if (rawBalance !== undefined && rawBalance !== null && rawBalance !== "") {
    return [
      {
        id: "0x00",
        token: "Minima",
        tokenId: "0x00",
        amount: String(rawBalance)
      }
    ];
  }

  return [];
}

export function formatWalletAddress(address) {
  if (!address) {
    return "Not connected";
  }

  const safeAddress = String(address);
  if (safeAddress.length <= 18) {
    return safeAddress;
  }

  return `${safeAddress.slice(0, 10)}...${safeAddress.slice(-8)}`;
}
