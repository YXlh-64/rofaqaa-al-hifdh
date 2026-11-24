import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useApp } from "../src/context/AppContext";
import type { AppContextValue } from "../src/context/AppContext";
import type {
  Meeting,
  Pair,
  Profile,
  SupervisedWorkspace,
} from "../src/lib/types";
import SupervisorMeetings from "../src/pages/SupervisorMeetings";
import Meetings from "../src/pages/Meetings";

vi.mock("../src/context/AppContext", () => ({ useApp: vi.fn() }));

const supervisor: Profile = {
  id: "supervisor",
  email: "supervisor@example.test",
  display_name: "سمية",
  is_supervisor: true,
  is_admin: false,
  enabled: true,
  created_at: "2026-11-22T00:00:00Z",
};
const member: Profile = {
  ...supervisor,
  id: "aya",
  display_name: "آية بن علي خوجة",
  is_supervisor: false,
};
const other: Profile = { ...member, id: "maryam", display_name: "مريم" };
const team: Pair = {
  id: "team-a",
  name: "فريق الفجر",
  supervisor_id: supervisor.id,
  status: "active",
  time_zone: "Africa/Algiers",
  created_at: supervisor.created_at,
  members: [member, other],
};
function meeting(
  id: string,
  type: "daily" | "weekly",
  pairId = team.id,
): Meeting {
  return {
    id,
    pair_id: pairId,
    type,
    date: "2030-12-22",
    scheduled_at: "2030-12-22T19:00:00Z",
    link: `https://meet.example.test/${id}`,
    status: "planned",
    note: `${id} ملاحظة`,
    updated_by: supervisor.id,
    updated_at: "2026-11-22T10:00:00Z",
    version: 1,
  };
}
const weekly = meeting("weekly-a", "weekly");
const daily = meeting("daily-a", "daily");
function workspace(pair: Pair, meetings: Meeting[]): SupervisedWorkspace {
  return {
    pair,
    week_start: "2030-12-22",
    targets: [],
    entries: [],
    meetings,
    resources: [],
    storageUsageBytes: 0,
  };
}
const saveMeeting = vi.fn(async () => undefined);
function context(overrides: Partial<AppContextValue> = {}) {
  vi.mocked(useApp).mockReturnValue({
    profile: supervisor,
    pair: team,
    meetings: [weekly, daily],
    saveMeeting,
    supervisedWorkspaces: [workspace(team, [weekly, daily])],
    ...overrides,
  } as unknown as AppContextValue);
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
beforeEach(() => {
  vi.clearAllMocks();
  context();
});
afterEach(cleanup);

describe("supervisor meeting presentation", () => {
  it("separates internal and follow-up meetings within each assigned team", async () => {
    const second = { ...team, id: "team-b", name: "فريق النور" };
    const unrelated = {
      ...team,
      id: "unrelated",
      name: "فريق خارج الإشراف",
      supervisor_id: "someone-else",
    };
    const open = vi.fn();
    context({
      supervisedWorkspaces: [
        workspace(team, [
          weekly,
          daily,
          meeting("foreign-in-list", "weekly", unrelated.id),
        ]),
        workspace(second, []),
        workspace(unrelated, [meeting("foreign", "weekly", unrelated.id)]),
      ],
    });
    render(<SupervisorMeetings onOpenTeam={open} visibility="all" />);
    expect(screen.getByRole("heading", { name: "لقاءات الفرق" })).toBeTruthy();
    expect(screen.queryByText("فريق خارج الإشراف")).toBeNull();
    const first = screen.getByRole("article", { name: team.name });
    const internal = within(first).getByRole("region", {
      name: "اللقاءات الداخلية",
    });
    const followUp = within(first).getByRole("region", {
      name: "لقاءات المتابعة",
    });
    expect(within(internal).getAllByRole("listitem")).toHaveLength(1);
    expect(within(followUp).getAllByRole("listitem")).toHaveLength(1);
    expect(within(internal).getByText("بين أعضاء الفريق")).toBeTruthy();
    expect(within(followUp).getByText("بمشاركة المشرفة")).toBeTruthy();
    expect(within(first).queryByText(/اليومية|مع المشرف/)).toBeNull();
    const secondCard = screen.getByRole("article", { name: second.name });
    expect(
      within(secondCard).getAllByText("لا توجد لقاءات مسجّلة في هذا القسم."),
    ).toHaveLength(2);
    await userEvent
      .setup()
      .click(
        within(secondCard).getByRole("button", { name: "فتح لقاءات الفريق" }),
      );
    expect(open).toHaveBeenCalledWith(second.id);
  });

  it("uses neutral detail and form labels while saving the selected team's existing weekly record", async () => {
    const user = userEvent.setup();
    render(<Meetings supervisorView visibility="all" />);
    expect(
      screen.getByRole("heading", { name: `لقاءات ${team.name}` }),
    ).toBeTruthy();
    expect(screen.getByText("weekly-a ملاحظة")).toBeTruthy();
    const internal = screen.getByRole("region", { name: "اللقاءات الداخلية" });
    const followUp = screen.getByRole("region", { name: "لقاءات المتابعة" });
    expect(within(internal).getByText("daily-a ملاحظة")).toBeTruthy();
    expect(within(internal).queryByText("weekly-a ملاحظة")).toBeNull();
    expect(
      within(internal).queryByRole("button", { name: "تحديث اللقاء" }),
    ).toBeNull();
    expect(within(followUp).queryByText("daily-a ملاحظة")).toBeNull();
    expect(
      within(followUp).getByRole("button", { name: "تحديث اللقاء" }),
    ).toBeTruthy();
    expect(within(internal).getByText("آية بن علي خوجة، مريم")).toBeTruthy();
    expect(
      within(followUp).getByText("آية بن علي خوجة، مريم، سمية"),
    ).toBeTruthy();
    expect(screen.queryByRole("group", { name: "تصفية اللقاءات" })).toBeNull();
    expect(screen.queryByText(/مع المشرف|اللقاءات اليومية/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "تحديث اللقاء" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText("نوع اللقاء")).toBeNull();
    await user.selectOptions(
      within(dialog).getByLabelText("نتيجة اللقاء"),
      "held",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "حفظ التغييرات" }),
    );
    expect(saveMeeting).toHaveBeenCalledWith(
      expect.objectContaining({
        id: weekly.id,
        pair_id: team.id,
        type: "weekly",
        status: "held",
        version: 1,
      }),
    );
  });

  it("keeps member categories and member scheduling behavior", async () => {
    context({ profile: member });
    const user = userEvent.setup();
    render(<Meetings />);
    expect(screen.getByRole("group", { name: "تصفية اللقاءات" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "مع المشرف" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "لقاء يومي بين الرفيقين" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "لقاء أسبوعي مع المشرف" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "جدولة لقاء" }));
    expect(
      within(screen.getByRole("dialog")).getByLabelText("نوع اللقاء"),
    ).toBeTruthy();
  });

  it("keeps archived team meeting details read-only", () => {
    context({ pair: { ...team, status: "archived" } });
    render(<Meetings supervisorView visibility="all" />);
    expect(
      (screen.getByRole("button", { name: "جدولة لقاء" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "تحديث اللقاء" })).toBeNull();
    expect(screen.getByText(/هذا الفريق للقراءة فقط/)).toBeTruthy();
  });
});
