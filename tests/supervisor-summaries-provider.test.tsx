import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppProvider, useApp } from "../src/context/AppContext";
import { DEMO_KEY, DEMO_SESSION, makeDemo } from "../src/lib/demo";
import type { DataState } from "../src/lib/demo";
import type { Profile } from "../src/lib/types";

vi.mock("../src/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => {
      throw new Error("A local summary reached the live database");
    }),
    rpc: vi.fn(() => {
      throw new Error("A local summary reached a live RPC");
    }),
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

function multiplePairFixture(): DataState {
  const fixture = makeDemo();
  const supervisor = fixture.profiles.find(
    (profile) => profile.id === "demo-supervisor",
  )!;
  const extraProfiles: Profile[] = [
    "second-first",
    "second-partner",
    "other-supervisor",
  ].map((id, index) => ({
    ...fixture.profiles[0],
    id,
    email: `${id}@example.test`,
    display_name: `عضو ${index + 1}`,
    is_supervisor: id === "other-supervisor",
  }));
  fixture.profiles.push(...extraProfiles);
  fixture.pairs.push(
    {
      ...fixture.pairs[0],
      id: "second-pair",
      name: "رفقة ثانية",
      members: extraProfiles.slice(0, 2),
    },
    {
      ...fixture.pairs[0],
      id: "pending-pair",
      name: "رفقة معلّقة",
      status: "pending",
      members: [],
    },
    {
      ...fixture.pairs[0],
      id: "archived-pair",
      name: "رفقة سابقة",
      status: "archived",
    },
    {
      ...fixture.pairs[0],
      id: "member-only-pair",
      name: "رفقة يشرف عليها آخر",
      supervisor_id: extraProfiles[2].id,
      supervisor: extraProfiles[2],
      members: [supervisor, extraProfiles[0]],
    },
  );
  const ayaEntry = fixture.entries.find(
    (entry) => entry.owner_id === "demo-aya",
  )!;
  fixture.entries.push({
    ...ayaEntry,
    id: "aya-overlapping-entry",
    date: "2026-11-23",
    plan_hifdh: { state: "planned", ranges: [{ surah: 24, from: 5, to: 10 }] },
    actual_hifdh: {
      state: "partial",
      ranges: [
        { surah: 24, from: 5, to: 12 },
        { surah: 23, from: 1, to: 2 },
      ],
    },
    actual_revision: { state: "not_done", ranges: [] },
  });
  fixture.targets.push(
    {
      ...fixture.targets[0],
      id: "second-shared",
      pair_id: "second-pair",
      owner_id: null,
      mode: "shared",
      hifdh: [{ surah: 2, from: 1, to: 5 }],
      revision: [{ surah: 3, from: 1, to: 6 }],
    },
    {
      ...fixture.targets[0],
      id: "second-individual",
      pair_id: "second-pair",
      owner_id: extraProfiles[0].id,
      hifdh: [{ surah: 2, from: 1, to: 10 }],
    },
    {
      ...fixture.targets[0],
      id: "foreign-target",
      pair_id: "member-only-pair",
      owner_id: supervisor.id,
      hifdh: [{ surah: 1, from: 1, to: 7 }],
    },
  );
  fixture.entries.push({
    ...ayaEntry,
    id: "second-entry",
    pair_id: "second-pair",
    owner_id: extraProfiles[0].id,
    plan_hifdh: { state: "planned", ranges: [{ surah: 2, from: 1, to: 5 }] },
    plan_revision: { state: "none", ranges: [] },
    actual_hifdh: { state: "partial", ranges: [{ surah: 2, from: 1, to: 3 }] },
    actual_revision: { state: "unlogged", ranges: [] },
  });
  const meeting = fixture.meetings.find((item) => item.type === "weekly")!;
  fixture.meetings.push(
    {
      ...meeting,
      id: "past-planned-weekly",
      date: "2026-11-23",
      scheduled_at: "2026-11-23T17:00:00Z",
      status: "planned",
    },
    {
      ...meeting,
      id: "second-next-weekly",
      pair_id: "second-pair",
      date: "2026-11-25",
      scheduled_at: "2026-11-25T17:00:00Z",
    },
    {
      ...meeting,
      id: "second-last-weekly",
      pair_id: "second-pair",
      date: "2026-11-22",
      scheduled_at: "2026-11-22T17:00:00Z",
      status: "held",
    },
    {
      ...meeting,
      id: "second-daily",
      pair_id: "second-pair",
      type: "daily",
      date: "2026-11-24",
      scheduled_at: "2026-11-24T17:00:00Z",
    },
  );
  fixture.resources.push(
    { ...fixture.resources[0], id: "second-resource", pair_id: "second-pair" },
    {
      ...fixture.resources[0],
      id: "second-withdrawn",
      pair_id: "second-pair",
      status: "withdrawn",
    },
  );
  return fixture;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-24T11:00:00Z"));
  vi.stubGlobal("localStorage", browserStorage());
  vi.stubGlobal("sessionStorage", browserStorage());
  localStorage.setItem(DEMO_KEY, JSON.stringify(multiplePairFixture()));
  sessionStorage.setItem(DEMO_SESSION, "supervisor");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("all supervised pair summaries", () => {
  it("shows every own pair across lifecycle states regardless of selected workspace, excluding member-only pairs", async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const before = result.current.supervisedPairSummaries;
    expect(before.map((summary) => summary.pair.id)).toEqual([
      "demo-pair",
      "second-pair",
      "pending-pair",
      "archived-pair",
    ]);
    expect(
      before.find((summary) => summary.pair.id === "pending-pair")?.members,
    ).toEqual([]);
    await act(async () => result.current.setPairId("second-pair"));
    expect(result.current.pair?.id).toBe("second-pair");
    expect(result.current.supervisedPairSummaries).toEqual(before);
  });

  it("keeps each person's two activities separate and counts only unique in-target ayahs as completion", () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const first = result.current.supervisedPairSummaries.find(
      (summary) => summary.pair.id === "demo-pair",
    )!;
    const aya = first.members.find(
      (member) => member.profile.id === "demo-aya",
    )!;
    const maryam = first.members.find(
      (member) => member.profile.id === "demo-maryam",
    )!;
    expect(aya.hifdh).toEqual({
      targetAyahs: 10,
      plannedAyahs: 10,
      actualAyahs: 14,
      completedTargetAyahs: 10,
      unloggedDays: 1,
    });
    expect(maryam.hifdh).toEqual({
      targetAyahs: 10,
      plannedAyahs: 10,
      actualAyahs: 4,
      completedTargetAyahs: 4,
      unloggedDays: 2,
    });
    expect(aya.revision.actualAyahs).toBe(20);
    expect(aya.revision.unloggedDays).toBe(1);
    expect(maryam.revision.actualAyahs).toBe(10);
    const second = result.current.supervisedPairSummaries.find(
      (summary) => summary.pair.id === "second-pair",
    )!;
    expect(second.members[0].target?.mode).toBe("shared");
    expect(second.members[0].hifdh).toEqual({
      targetAyahs: 5,
      plannedAyahs: 5,
      actualAyahs: 3,
      completedTargetAyahs: 3,
      unloggedDays: 2,
    });
    expect(second.members[1].hifdh.actualAyahs).toBe(0);
    expect(second.members[1].hifdh.unloggedDays).toBe(3);
  });

  it("shows pair-specific weekly meetings/resources, preserving past planned meetings as planned", () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    const first = result.current.supervisedPairSummaries[0];
    const second = result.current.supervisedPairSummaries[1];
    expect(first.nextWeeklyMeeting?.id).toBe("meeting-weekly");
    expect(first.lastWeeklyMeeting?.id).toBe("past-planned-weekly");
    expect(first.lastWeeklyMeeting?.status).toBe("planned");
    expect(first.publishedResourceCount).toBe(2);
    expect(second.nextWeeklyMeeting?.id).toBe("second-next-weekly");
    expect(second.lastWeeklyMeeting?.status).toBe("held");
    expect(second.publishedResourceCount).toBe(1);
  });

  it("updates every summary on week navigation and leaves future unplanned weeks unscored", async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await act(async () => result.current.setWeek("2026-11-29"));
    expect(result.current.supervisedPairSummaries).toHaveLength(4);
    for (const summary of result.current.supervisedPairSummaries) {
      expect(summary.week_start).toBe("2026-11-29");
      for (const member of summary.members) {
        expect(member.target).toBeNull();
        expect(member.hifdh).toEqual({
          targetAyahs: 0,
          plannedAyahs: 0,
          actualAyahs: 0,
          completedTargetAyahs: 0,
          unloggedDays: 0,
        });
      }
    }
  });

  it("does not provide supervisor summaries to members, admin-only accounts, or disabled supervisors", async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await act(async () => result.current.setDemoRole("member"));
    expect(result.current.supervisedPairSummaries).toEqual([]);
    await act(async () => result.current.setDemoRole("admin"));
    expect(result.current.supervisedPairSummaries).toEqual([]);
    await act(async () =>
      result.current.setAccountEnabled("demo-supervisor", false),
    );
    await act(async () => result.current.setDemoRole("supervisor"));
    expect(result.current.profile?.enabled).toBe(false);
    expect(result.current.supervisedPairSummaries).toEqual([]);
  });
});
