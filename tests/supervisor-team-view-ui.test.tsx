import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SupervisorTeamView from "../src/pages/SupervisorTeamView";
import { makeDemo } from "../src/lib/demo";
import type {
  Pair,
  Profile,
  SupervisedPairSummary,
  SupervisedWorkspace,
} from "../src/lib/types";

const context = vi.hoisted(() => ({
  profile: null as Profile | null,
  pair: null as Pair | null,
  supervisedWorkspaces: [] as SupervisedWorkspace[],
  supervisedPairSummaries: [] as SupervisedPairSummary[],
  week: "2026-11-22",
  setWeek: vi.fn(),
}));
vi.mock("../src/context/AppContext", () => ({ useApp: () => context }));

function renderView() {
  const props = {
    onBack: vi.fn(),
    onResources: vi.fn(),
    onMeetings: vi.fn(),
    onManageInvites: vi.fn(),
  };
  return { ...render(<SupervisorTeamView {...props} />), ...props };
}
beforeEach(() => {
  vi.clearAllMocks();
  const fixture = makeDemo();
  context.profile = fixture.profiles.find(
    (profile) => profile.id === "demo-supervisor",
  )!;
  context.pair = fixture.pairs[0];
  context.week = fixture.targets[0].week_start;
  fixture.entries[0].plan_hifdh = { state: "none", ranges: [] };
  fixture.entries[0].actual_hifdh = { state: "unlogged", ranges: [] };
  fixture.entries[0].actual_revision = { state: "not_done", ranges: [] };
  context.supervisedWorkspaces = [
    {
      pair: context.pair,
      week_start: context.week,
      targets: fixture.targets,
      entries: fixture.entries,
      meetings: fixture.meetings,
      resources: fixture.resources,
      storageUsageBytes: 0,
    },
  ];
  context.supervisedPairSummaries = [];
});
afterEach(cleanup);

describe("readonly supervisor team workspace", () => {
  it("shows each member's targets and seven days of separate plans/actuals without member editing controls", () => {
    renderView();
    expect(
      screen.getByRole("heading", { name: "رفقة النور", level: 1 }),
    ).toBeVisible();
    for (const name of ["آية بن علي خوجة", "مريم عبد الرحمن"]) {
      const member = within(
        screen.getByRole("region", { name: `متابعة ${name}` }),
      );
      expect(
        member.getByRole("heading", { name: "هدف الأسبوع", level: 3 }),
      ).toBeVisible();
      const table = within(member.getByRole("table"));
      expect(table.getAllByRole("row")).toHaveLength(8);
      for (const label of [
        "خطة الحفظ",
        "إنجاز الحفظ",
        "خطة المراجعة",
        "إنجاز المراجعة",
      ])
        expect(table.getByRole("columnheader", { name: label })).toBeVisible();
    }
    const aya = within(
      screen.getByRole("region", { name: "متابعة آية بن علي خوجة" }),
    );
    expect(aya.getByText("لم يُنجز")).toBeVisible();
    expect(aya.getAllByText("لم يُسجّل بعد").length).toBeGreaterThan(0);
    expect(aya.getByText("لا يوجد هدف لهذا النشاط اليوم")).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: /تسجيل إنجاز|تعديل الخطة|إضافة هدف|حفظ الإنجاز/,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/معًا، نُثبّت|على مهل|خطوتك اليوم/),
    ).not.toBeInTheDocument();
  });

  it("opens team resources/meetings through the supplied callbacks and offers a return to all workspaces", async () => {
    const user = userEvent.setup(),
      view = renderView();
    await user.click(screen.getByRole("button", { name: "موارد الرفقة" }));
    await user.click(screen.getByRole("button", { name: "لقاءات الرفقة" }));
    await user.click(
      screen.getByRole("button", { name: "العودة إلى مساحاتي" }),
    );
    expect(view.onResources).toHaveBeenCalledOnce();
    expect(view.onMeetings).toHaveBeenCalledOnce();
    expect(view.onBack).toHaveBeenCalledOnce();
  });

  it("shows pending membership and invitation management before opening any weekly records", async () => {
    context.pair = {
      ...context.pair!,
      status: "pending",
      members: context.pair!.members.slice(0, 1),
    };
    context.supervisedWorkspaces[0].pair = context.pair;
    const user = userEvent.setup(),
      view = renderView();
    expect(
      screen.getByRole("heading", { name: "بانتظار اكتمال الانضمام" }),
    ).toBeVisible();
    expect(screen.getByText(/آية بن علي خوجة · قَبِل الدعوة/)).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "الأسبوع التالي" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "إدارة الدعوات" }));
    expect(view.onManageInvites).toHaveBeenCalledOnce();
  });

  it.each(["archived", "frozen"] as const)(
    "preserves %s records with a clear readonly lifecycle cue",
    (state) => {
      context.pair = {
        ...context.pair!,
        ...(state === "archived"
          ? { status: "archived" as const }
          : { frozen: true }),
      };
      context.supervisedWorkspaces[0].pair = context.pair;
      renderView();
      expect(
        screen.getByText(
          state === "archived" ? /هذه الرفقة مؤرشفة/ : /توقّفت الكتابة مؤقتًا/,
        ),
      ).toBeVisible();
      expect(screen.getAllByRole("table")).toHaveLength(2);
    },
  );

  it("denies a nonassigned pair and never renders its members or records", () => {
    context.pair = {
      ...context.pair!,
      name: "رفقة غير مسندة",
      supervisor_id: "someone-else",
    };
    renderView();
    expect(
      screen.getByRole("heading", { name: "مساحة الرفقة غير متاحة" }),
    ).toBeVisible();
    expect(screen.queryByText("آية بن علي خوجة")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
