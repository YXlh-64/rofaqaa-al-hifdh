import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppProvider, useApp } from "../src/context/AppContext";
import { supabase } from "../src/lib/supabase";
import { makeDemo } from "../src/lib/demo";
import type { ReceivedInvitation } from "../src/lib/types";

const live = vi.hoisted(() => ({
  userId: "demo-aya",
  tables: {} as Record<string, unknown[]>,
  rpc: vi.fn(),
  reads: [] as string[],
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: live.userId } } },
        error: null,
      })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn((table: string) => ({
      select: () => {
        live.reads.push(table);
        return Object.assign(
          Promise.resolve({ data: live.tables[table] ?? [], error: null }),
          {
            eq: (_field: string, id: string) => ({
              maybeSingle: async () => ({
                data:
                  live.tables[table]?.find(
                    (row) => (row as { id: string }).id === id,
                  ) ?? null,
                error: null,
              }),
            }),
          },
        );
      },
    })),
    rpc: (name: string, args: Record<string, unknown>) => live.rpc(name, args),
  },
  localizedError: (error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : (error as { message?: string })?.message;
    return new Error(
      message && /[\u0600-\u06ff]/.test(message)
        ? message
        : "تعذّر إتمام العملية. أعد المحاولة.",
    );
  },
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
const received: ReceivedInvitation = {
  id: "received-invitation",
  supervisor_name: "المشرفة سمية",
  created_at: "2026-11-24T09:00:00Z",
  expires_at: "2026-12-01T09:00:00Z",
  accepted_at: null,
  revoked_at: null,
  state: "pending",
};

beforeEach(() => {
  cleanup();
  vi.stubGlobal("localStorage", browserStorage());
  vi.stubGlobal("sessionStorage", browserStorage());
  const fixture = makeDemo();
  live.userId = "demo-aya";
  live.tables = {
    profiles: fixture.profiles,
    pairs: fixture.pairs,
    pair_members: fixture.pairs[0].members.map((person, index) => ({
      pair_id: "demo-pair",
      slot: index + 1,
      user_id: person.id,
      accepted_at: "2026-11-22T10:00:00Z",
    })),
    weekly_targets: fixture.targets,
    daily_entries: fixture.entries,
    meetings: fixture.meetings,
    resources: fixture.resources,
    invitations: [],
  };
  live.reads = [];
  live.rpc.mockReset();
  live.rpc.mockResolvedValue({ data: [received], error: null });
});

describe("received invitations provider boundary", () => {
  it("loads inbox only on demand and lets the server derive recipient identity", async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(result.current.profile?.id).toBe("demo-aya"));
    expect(live.rpc).not.toHaveBeenCalled();
    await expect(result.current.listProfileInvitations()).resolves.toEqual([
      received,
    ]);
    expect(live.rpc).toHaveBeenCalledExactlyOnceWith("list_my_invitations", {});
    expect(result.current.invitations).toEqual([]);
  });

  it("keeps existing profile and private workspace when the inbox migration or request fails", async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(result.current.pair?.id).toBe("demo-pair"));
    const original = {
      profile: result.current.profile,
      pair: result.current.pair,
      entries: result.current.entries,
    };
    const reads = live.reads.length;
    live.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "PGRST202",
        message: "Function list_my_invitations not found",
      },
    });
    await expect(result.current.listProfileInvitations()).rejects.toThrow(
      /تعذّر/,
    );
    expect(result.current.profile).toEqual(original.profile);
    expect(result.current.pair).toEqual(original.pair);
    expect(result.current.entries).toEqual(original.entries);
    expect(result.current.error).toBe("");
    expect(live.reads).toHaveLength(reads);
  });

  it("accepts by invitation ID alone, refreshes authorized data, and selects the returned active pair", async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(result.current.pair?.id).toBe("demo-pair"));
    const secondPair = {
      ...(live.tables.pairs[0] as object),
      id: "new-pair",
      name: "رفقة جديدة",
    };
    live.tables.pairs.push(secondPair);
    live.tables.pair_members.push(
      ...live.tables.pair_members.map((row) => ({
        ...(row as object),
        pair_id: "new-pair",
      })),
    );
    const outcome = {
      pair_id: "new-pair",
      status: "active",
      name: "رفقة جديدة",
    };
    live.rpc.mockResolvedValueOnce({ data: outcome, error: null });
    const reads = live.reads.length;
    await act(async () => {
      await expect(
        result.current.acceptProfileInvitation(received.id),
      ).resolves.toEqual(outcome);
    });
    expect(live.rpc).toHaveBeenCalledExactlyOnceWith(
      "accept_profile_invitation",
      { p_invitation_id: "received-invitation" },
    );
    expect(live.reads.length).toBeGreaterThan(reads);
    expect(result.current.pair?.id).toBe("new-pair");
    expect(result.current.message).toMatch(/اكتملت الرفقة/);
  });

  it("rejects error JSON without refreshing data or reporting successful acceptance", async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(result.current.pair?.id).toBe("demo-pair"));
    const reads = live.reads.length;
    live.rpc.mockResolvedValueOnce({
      data: { error: "هذه الدعوة غير متاحة.", code: "42501" },
      error: null,
    });
    await expect(
      result.current.acceptProfileInvitation(received.id),
    ).rejects.toThrow("هذه الدعوة غير متاحة.");
    expect(result.current.pair?.id).toBe("demo-pair");
    expect(result.current.message).toBe("");
    expect(result.current.error).toBe("");
    expect(live.reads).toHaveLength(reads);
  });

  it("blocks disabled accounts before any inbox RPC", async () => {
    live.tables.profiles = live.tables.profiles.map((row) =>
      (row as { id: string }).id === live.userId
        ? { ...(row as object), enabled: false }
        : row,
    );
    const { result } = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(result.current.profile?.enabled).toBe(false));
    await expect(result.current.listProfileInvitations()).rejects.toThrow(
      /حساب مفعّل/,
    );
    await expect(
      result.current.acceptProfileInvitation(received.id),
    ).rejects.toThrow(/حساب مفعّل/);
    expect(live.rpc).not.toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith("profiles");
  });

  it("discards an acceptance response that arrives after logout without refreshing or selecting the old workspace", async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(result.current.pair?.id).toBe("demo-pair"));
    let resolveAcceptance!: (value: { data: unknown; error: null }) => void;
    live.rpc.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAcceptance = resolve;
      }),
    );
    const pending = result.current.acceptProfileInvitation(received.id);
    const rejected = expect(pending).rejects.toThrow(/تغيّرت جلسة الحساب/);
    await act(async () => {
      await result.current.logout();
    });
    const readsAfterLogout = live.reads.length;
    await act(async () => {
      resolveAcceptance({
        data: {
          pair_id: "new-pair",
          status: "active",
          name: "رفقة الحساب السابق",
        },
        error: null,
      });
      await rejected;
    });
    expect(live.reads).toHaveLength(readsAfterLogout);
    expect(result.current.profile).toBeNull();
    expect(result.current.pair).toBeNull();
    expect(result.current.message).toBe("");
  });
});
