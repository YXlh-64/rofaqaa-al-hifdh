import { beforeEach, describe, expect, it, vi } from "vitest";
import { read } from "../src/context/AppContext";

const server = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  cap: 500,
  nullCount: false,
  emptyAfterFirst: false,
  ranges: [] as [number, number][],
  orders: [] as string[][],
  selects: [] as { columns: string; options: unknown }[],
}));
vi.mock("../src/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: (columns: string, options: unknown) => {
        server.selects.push({ columns, options });
        const orders: string[] = [];
        server.orders.push(orders);
        return {
          order(key: string) {
            orders.push(key);
            return this;
          },
          range: async (start: number, end: number) => {
            server.ranges.push([start, end]);
            const sorted = [...server.rows].sort((a, b) => {
              for (const key of orders) {
                const left = a[key],
                  right = b[key];
                if (left === right) continue;
                return String(left) < String(right) ? -1 : 1;
              }
              return 0;
            });
            return {
              data:
                server.emptyAfterFirst && start > 0
                  ? []
                  : sorted.slice(start, Math.min(end + 1, start + server.cap)),
              count: server.nullCount ? null : sorted.length,
              error: null,
            };
          },
        };
      },
    })),
  },
  localizedError: (error: unknown) =>
    error instanceof Error ? error : new Error("تعذّر تحميل البيانات."),
}));

beforeEach(() => {
  server.rows = Array.from({ length: 1051 }, (_, index) => ({
    id: String(1050 - index).padStart(4, "0"),
  }));
  server.cap = 500;
  server.nullCount = false;
  server.emptyAfterFirst = false;
  server.ranges = [];
  server.orders = [];
  server.selects = [];
});

describe("complete authorized table reads", () => {
  it("loads more than two pages with stable ordering and preserves safe selected columns", async () => {
    const rows = await read<{ id: string }>("invitations", "id,expires_at");
    expect(rows).toHaveLength(1051);
    expect(rows[0].id).toBe("0000");
    expect(rows.at(-1)?.id).toBe("1050");
    expect(new Set(rows.map((row) => row.id)).size).toBe(1051);
    expect(server.ranges.map(([start]) => start)).toEqual([0, 500, 1000]);
    expect(
      server.selects.every(
        (selected) =>
          selected.columns === "id,expires_at" &&
          JSON.stringify(selected.options) === '{"count":"exact"}',
      ),
    ).toBe(true);
    expect(server.orders.every((orders) => orders.join() === "id")).toBe(true);
  });

  it("uses actual page length when the server cap is smaller than the requested range", async () => {
    server.cap = 73;
    const rows = await read<{ id: string }>("daily_entries");
    expect(rows).toHaveLength(1051);
    expect(new Set(rows.map((row) => row.id)).size).toBe(1051);
    expect(server.ranges.map(([start]) => start)).toEqual(
      Array.from({ length: 15 }, (_, index) => index * 73),
    );
  });

  it("continues without exact counts until an empty page even when every page is short", async () => {
    server.rows = server.rows.slice(0, 5);
    server.cap = 2;
    server.nullCount = true;
    expect(await read("pairs")).toHaveLength(5);
    expect(server.ranges.map(([start]) => start)).toEqual([0, 2, 4, 5]);
  });

  it("uses the membership composite key instead of requesting a nonexistent id column", async () => {
    server.rows = [
      { pair_id: "b", slot: 2 },
      { pair_id: "a", slot: 2 },
      { pair_id: "a", slot: 1 },
    ];
    server.cap = 2;
    expect(await read("pair_members")).toEqual([
      { pair_id: "a", slot: 1 },
      { pair_id: "a", slot: 2 },
      { pair_id: "b", slot: 2 },
    ]);
    expect(server.orders).toEqual([
      ["pair_id", "slot"],
      ["pair_id", "slot"],
    ]);
  });

  it("stops with reload guidance if an empty page contradicts a stale positive count", async () => {
    server.cap = 2;
    server.emptyAfterFirst = true;
    await expect(read("pairs")).rejects.toThrow(/تغيّرت البيانات أثناء التحميل/);
    expect(server.ranges).toHaveLength(2);
  });
});
