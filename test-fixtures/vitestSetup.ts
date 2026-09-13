
import { afterEach, beforeEach } from "vitest";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
  get length() { return this.map.size; }
  key(index: number) { return Array.from(this.map.keys())[index] ?? null; }
}

const local = new MemoryStorage();
const session = new MemoryStorage();

// In Node 22, localStorage is undefined unless --localstorage-file is given, breaking tests.
if (!globalThis.localStorage || typeof (globalThis.localStorage as any).clear !== "function") {
  Object.defineProperty(globalThis, "localStorage", {
    value: local,
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  try { globalThis.localStorage?.clear(); } catch {}
  try { globalThis.sessionStorage?.clear(); } catch {}
});

afterEach(() => {
  try { globalThis.localStorage?.clear(); } catch {}
  try { globalThis.sessionStorage?.clear(); } catch {}
});
