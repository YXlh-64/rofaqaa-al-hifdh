import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  AppProvider,
  finalizeResourceUpload,
  useApp,
} from "../src/context/AppContext";
import type { ResourceUploadAttempt } from "../src/context/AppContext";
import { makeDemo } from "../src/lib/demo";
import type { Resource } from "../src/lib/types";

const live = vi.hoisted(() => ({
  user: null as null | { id: string },
  profile: null as null | Record<string, unknown>,
  tables: [] as string[],
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: live.user ? { user: live.user } : null },
        error: null,
      })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn((table: string) => {
      live.tables.push(table);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: live.profile, error: null }),
          }),
        }),
      };
    }),
  },
  localizedError: (value: unknown) =>
    value instanceof Error ? value : new Error("تعذّر إتمام العملية."),
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
  cleanup();
  vi.stubGlobal("localStorage", browserStorage());
  vi.stubGlobal("sessionStorage", browserStorage());
  live.user = null;
  live.profile = null;
  live.tables = [];
});

describe("provider separation and lifecycle", () => {
  it("saves plans without rewriting the separately logged actuals", async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await act(async () => result.current.startDemo());
    const original = result.current.entries.find(
      (e) => e.owner_id === "demo-aya",
    )!;
    await act(async () =>
      result.current.saveDay(original.date, {
        ...original,
        kind: "plan",
        plan_hifdh: { state: "none", ranges: [] },
        actual_hifdh: { state: "not_done", ranges: [] },
      }),
    );
    const updated = result.current.entries.find((e) => e.id === original.id)!;
    expect(updated.plan_hifdh.state).toBe("none");
    expect(updated.actual_hifdh).toEqual(original.actual_hifdh);
    expect(updated.owner_id).toBe(original.owner_id);
    expect(updated.date).toBe(original.date);
    await expect(
      result.current.saveDay(original.date, { ...original, kind: "actual" }),
    ).rejects.toThrow(/تغيّر السجل/);
  });

  it("freezes writes when a participant is disabled and refuses disabling the last admin", async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await act(async () => result.current.startDemo("admin"));
    await expect(
      result.current.setAccountEnabled("demo-admin", false),
    ).rejects.toThrow(/آخر مسؤول/);
    await act(async () =>
      result.current.setAccountEnabled("demo-maryam", false),
    );
    await act(async () => result.current.switchDemoRole("member"));
    expect(result.current.pair?.frozen).toBe(true);
    const entry = result.current.entries[0];
    await expect(
      result.current.saveDay(entry.date, { ...entry, kind: "actual" }),
    ).rejects.toThrow(/للقراءة فقط/);
    expect(live.tables).toEqual([]);
  });

  it("does not fetch private records or substitute demo fixtures for a disabled live account", async () => {
    live.user = { id: "disabled-live-account" };
    live.profile = {
      id: live.user.id,
      enabled: false,
      display_name: "حساب موقوف",
      email: "disabled@example.test",
      is_supervisor: false,
      is_admin: false,
      created_at: new Date().toISOString(),
    };
    const { result } = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile?.enabled).toBe(false);
    expect(result.current.demo).toBe(false);
    expect(result.current.pairs).toEqual([]);
    expect(result.current.entries).toEqual([]);
    expect(result.current.resources).toEqual([]);
    expect(live.tables).toEqual(["profiles"]);
  });
});

describe("file publication retry boundary", () => {
  const file = new File(["%PDF-1.7 test"], "study.pdf", {
    type: "application/pdf",
  });
  const makeAttempt = (): ResourceUploadAttempt => ({
    key: "pair/stable-attempt/study.pdf",
    attempted: false,
    uploaded: false,
  });
  const resource = (): Resource => ({
    ...makeDemo().resources[0],
    created_at: "2026-11-22T10:00:00.000Z",
    id: "committed-file",
    type: "file",
    url: null,
    object_key: "pair/stable-attempt/study.pdf",
    size: file.size,
    mime_type: file.type,
  });

  it("retries an ambiguous committed publication with the same key and no duplicate file or visible record", async () => {
    const attempt = makeAttempt(),
      committed = new Map<string, Resource>();
    const upload = vi.fn(async () => ({ error: null }));
    const publish = vi.fn(async (key: string) => {
      const existing = committed.get(key);
      if (existing) return existing;
      const saved = resource();
      committed.set(key, saved);
      throw new Error("Network response was lost after commit");
    });
    const find = vi.fn(async () => ({
      data: null,
      error: "network unavailable",
    }));
    const remove = vi.fn(async () => ({ error: null }));
    const operations = { upload, publish, find, remove };
    await expect(
      finalizeResourceUpload(attempt, file, operations),
    ).rejects.toThrow(/lost after commit/);
    await expect(
      finalizeResourceUpload(attempt, file, operations),
    ).resolves.toEqual(resource());
    expect(upload).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls.map(([key]) => key)).toEqual([
      attempt.key,
      attempt.key,
    ]);
    expect(committed.size).toBe(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it("recognizes a committed record after response loss and does not attempt to clean its published object", async () => {
    const saved = resource(),
      attempt = makeAttempt();
    const operations = {
      upload: vi.fn(async () => ({ error: null })),
      publish: vi.fn(async () => {
        throw new Error("timeout");
      }),
      find: vi.fn(async () => ({ data: saved, error: null })),
      remove: vi.fn(async () => ({ error: null })),
    };
    await expect(
      finalizeResourceUpload(attempt, file, operations),
    ).resolves.toEqual(saved);
    expect(operations.remove).not.toHaveBeenCalled();
  });

  it("only tolerates a known duplicate response on a retried upload, and never treats authorization errors as success", async () => {
    const attempt = makeAttempt(),
      upload = vi
        .fn()
        .mockRejectedValueOnce(
          new Error("timeout after storage accepted bytes"),
        )
        .mockResolvedValueOnce({
          error: { statusCode: "409", message: "The resource already exists" },
        });
    const operations = {
      upload,
      publish: vi.fn(async () => resource()),
      find: vi.fn(async () => ({ data: null, error: null })),
      remove: vi.fn(async () => ({ error: null })),
    };
    await expect(
      finalizeResourceUpload(attempt, file, operations),
    ).rejects.toThrow(/timeout/);
    await expect(
      finalizeResourceUpload(attempt, file, operations),
    ).resolves.toEqual(resource());
    expect(upload.mock.calls.map(([key]) => key)).toEqual([
      attempt.key,
      attempt.key,
    ]);
    const forbidden = {
      ...operations,
      upload: vi.fn(async () => ({
        error: { statusCode: "403", message: "Unauthorized" },
      })),
      publish: vi.fn(async () => resource()),
    };
    const denied = { ...makeAttempt(), attempted: true };
    await expect(
      finalizeResourceUpload(denied, file, forbidden),
    ).rejects.toThrow();
    expect(forbidden.publish).not.toHaveBeenCalled();
  });
});
