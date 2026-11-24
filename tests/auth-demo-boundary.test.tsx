import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppProvider, useApp } from "../src/context/AppContext";
import { DEMO_KEY, DEMO_SESSION, makeDemo } from "../src/lib/demo";

vi.mock("../src/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
  localizedError: (error: unknown) =>
    error instanceof Error ? error : new Error("تعذّر إتمام العملية."),
}));

function browserStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
}
const wrapper = ({ children }: { children: ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);
beforeEach(() => {
  vi.stubGlobal("localStorage", browserStorage());
  vi.stubGlobal("sessionStorage", browserStorage());
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("production authentication boundary", () => {
  it("ignores an old demo session in production and cannot reactivate it through retained test methods", async () => {
    vi.stubEnv("MODE", "production");
    const savedFixture = JSON.stringify(makeDemo());
    localStorage.setItem(DEMO_KEY, savedFixture);
    sessionStorage.setItem(DEMO_SESSION, "admin");
    const { result } = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.demo).toBe(false);
    expect(result.current.profile).toBeNull();
    expect(result.current.pairs).toEqual([]);
    await act(async () => {
      result.current.startDemo("member");
      result.current.switchDemoRole("supervisor");
      result.current.resetDemo();
    });
    expect(result.current.demo).toBe(false);
    expect(result.current.profile).toBeNull();
    expect(localStorage.getItem(DEMO_KEY)).toBe(savedFixture);
    expect(sessionStorage.getItem(DEMO_SESSION)).toBe("admin");
  });

  it("retains isolated fixtures for automated tests only", async () => {
    vi.stubEnv("MODE", "test");
    const { result } = renderHook(() => useApp(), { wrapper });
    await act(async () => result.current.startDemo("partner"));
    expect(result.current.demo).toBe(true);
    expect(result.current.profile?.id).toBe("demo-maryam");
    expect(result.current.pairs).toHaveLength(1);
  });
});
