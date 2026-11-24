import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SupervisorDashboard from "../src/pages/SupervisorDashboard";
import { number, shiftDate, startOfWeek } from "../src/components/presentation";
import type {
  Pair,
  Profile,
  SupervisedPairSummary,
  Target,
} from "../src/lib/types";

const context = vi.hoisted(() => ({
  profile: null as Profile | null,
  supervisedPairSummaries: [] as SupervisedPairSummary[],
  week: "2026-11-22",
  setWeek: vi.fn(),
}));
vi.mock("../src/context/AppContext", () => ({ useApp: () => context }));

function profile(id: string, name: string, supervisor = false): Profile {
  return {
    id,
    display_name: name,
    email: `${id}@example.test`,
    is_supervisor: supervisor,
    is_admin: false,
    enabled: true,
    created_at: "2026-01-01T00:00:00Z",
  };
}
function target(owner: string): Target {
  return {
    id: `target-${owner}`,
    pair_id: "pair-1",
    week_start: context.week,
    owner_id: owner,
    mode: "individual",
    status: "confirmed",
    hifdh: [{ surah: 24, from: 1, to: 10 }],
    revision: [{ surah: 23, from: 1, to: 20 }],
    note: "",
    proposed_by: owner,
    version: 1,
  };
}
function summary(
  pairOverrides: Partial<Pair> = {},
  overrides: Partial<SupervisedPairSummary> = {},
): SupervisedPairSummary {
  const aya = profile("aya", "آية بن علي خوجة"),
    maryam = profile("maryam", "مريم عبد الرحمن");
  return {
    pair: {
      id: "pair-1",
      name: "رفقة النور",
      supervisor_id: "supervisor",
      status: "active",
      time_zone: "Africa/Algiers",
      created_at: "2026-01-01T00:00:00Z",
      members: [aya, maryam],
      ...pairOverrides,
    },
    week_start: context.week,
    members: [
      {
        profile: aya,
        target: target(aya.id),
        hifdh: {
          targetAyahs: 10,
          plannedAyahs: 10,
          actualAyahs: 7,
          completedTargetAyahs: 7,
          unloggedDays: 2,
        },
        revision: {
          targetAyahs: 20,
          plannedAyahs: 20,
          actualAyahs: 12,
          completedTargetAyahs: 12,
          unloggedDays: 1,
        },
      },
      {
        profile: maryam,
        target: target(maryam.id),
        hifdh: {
          targetAyahs: 10,
          plannedAyahs: 10,
          actualAyahs: 4,
          completedTargetAyahs: 4,
          unloggedDays: 1,
        },
        revision: {
          targetAyahs: 20,
          plannedAyahs: 20,
          actualAyahs: 8,
          completedTargetAyahs: 8,
          unloggedDays: 0,
        },
      },
    ],
    nextWeeklyMeeting: null,
    lastWeeklyMeeting: null,
    publishedResourceCount: 3,
    ...overrides,
  };
}
function card(name = "رفقة النور") {
  return within(screen.getByRole("article", { name }));
}
function activity(memberName: string, activityName: string) {
  const member = within(
    screen.getByRole("region", { name: `متابعة ${memberName}` }),
  );
  return within(
    member
      .getByRole("heading", { name: activityName, level: 4 })
      .closest("div")!,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  context.profile = profile("supervisor", "سمية أمين", true);
  context.week = startOfWeek();
  context.supervisedPairSummaries = [];
});
afterEach(cleanup);

describe("supervisor overview", () => {
  it("shows every assigned pair together and opens the requested workspace", async () => {
    const user = userEvent.setup(),
      onOpenPair = vi.fn(),
      navigate = vi.fn();
    context.supervisedPairSummaries = [
      summary(),
      summary({ id: "pair-2", name: "رفقة الفرقان" }),
      summary({
        id: "other-pair",
        name: "رفقة مشرف آخر",
        supervisor_id: "another-supervisor",
      }),
    ];
    render(<SupervisorDashboard onOpenPair={onOpenPair} navigate={navigate} />);
    expect(
      screen.getByRole("heading", { name: "رفقة النور", level: 2 }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "رفقة الفرقان", level: 2 }),
    ).toBeVisible();
    expect(screen.queryByText("رفقة مشرف آخر")).not.toBeInTheDocument();
    await user.click(
      card("رفقة الفرقان").getByRole("button", {
        name: "فتح مساحة رفقة الفرقان",
      }),
    );
    expect(onOpenPair).toHaveBeenCalledExactlyOnceWith("pair-2");
    await user.click(screen.getByRole("button", { name: "إدارة الرفقاء" }));
    expect(navigate).toHaveBeenCalledWith("pairs");
  });

  it("keeps Hifdh and revision results independently attributed to each member", () => {
    context.supervisedPairSummaries = [summary()];
    render(<SupervisorDashboard onOpenPair={vi.fn()} navigate={vi.fn()} />);
    const ayaHifdh = activity("آية بن علي خوجة", "الحفظ الجديد");
    const ayaRevision = activity("آية بن علي خوجة", "المراجعة");
    const maryamHifdh = activity("مريم عبد الرحمن", "الحفظ الجديد");
    const maryamRevision = activity("مريم عبد الرحمن", "المراجعة");
    expect(
      ayaHifdh.getByText(`${number(7)} من ${number(10)} آيات الهدف`),
    ).toBeVisible();
    expect(
      ayaRevision.getByText(`${number(12)} من ${number(20)} آيات الهدف`),
    ).toBeVisible();
    expect(
      maryamHifdh.getByText(`${number(4)} من ${number(10)} آيات الهدف`),
    ).toBeVisible();
    expect(
      maryamRevision.getByText(`${number(8)} من ${number(20)} آيات الهدف`),
    ).toBeVisible();
    expect(
      ayaHifdh.getByText(`${number(2)} أيام لم يُسجّل إنجازها بعد`),
    ).toBeVisible();
    expect(ayaHifdh.getByText("المخطّط يوميًا")).toBeVisible();
    expect(
      maryamRevision.queryByText(`${number(2)} أيام لم يُسجّل إنجازها بعد`),
    ).not.toBeInTheDocument();
  });

  it("presents pending invitations and archived or frozen workspaces without implying write access", async () => {
    const user = userEvent.setup(),
      onOpenPair = vi.fn(),
      navigate = vi.fn();
    context.supervisedPairSummaries = [
      summary({
        id: "pending",
        name: "رفقة جديدة",
        status: "pending",
        members: [profile("joined", "رفيقة منضمّة")],
      }),
      summary({ id: "archived", name: "رفقة سابقة", status: "archived" }),
      summary({ id: "frozen", name: "رفقة موقوفة", frozen: true }),
    ];
    render(<SupervisorDashboard onOpenPair={onOpenPair} navigate={navigate} />);
    expect(card("رفقة جديدة").getByText("بانتظار الرفيقين")).toBeVisible();
    expect(
      card("رفقة جديدة").queryByRole("heading", { name: "الحفظ الجديد" }),
    ).not.toBeInTheDocument();
    expect(
      card("رفقة جديدة").queryByRole("button", { name: "فتح مساحة الرفقة" }),
    ).not.toBeInTheDocument();
    await user.click(
      card("رفقة جديدة").getByRole("button", { name: "إدارة الدعوات" }),
    );
    expect(navigate).toHaveBeenCalledExactlyOnceWith("pairs");
    expect(card("رفقة سابقة").getByText("سجلّ محفوظ للقراءة فقط")).toBeVisible();
    await user.click(
      card("رفقة سابقة").getByRole("button", { name: "فتح مساحة رفقة سابقة" }),
    );
    expect(onOpenPair).toHaveBeenCalledWith("archived");
    expect(card("رفقة موقوفة").getByText("الكتابة موقوفة")).toBeVisible();
    expect(card("رفقة موقوفة").getByText(/توقّفت الكتابة مؤقتًا/)).toBeVisible();
  });

  it("shows separate weekly meeting and resources information without marking overdue meetings missed", () => {
    const current = summary();
    context.supervisedPairSummaries = [
      summary(
        {},
        {
          lastWeeklyMeeting: {
            id: "weekly-1",
            pair_id: current.pair.id,
            type: "weekly",
            date: "2020-01-01",
            scheduled_at: "2020-01-01T18:00:00Z",
            link: null,
            status: "planned",
            note: null,
            updated_by: "supervisor",
            updated_at: "2020-01-01T00:00:00Z",
            version: 1,
          },
        },
      ),
    ];
    render(<SupervisorDashboard onOpenPair={vi.fn()} navigate={vi.fn()} />);
    expect(card().getByText("آخر لقاء متابعة")).toBeVisible();
    expect(card().getByText("مجدول")).toBeVisible();
    expect(card().getByText("بانتظار تسجيل النتيجة")).toBeVisible();
    expect(card().queryByText("لم يتمّ اللقاء")).not.toBeInTheDocument();
    expect(
      card().getByText("الموارد المنشورة").parentElement,
    ).toHaveTextContent(number(3));
  });

  it("shows missing targets as not applicable while retaining off-plan actuals", () => {
    const current = summary();
    context.supervisedPairSummaries = [
      summary(
        {},
        {
          members: [
            {
              ...current.members[0],
              target: null,
              hifdh: {
                targetAyahs: 0,
                plannedAyahs: 0,
                actualAyahs: 5,
                completedTargetAyahs: 0,
                unloggedDays: 0,
              },
              revision: {
                targetAyahs: 0,
                plannedAyahs: 0,
                actualAyahs: 0,
                completedTargetAyahs: 0,
                unloggedDays: 0,
              },
            },
          ],
        },
      ),
    ];
    render(<SupervisorDashboard onOpenPair={vi.fn()} navigate={vi.fn()} />);
    expect(screen.getByText("لم يُحدّد هدف أسبوعي بعد.")).toBeVisible();
    expect(
      activity("آية بن علي خوجة", "الحفظ الجديد").getByText(
        "لا ينطبق · بلا هدف أسبوعي",
      ),
    ).toBeVisible();
    expect(
      activity("آية بن علي خوجة", "الحفظ الجديد").getByText(
        `${number(5)} آيات`,
      ),
    ).toBeVisible();
    expect(screen.queryByText(/فاشل|فشل/)).not.toBeInTheDocument();
  });

  it("navigates weeks and offers a clear first-pair action for an empty supervisor", async () => {
    const user = userEvent.setup(),
      navigate = vi.fn();
    render(<SupervisorDashboard onOpenPair={vi.fn()} navigate={navigate} />);
    expect(
      screen.getByRole("heading", { name: "أول رفقة تبدأ بدعوة" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "دعوة رفيقين" }));
    expect(navigate).toHaveBeenCalledExactlyOnceWith("pairs");
    await user.click(screen.getByRole("button", { name: "الأسبوع التالي" }));
    expect(context.setWeek).toHaveBeenCalledExactlyOnceWith(
      shiftDate(context.week, 7),
    );
  });
});
