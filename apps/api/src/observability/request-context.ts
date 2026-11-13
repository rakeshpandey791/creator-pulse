import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const context = new AsyncLocalStorage<{ requestId: string }>();

export function requestId() {
  return context.getStore()?.requestId ?? "unattributed";
}

export function withRequestId<T>(id: string, callback: () => T) {
  return context.run({ requestId: id }, callback);
}

export function createRequestId(candidate?: string) {
  return candidate && /^[A-Za-z0-9._-]{1,80}$/.test(candidate)
    ? candidate
    : randomUUID();
}
