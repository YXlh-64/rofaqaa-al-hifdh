import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
import { AppProvider, useApp } from "../src/context/AppContext";
import { supabase } from "../src/lib/supabase";
import { DEMO_KEY, DEMO_SESSION, makeDemo } from "../src/lib/demo";
import type {
  DailyEntry,
  Meeting,
  Pair,
  Profile,
  Resource,
  Target,
} from "../src/lib/types";

vi.mock("../src/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn(() => {
      throw new Error("A demo action reached the live database boundary.");
    }),
    rpc: vi.fn(() => {
      throw new Error("A demo action reached the live RPC boundary.");
    }),
    storage: {
      from: vi.fn(() => {
        throw new Error("A demo action reached live file storage.");
      }),
    },
  },
  localizedError: (error: unknown) =>
    error instanceof Error ? error : new Error("تعذّر إتمام العملية."),
}));

type Snapshot = {
  profile: Profile | null;
  role: string;
  demo: boolean;
  week: string;
  pair: Pair | null;
  pairs: Pair[];
  entries: DailyEntry[];
  targets: Target[];
  meetings: Meeting[];
  resources: Resource[];
};
function StateProbe() {
  const {
    profile,
    role,
    demo,
    week,
    pair,
    pairs,
    entries,
    targets,
    meetings,
    resources,
  } = useApp();
  return (
    <output data-testid="app-state" hidden>
      {JSON.stringify({
        profile,
        role,
        demo,
        week,
        pair,
        pairs,
        entries,
        targets,
        meetings,
        resources,
      })}
    </output>
  );
}
function snapshot(): Snapshot {
  return JSON.parse(
    screen.getByTestId("app-state").textContent || "{}",
  ) as Snapshot;
}
function FixtureControls() {
  const { demo, startDemo, setDemoRole } = useApp();
  return (
    <div aria-label="Test fixture controls">
      {!demo && <button onClick={() => startDemo()}>Load test fixture</button>}
      {demo && (
        <>
          <button onClick={() => setDemoRole("partner")}>
            Test role: مريم
          </button>
          <button onClick={() => setDemoRole("supervisor")}>
            Test role: مشرف
          </button>
          <button onClick={() => setDemoRole("admin")}>Test role: مسؤول</button>
        </>
      )}
    </div>
  );
}
function renderApp() {
  return render(
    <AppProvider>
      <App />
      <StateProbe />
      <FixtureControls />
    </AppProvider>,
  );
}
async function enterDemo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", { name: "Load test fixture" }),
  );
  await screen.findByRole("heading", { name: /معًا، نُثبّت/ });
}
async function changeRole(
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) {
  await user.click(screen.getByRole("button", { name: `Test role: ${name}` }));
}
function meetingCard(name: string) {
  const card = screen.getByRole("heading", { name }).closest("article");
  expect(card).not.toBeNull();
  return within(card as HTMLElement);
}
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

function seedSupervisorGroups() {
  const data = makeDemo();
  const newMembers = data.profiles.slice(0, 2).map((person, index) => ({
    ...person,
    id: `second-member-${index}`,
    email: `second-${index}@example.test`,
    display_name: index === 0 ? "سارة منصور" : "حفصة أمين",
  }));
  const second: Pair = {
    ...data.pairs[0],
    id: "second-pair",
    name: "رفقة الفجر",
    members: newMembers,
  };
  data.profiles.push(...newMembers);
  data.pairs.push(
    second,
    {
      ...data.pairs[0],
      id: "pending-pair",
      name: "رفقة تنتظر",
      status: "pending",
      members: [],
    },
    {
      ...data.pairs[0],
      id: "archived-pair",
      name: "رفقة سابقة",
      status: "archived",
    },
    {
      ...second,
      id: "unrelated-pair",
      name: "رفقة غير مرتبطة",
      supervisor_id: "another-supervisor",
    },
  );
  data.targets.push(
    ...newMembers.map((person, index) => ({
      ...data.targets[index],
      id: `second-target-${index}`,
      pair_id: second.id,
      owner_id: person.id,
      proposed_by: person.id,
      hifdh: [{ surah: 24, from: 12, to: 17 }],
    })),
  );
  data.entries.push(
    ...newMembers.map((person, index) => ({
      ...data.entries[index],
      id: `second-entry-${index}`,
      pair_id: second.id,
      owner_id: person.id,
      actual_hifdh: {
        state: "partial" as const,
        ranges: [{ surah: 24, from: 12, to: 14 }],
      },
    })),
  );
  localStorage.setItem(DEMO_KEY, JSON.stringify(data));
  sessionStorage.setItem(DEMO_SESSION, "supervisor");
  return data;
}

beforeAll(() => {
  // Node 26 exposes an unavailable global localStorage unless a backing file is supplied.
  // Browser storage belongs to this jsdom test; no real filesystem persistence is used.
  vi.stubGlobal("localStorage", browserStorage());
  vi.stubGlobal("sessionStorage", browserStorage());
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
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
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("Arabic workspace journeys with isolated test fixtures", () => {
  it("shows every supervised group on مساحتي and opens the chosen group's own workspace", async () => {
    const user = userEvent.setup();
    seedSupervisorGroups();
    renderApp();
    expect(
      await screen.findByRole("heading", { name: "مساحاتي" }),
    ).toBeVisible();
    for (const name of ["رفقة النور", "رفقة الفجر", "رفقة تنتظر", "رفقة سابقة"])
      expect(screen.getByRole("heading", { name })).toBeVisible();
    expect(screen.queryByText("رفقة غير مرتبطة")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "الرفقة الحالية" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "فتح مساحة رفقة الفجر" }),
    );
    await screen.findByRole("heading", { name: /معًا، نُثبّت/ });
    expect(snapshot().pair?.id).toBe("second-pair");
    expect(
      snapshot().entries.every((entry) => entry.pair_id === "second-pair"),
    ).toBe(true);
    expect(
      snapshot().pair?.members.map((person) => person.display_name),
    ).toEqual(["سارة منصور", "حفصة أمين"]);
    expect(location.hash).toBe("#workspace=second-pair");

    await user.selectOptions(
      screen.getByRole("combobox", { name: "الرفقة الحالية" }),
      "demo-pair",
    );
    expect(snapshot().pair?.id).toBe("demo-pair");
    expect(location.hash).toBe("#workspace=demo-pair");
    await user.click(screen.getByRole("link", { name: "مساحتي" }));
    expect(
      await screen.findByRole("heading", { name: "مساحاتي" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "رفقة الفجر" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "رفقة النور" })).toBeVisible();

    await user.click(screen.getByRole("link", { name: "الرفقاء" }));
    const secondCard = screen
      .getByRole("heading", { name: "رفقة الفجر" })
      .closest("article")!;
    await user.click(
      within(secondCard).getByRole("button", { name: "فتح مساحة الرفقة" }),
    );
    expect(snapshot().pair?.id).toBe("second-pair");
    expect(
      await screen.findByRole("button", { name: "كل مساحاتي" }),
    ).toBeVisible();
  });

  it("keeps a linked group's selection on reload and refuses an unrelated workspace link", async () => {
    seedSupervisorGroups();
    window.history.replaceState(null, "", "/#workspace=second-pair");
    const first = renderApp();
    await waitFor(() => expect(snapshot().pair?.id).toBe("second-pair"));
    expect(
      await screen.findByRole("heading", { name: /معًا، نُثبّت/ }),
    ).toBeVisible();
    first.unmount();
    const second = renderApp();
    await waitFor(() => expect(snapshot().pair?.id).toBe("second-pair"));
    expect(
      screen.queryByRole("heading", { name: "مساحاتي" }),
    ).not.toBeInTheDocument();
    second.unmount();
    window.history.replaceState(null, "", "/#workspace=unrelated-pair");
    renderApp();
    expect(
      await screen.findByRole("heading", {
        name: "هذه الرفقة غير متاحة لحسابك",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: /معًا، نُثبّت/ }),
    ).not.toBeInTheDocument();
  });

  it("starts without exposing private workspaces or a public demo entry", async () => {
    const user = userEvent.setup();
    const app = renderApp();
    expect(
      await screen.findByRole("button", { name: "تسجيل الدخول" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "خطة الأسبوع" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "استكشاف النسخة التجريبية" }),
    ).not.toBeInTheDocument();
    await enterDemo(user);
    expect(snapshot().demo).toBe(true);
    expect(snapshot().profile?.display_name).toBe("آية بن علي خوجة");
    expect(
      snapshot().pair?.members.map((member) => member.display_name),
    ).toContain("مريم عبد الرحمن");
    expect(
      snapshot()
        .entries.map((entry) => entry.actual_hifdh.ranges[0]?.to)
        .sort(),
    ).toEqual([4, 7]);
    app.unmount();
    renderApp();
    await screen.findByRole("heading", { name: /معًا، نُثبّت/ });
    expect(snapshot().profile?.id).toBe("demo-aya");
    expect(snapshot().demo).toBe(true);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it("opens editable profile settings from the top profile link using the keyboard", async () => {
    const user = userEvent.setup();
    renderApp();
    await enterDemo(user);
    const profileLink = screen.getByRole("link", {
      name: "فتح إعدادات الملف الشخصي",
    });
    expect(profileLink).toHaveAttribute("href", "#settings");
    profileLink.focus();
    await user.keyboard("{Enter}");
    expect(
      await screen.findByRole("heading", { name: "الإعدادات" }),
    ).toBeVisible();
    expect(screen.getByText("العربية", { exact: true })).toBeVisible();
    expect(screen.queryByText(/من اليمين إلى اليسار/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "بياناتك ملك لك" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "الخصوصية وحفظ البيانات" }),
    ).not.toBeInTheDocument();
    const name = screen.getByRole("textbox", { name: "الاسم الكامل" });
    await user.clear(name);
    await user.type(name, "آية بن علي خوجة الجديدة");
    await user.click(screen.getByRole("button", { name: "حفظ البيانات" }));
    await waitFor(() =>
      expect(snapshot().profile?.display_name).toBe("آية بن علي خوجة الجديدة"),
    );
    expect(screen.queryByText("استكشف الأدوار")).not.toBeInTheDocument();
  });

  it("signs out from the mobile drawer and profile settings without leaving private data or a locked page", async () => {
    const user = userEvent.setup();
    renderApp();
    await enterDemo(user);
    await user.click(screen.getByRole("link", { name: "سجلّ الإنجاز" }));
    await user.click(screen.getByRole("button", { name: "فتح قائمة التنقل" }));
    const drawer = within(
      screen.getByRole("dialog", { name: "التنقل الرئيسي" }),
    );
    const drawerLogout = drawer.getByRole("button", { name: "تسجيل الخروج" });
    expect(drawerLogout).toHaveTextContent("تسجيل الخروج");
    expect(document.body.style.overflow).toBe("hidden");
    await user.click(drawerLogout);

    expect(
      await screen.findByRole("button", { name: "تسجيل الدخول" }),
    ).toBeVisible();
    expect(snapshot()).toMatchObject({
      profile: null,
      demo: false,
      pair: null,
      pairs: [],
      entries: [],
      targets: [],
      meetings: [],
      resources: [],
    });
    expect(
      screen.queryByRole("link", { name: "خطة الأسبوع" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "التنقل الرئيسي" }),
    ).not.toBeInTheDocument();
    expect(location.hash).toBe("#dashboard");
    await waitFor(() => expect(document.body.style.overflow).toBe(""));

    await enterDemo(user);
    expect(
      screen.getByRole("button", { name: "فتح قائمة التنقل" }),
    ).toHaveAttribute("aria-expanded", "false");
    await user.click(
      screen.getByRole("link", { name: "فتح إعدادات الملف الشخصي" }),
    );
    expect(
      await screen.findByRole("heading", { name: "الإعدادات" }),
    ).toBeVisible();
    const profileLogout = within(screen.getByRole("main")).getByRole("button", {
      name: "تسجيل الخروج",
    });
    expect(profileLogout).toHaveTextContent("تسجيل الخروج");
    await user.click(profileLogout);
    expect(
      await screen.findByRole("button", { name: "تسجيل الدخول" }),
    ).toBeVisible();
    expect(snapshot().profile).toBeNull();
    expect(snapshot().pairs).toEqual([]);
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps meeting outcomes separate from both members’ progress and restricts editing by meeting type", async () => {
    const user = userEvent.setup();
    renderApp();
    await enterDemo(user);
    const originalEntries = snapshot().entries;
    await user.click(screen.getByRole("link", { name: "اللقاءات" }));
    expect(
      meetingCard("لقاء يومي بين الرفيقين").getByRole("button", {
        name: "تحديث اللقاء",
      }),
    ).toBeVisible();
    expect(
      meetingCard("لقاء أسبوعي مع المشرف").queryByRole("button", {
        name: "تحديث اللقاء",
      }),
    ).not.toBeInTheDocument();
    await user.click(
      meetingCard("لقاء يومي بين الرفيقين").getByRole("button", {
        name: "تحديث اللقاء",
      }),
    );
    const dialog = within(screen.getByRole("dialog", { name: "تحديث اللقاء" }));
    await user.selectOptions(
      dialog.getByRole("combobox", { name: /^نتيجة اللقاء/ }),
      "held",
    );
    await user.click(dialog.getByRole("button", { name: "حفظ التغييرات" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      meetingCard("لقاء يومي بين الرفيقين").getByText("تمّ اللقاء"),
    ).toBeVisible();
    expect(snapshot().entries).toEqual(originalEntries);
    expect(
      snapshot().meetings.find((meeting) => meeting.type === "weekly")?.status,
    ).toBe("planned");

    await user.click(screen.getByRole("link", { name: "الموارد" }));
    expect(
      screen.queryByRole("button", { name: "مشاركة مورد" }),
    ).not.toBeInTheDocument();
    await changeRole(user, "مشرف");
    await user.click(screen.getByRole("link", { name: "اللقاءات" }));
    expect(
      meetingCard("لقاء يومي بين الرفيقين").queryByRole("button", {
        name: "تحديث اللقاء",
      }),
    ).not.toBeInTheDocument();
    expect(
      meetingCard("لقاء أسبوعي مع المشرف").getByRole("button", {
        name: "تحديث اللقاء",
      }),
    ).toBeVisible();
    await user.click(screen.getByRole("link", { name: "الموارد" }));
    expect(screen.getByRole("button", { name: "مشاركة مورد" })).toBeVisible();

    await changeRole(user, "مسؤول");
    await user.click(screen.getByRole("link", { name: "إدارة الحسابات" }));
    expect(
      screen.getByRole("heading", { name: "إدارة الحسابات" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "خطة الأسبوع" }),
    ).not.toBeInTheDocument();
    expect(snapshot().pairs).toHaveLength(0);
    expect(snapshot().resources).toHaveLength(0);
  });

  it("requires the second member to confirm a shared target and preserves the previously logged week", async () => {
    const user = userEvent.setup();
    renderApp();
    await enterDemo(user);
    const originalEntries = snapshot().entries;
    await user.click(screen.getByRole("link", { name: "خطة الأسبوع" }));
    await user.click(screen.getByRole("button", { name: "الأسبوع التالي" }));
    const nextWeek = snapshot().week;
    await user.click(screen.getByRole("button", { name: "إضافة هدف" }));
    const editor = within(screen.getByRole("dialog", { name: "هدف الأسبوع" }));
    await user.selectOptions(
      editor.getByRole("combobox", { name: "كيف تحبّان التخطيط؟" }),
      "shared",
    );
    await user.click(
      editor.getByRole("button", { name: "إرسال الاقتراح إلى رفيقي" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      snapshot().targets.find((target) => target.mode === "shared")?.status,
    ).toBe("proposed");
    expect(
      screen.queryByRole("button", { name: "الموافقة على الهدف" }),
    ).not.toBeInTheDocument();
    await changeRole(user, "مريم");
    expect(snapshot().profile?.id).toBe("demo-maryam");
    await user.click(screen.getByRole("link", { name: "خطة الأسبوع" }));
    if (snapshot().week !== nextWeek)
      await user.click(screen.getByRole("button", { name: "الأسبوع التالي" }));
    await user.click(
      screen.getByRole("button", { name: "الموافقة على الهدف" }),
    );
    await waitFor(() =>
      expect(
        snapshot().targets.find((target) => target.mode === "shared")?.status,
      ).toBe("confirmed"),
    );
    expect(
      snapshot().targets.find((target) => target.mode === "shared")
        ?.confirmed_by,
    ).toBe("demo-maryam");
    await user.click(screen.getByRole("button", { name: "الأسبوع السابق" }));
    expect(
      snapshot().targets.filter(
        (target) =>
          target.mode === "individual" && target.status === "confirmed",
      ),
    ).toHaveLength(2);
    expect(snapshot().entries).toEqual(originalEntries);
  });
});
