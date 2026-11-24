import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfileInvitations from "../src/components/ProfileInvitations";
import type {
  InvitationAcceptance,
  ReceivedInvitation,
} from "../src/lib/types";

const api = vi.hoisted(() => ({ list: vi.fn(), accept: vi.fn() }));
const account = vi.hoisted(() => ({
  profile: {
    id: "aya-account",
    email: "aya@example.test",
    enabled: true,
    is_supervisor: false,
  },
}));
vi.mock("../src/context/AppContext", () => ({
  useApp: () => ({
    profile: account.profile,
    // New function identities mirror unrelated provider rerenders.
    listProfileInvitations: () => api.list(),
    acceptProfileInvitation: (id: string) => api.accept(id),
  }),
}));

function invitation(
  overrides: Partial<ReceivedInvitation> = {},
): ReceivedInvitation {
  return {
    id: "invitation-1",
    supervisor_name: "سمية",
    created_at: "2026-11-22T12:00:00Z",
    expires_at: "2030-11-29T12:00:00Z",
    accepted_at: null,
    revoked_at: null,
    state: "pending",
    ...overrides,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (value: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
function row(name: string) {
  return within(screen.getByText(`دعوة من ${name}`).closest("li")!);
}

beforeEach(() => {
  vi.resetAllMocks();
  account.profile = {
    id: "aya-account",
    email: "aya@example.test",
    enabled: true,
    is_supervisor: false,
  };
});
afterEach(cleanup);

describe("received invitations in the profile", () => {
  it("does not render or load the received inbox for a supervisor", () => {
    account.profile.is_supervisor = true;
    render(<ProfileInvitations />);
    expect(
      screen.queryByRole("region", { name: "دعواتك" }),
    ).not.toBeInTheDocument();
    expect(api.list).not.toHaveBeenCalled();
    expect(api.accept).not.toHaveBeenCalled();
  });

  it("loads lazily and shows the empty state without refetching on ordinary rerenders", async () => {
    const pending = deferred<ReceivedInvitation[]>();
    api.list.mockReturnValue(pending.promise);
    const view = render(<ProfileInvitations />);
    expect(screen.getByRole("region", { name: "دعواتك" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("جارٍ تحميل دعواتك");
    view.rerender(<ProfileInvitations />);
    expect(api.list).toHaveBeenCalledOnce();
    await act(async () => pending.resolve([]));
    expect(
      await screen.findByText("لا توجد دعوات لحسابك حاليًا."),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^قبول دعوة/ }),
    ).not.toBeInTheDocument();
  });

  it("localizes load failure and retries without exposing database setup instructions", async () => {
    const user = userEvent.setup();
    api.list
      .mockRejectedValueOnce(
        new Error("لم تكتمل تهيئة قاعدة البيانات. طبّق إعداد Supabase."),
      )
      .mockResolvedValueOnce([]);
    render(<ProfileInvitations />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "تعذّر تحميل دعواتك. حاولي مجددًا.",
    );
    expect(
      screen.queryByText(/Supabase|تهيئة قاعدة البيانات/),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(
      await screen.findByText("لا توجد دعوات لحسابك حاليًا."),
    ).toBeVisible();
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it("shows inviter, dates and history states and permits only unexpired pending acceptance", async () => {
    api.list.mockResolvedValue([
      invitation(),
      invitation({
        id: "old-accepted",
        supervisor_name: "فاطمة",
        state: "accepted",
        accepted_at: "2026-11-23T12:00:00Z",
      }),
      invitation({
        id: "old-expired",
        supervisor_name: "خديجة",
        state: "expired",
      }),
      invitation({
        id: "old-revoked",
        supervisor_name: "سارة",
        state: "revoked",
        revoked_at: "2026-11-23T10:00:00Z",
      }),
      invitation({
        id: "unavailable",
        supervisor_name: "هند",
        state: "unavailable",
      }),
      invitation({
        id: "expired-after-fetch",
        supervisor_name: "نور",
        expires_at: "2020-01-01T00:00:00Z",
      }),
    ]);
    render(<ProfileInvitations />);
    await screen.findByText("دعوة من سمية");
    expect(row("سمية").getByText("تاريخ الدعوة")).toBeVisible();
    expect(row("سمية").getByText("صالحة حتى")).toBeVisible();
    expect(screen.getAllByRole("button", { name: /^قبول دعوة/ })).toHaveLength(
      1,
    );
    expect(row("فاطمة").getByText("مقبولة")).toBeVisible();
    expect(row("فاطمة").getByText("تاريخ القبول")).toBeVisible();
    expect(row("خديجة").getByText("منتهية الصلاحية")).toBeVisible();
    expect(row("سارة").getByText("أُلغيَت")).toBeVisible();
    expect(row("هند").getByText("غير متاحة")).toBeVisible();
    expect(row("نور").getByText("منتهية الصلاحية")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "الدعوات السابقة" }),
    ).toBeVisible();
    expect(
      screen.queryByText(/pair_id|token|recipient_email/),
    ).not.toBeInTheDocument();
  });

  it("accepts once, refreshes history and explains waiting for the other member", async () => {
    const user = userEvent.setup();
    const acceptance = deferred<InvitationAcceptance>();
    api.list
      .mockResolvedValueOnce([invitation()])
      .mockResolvedValueOnce([
        invitation({ state: "accepted", accepted_at: "2026-11-24T10:00:00Z" }),
      ]);
    api.accept.mockReturnValue(acceptance.promise);
    render(<ProfileInvitations />);
    const button = await screen.findByRole("button", {
      name: "قبول دعوة سمية",
    });
    await user.dblClick(button);
    expect(api.accept).toHaveBeenCalledExactlyOnceWith("invitation-1");
    expect(button).toBeDisabled();
    await act(async () =>
      acceptance.resolve({
        pair_id: "pair-1",
        status: "pending",
        name: "رفقة النور",
      }),
    );
    expect(await screen.findByText(/ننتظر قبول الرفيق الآخر/)).toBeVisible();
    await waitFor(() => expect(row("سمية").getByText("مقبولة")).toBeVisible());
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByRole("link", { name: "فتح مساحة الرفقة" }),
    ).not.toBeInTheDocument();
  });

  it("offers the workspace only when acceptance activates the pair", async () => {
    const user = userEvent.setup();
    api.list
      .mockResolvedValueOnce([invitation()])
      .mockResolvedValueOnce([
        invitation({ state: "accepted", accepted_at: "2026-11-24T10:00:00Z" }),
      ]);
    api.accept.mockResolvedValue({
      pair_id: "pair-1",
      status: "active",
      name: "رفقة النور",
    });
    render(<ProfileInvitations />);
    await user.click(
      await screen.findByRole("button", { name: "قبول دعوة سمية" }),
    );
    expect(await screen.findByText(/أصبحت رفقة الحفظ نشطة/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "فتح مساحة الرفقة" }),
    ).toHaveAttribute("href", "#dashboard");
  });

  it("preserves localized acceptance rejection and re-enables the action", async () => {
    const user = userEvent.setup();
    api.list.mockResolvedValue([invitation()]);
    api.accept.mockRejectedValue(
      new Error("انتهت صلاحية الدعوة. اطلب رابطًا جديدًا من المشرف."),
    );
    render(<ProfileInvitations />);
    await user.click(
      await screen.findByRole("button", { name: "قبول دعوة سمية" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "انتهت صلاحية الدعوة",
    );
    expect(
      screen.getByRole("button", { name: "قبول دعوة سمية" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("link", { name: "فتح مساحة الرفقة" }),
    ).not.toBeInTheDocument();
  });

  it("discards an earlier account’s late response after the profile changes", async () => {
    const oldRequest = deferred<ReceivedInvitation[]>();
    api.list
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce([
        invitation({ id: "second-account", supervisor_name: "المشرف الجديد" }),
      ]);
    const view = render(<ProfileInvitations />);
    account.profile = {
      id: "maryam-account",
      email: "maryam@example.test",
      enabled: true,
      is_supervisor: false,
    };
    view.rerender(<ProfileInvitations />);
    expect(await screen.findByText("دعوة من المشرف الجديد")).toBeVisible();
    await act(async () =>
      oldRequest.resolve([
        invitation({ supervisor_name: "مشرف الحساب السابق" }),
      ]),
    );
    expect(
      screen.queryByText("دعوة من مشرف الحساب السابق"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("دعوة من المشرف الجديد")).toBeVisible();
  });

  it("discards an earlier account’s acceptance outcome after the profile changes", async () => {
    const user = userEvent.setup();
    const acceptance = deferred<InvitationAcceptance>();
    api.list.mockResolvedValueOnce([invitation()]).mockResolvedValueOnce([]);
    api.accept.mockReturnValueOnce(acceptance.promise);
    const view = render(<ProfileInvitations />);
    await user.click(
      await screen.findByRole("button", { name: "قبول دعوة سمية" }),
    );
    account.profile = {
      id: "maryam-account",
      email: "maryam@example.test",
      enabled: true,
      is_supervisor: false,
    };
    view.rerender(<ProfileInvitations />);
    await screen.findByText("لا توجد دعوات لحسابك حاليًا.");
    await act(async () =>
      acceptance.resolve({
        pair_id: "previous-pair",
        status: "active",
        name: "رفقة سابقة",
      }),
    );
    expect(screen.queryByText(/أصبحت رفقة الحفظ نشطة/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "فتح مساحة الرفقة" }),
    ).not.toBeInTheDocument();
    expect(api.list).toHaveBeenCalledTimes(2);
  });
});
