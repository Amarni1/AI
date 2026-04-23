import { z } from "zod";

export const messageSchema = z.object({
  message: z.string().trim().min(1).max(500)
});

function sanitizeMessage(message) {
  return message.replace(/[<>]/g, "").trim();
}

function extractAmount(message) {
  const match = message.match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function extractAddress(message) {
  const match = message.match(/(mx[a-z0-9]+)/i);
  return match ? match[1] : null;
}

export function parseIntent(message) {
  const safeMessage = sanitizeMessage(message);
  const normalized = safeMessage.toLowerCase();

  if (/(hello|hi|hey|good morning|good afternoon|good evening)/.test(normalized)) {
    return { intent: "GREETING" };
  }

  if (normalized.includes("balance")) {
    return { intent: "BALANCE" };
  }

  if (normalized.includes("address")) {
    return { intent: "ADDRESS" };
  }

  if (normalized.includes("wallet") || normalized.includes("connect")) {
    return { intent: "WALLET_HELP" };
  }

  if (normalized.includes("blockchain")) {
    return { intent: "BLOCKCHAIN_HELP" };
  }

  if (normalized.includes("help")) {
    return { intent: "HELP" };
  }

  if (normalized.includes("send")) {
    return {
      intent: "SEND",
      amount: extractAmount(safeMessage),
      address: extractAddress(safeMessage)
    };
  }

  if (normalized.includes("minima")) {
    return { intent: "MINIMA_INFO" };
  }

  return { intent: "UNKNOWN" };
}
