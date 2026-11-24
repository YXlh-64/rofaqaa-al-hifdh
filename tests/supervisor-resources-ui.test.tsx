import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SupervisorResources from "../src/pages/SupervisorResources";
import Resources from "../src/pages/Resources";
import { number } from "../src/components/presentation";
import type {
  Pair,
  Profile,
  Resource,
  SupervisedWorkspace,
} from "../src/lib/types";

const context = vi.hoisted(() => ({
  profile: null as Profile | null,
  pair: null as Pair | null,
  resources: [] as Resource[],
  supervisedWorkspaces: [] as SupervisedWorkspace[],
  demo: false,
  storageUsageBytes: 0,
  saveResource: vi.fn(),
  withdrawResource: vi.fn(),
  downloadResource: vi.fn(),
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
function workspace(
  id = "pair-a",
  name = "رفقة النور",
  overrides: Partial<Pair> = {},
): SupervisedWorkspace {
  return {
    pair: {
      id,
      name,
      supervisor_id: "supervisor",
      status: "active",
      time_zone: "Africa/Algiers",
      created_at: "2026-01-01T00:00:00Z",
      members: [profile(`${id}-aya`, "آية"), profile(`${id}-maryam`, "مريم")],
      ...overrides,
    },
    week_start: "2026-11-22",
    targets: [],
    entries: [],
    meetings: [],
    resources: [],
    storageUsageBytes: 0,
  };
}
function resource(
  id: string,
  pairId: string,
  title: string,
  overrides: Partial<Resource> = {},
): Resource {
  return {
    id,
    pair_id: pairId,
    title,
    description: null,
    type: "link",
    url: "https://example.test/resource",
    object_key: null,
    size: null,
    mime_type: null,
    status: "published",
    week_start: null,
    surah: null,
    version: 1,
    created_at: "2026-11-22T12:00:00Z",
    ...overrides,
  };
}
function card(name: string) {
  return within(screen.getByRole("article", { name }));
}

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
});
beforeEach(() => {
  vi.resetAllMocks();
  context.profile = profile("supervisor", "سمية أمين", true);
  context.pair = null;
  context.resources = [];
  context.supervisedWorkspaces = [];
  context.storageUsageBytes = 0;
});
afterEach(cleanup);

describe("supervisor resources by team", () => {
  it("shows each assigned team's published previews independently and opens the requested team", async () => {
    const user = userEvent.setup(),
      onOpenTeam = vi.fn();
    const first = workspace(),
      second = workspace("pair-b", "رفقة الفجر"),
      unrelated = workspace("pair-other", "رفقة مشرف آخر", {
        supervisor_id: "other-supervisor",
      });
    first.resources = [
      resource("a-link", first.pair.id, "تفسير النور"),
      resource("a-file", first.pair.id, "ملف المراجعة", {
        type: "file",
        url: null,
        object_key: "pair-a/private.pdf",
        size: 200,
        mime_type: "application/pdf",
      }),
      resource("a-withdrawn", first.pair.id, "مورد مسحوب", {
        status: "withdrawn",
      }),
      resource("wrong-parent", "pair-other", "مورد لرفقة أخرى"),
    ];
    second.resources = [resource("b-link", second.pair.id, "تفسير الفجر")];
    unrelated.resources = [
      resource("other-link", unrelated.pair.id, "مورد غير مرتبط"),
    ];
    context.supervisedWorkspaces = [first, second, unrelated];
    render(<SupervisorResources onOpenTeam={onOpenTeam} />);
    expect(card("رفقة النور").getByText("تفسير النور")).toBeVisible();
    expect(card("رفقة النور").getByText("ملف المراجعة")).toBeVisible();
    expect(
      card("رفقة النور").getByText("موارد منشورة").parentElement,
    ).toHaveTextContent(number(2));
    expect(card("رفقة الفجر").getByText("تفسير الفجر")).toBeVisible();
    expect(
      card("رفقة الفجر").queryByText("تفسير النور"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /مورد مسحوب|مورد لرفقة أخرى|مورد غير مرتبط|رفقة مشرف آخر/,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /تفسير|ملف/ }),
    ).not.toBeInTheDocument();
    await user.click(
      card("رفقة الفجر").getByRole("button", {
        name: "إدارة موارد رفقة الفجر",
      }),
    );
    expect(onOpenTeam).toHaveBeenCalledExactlyOnceWith("pair-b");
    expect(context.downloadResource).not.toHaveBeenCalled();
    expect(context.saveResource).not.toHaveBeenCalled();
  });

  it("limits each preview to the three newest resources", () => {
    const team = workspace();
    team.resources = Array.from({ length: 4 }, (_, index) =>
      resource(`resource-${index}`, team.pair.id, `المورد ${index + 1}`, {
        created_at: `2026-11-${20 + index}T12:00:00Z`,
      }),
    );
    context.supervisedWorkspaces = [team];
    render(<SupervisorResources onOpenTeam={vi.fn()} />);
    expect(card(team.pair.name).getByRole("list").children).toHaveLength(3);
    expect(screen.queryByText("المورد 1")).not.toBeInTheDocument();
    expect(
      card(team.pair.name).getByText("وموارد أخرى داخل مساحة الرفقة."),
    ).toBeVisible();
  });

  it.each([
    {
      status: "pending" as const,
      frozen: false,
      cue: "تتاح مشاركة الموارد بعد تفعيل الرفقة.",
    },
    {
      status: "archived" as const,
      frozen: false,
      cue: "موارد الرفقة المؤرشفة متاحة للقراءة فقط.",
    },
    {
      status: "active" as const,
      frozen: true,
      cue: "توقّفت إضافة الموارد وتعديلها مؤقتًا لهذه الرفقة.",
    },
  ])(
    "marks $status teams as read-only and preserves the existing detail write guard",
    async ({ status, frozen, cue }) => {
      const user = userEvent.setup();
      const team = workspace("pair-a", "رفقة النور", { status, frozen });
      context.supervisedWorkspaces = [team];
      const index = render(<SupervisorResources onOpenTeam={vi.fn()} />);
      expect(screen.getByText(cue)).toBeVisible();
      expect(
        screen.queryByRole("button", { name: "مشاركة مورد" }),
      ).not.toBeInTheDocument();
      expect(
        card(team.pair.name).getByRole("button", {
          name: `إدارة موارد ${team.pair.name}`,
        }),
      ).toHaveTextContent("عرض موارد الرفقة");
      index.unmount();
      context.pair = team.pair;
      render(<Resources supervisorView />);
      const publish = screen.getByRole("button", { name: "مشاركة مورد" });
      expect(publish).toBeDisabled();
      await user.click(publish);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(context.saveResource).not.toHaveBeenCalled();
    },
  );

  it("names the selected team in the existing detail and publishes only through its existing action", async () => {
    const user = userEvent.setup(),
      onBack = vi.fn();
    const team = workspace("pair-b", "رفقة الفجر");
    context.pair = team.pair;
    context.saveResource.mockResolvedValue(undefined);
    render(<Resources supervisorView onBack={onBack} />);
    expect(
      screen.getByRole("heading", { name: "موارد رفقة الفجر", level: 1 }),
    ).toBeVisible();
    expect(
      screen.queryByText(/مواد يختارها المشرف لتعينكما/),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "كل موارد الرفقاء" }));
    expect(onBack).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "مشاركة مورد" }));
    const form = within(
      screen.getByRole("dialog", { name: "مشاركة مورد مع الرفقة" }),
    );
    await user.type(
      form.getByRole("textbox", { name: "عنوان المورد" }),
      "تدبّر الفجر",
    );
    await user.type(
      form.getByRole("textbox", { name: /^الرابط/ }),
      "https://example.test/tafsir",
    );
    await user.click(form.getByRole("button", { name: "مشاركة المورد" }));
    await waitFor(() =>
      expect(context.saveResource).toHaveBeenCalledWith(
        expect.objectContaining({
          pair_id: "pair-b",
          title: "تدبّر الفجر",
          type: "link",
          url: "https://example.test/tafsir",
        }),
        undefined,
      ),
    );
  });

  it("retains the member resources presentation", () => {
    const team = workspace();
    context.pair = team.pair;
    context.profile = team.pair.members[0];
    render(<Resources />);
    expect(
      screen.getByRole("heading", { name: "الموارد", level: 1 }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "مواد يختارها المشرف لتعينكما على الحفظ والفهم والمراجعة.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "كل موارد الرفقاء" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "مشاركة مورد" }),
    ).not.toBeInTheDocument();
  });

  it("offers pair management when no supervised teams exist", async () => {
    const user = userEvent.setup(),
      navigate = vi.fn();
    render(<SupervisorResources onOpenTeam={vi.fn()} navigate={navigate} />);
    expect(
      screen.getByRole("heading", { name: "موارد ترافق كل رفقة" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "إنشاء رفقة" }));
    expect(navigate).toHaveBeenCalledExactlyOnceWith("pairs");
  });
});
