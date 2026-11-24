import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Auth from "../src/pages/Auth";
import Brand from "../src/components/Brand";

const actions = vi.hoisted(() => ({
  login: vi.fn(),
  signup: vi.fn(),
  resetPassword: vi.fn(),
  updatePassword: vi.fn(),
}));
const authState = vi.hoisted(() => ({
  error: "",
}));
vi.mock("../src/context/AppContext", () => ({
  useApp: () => ({ ...actions, ...authState }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(authState, {
    error: "",
  });
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("public account screens", () => {
  it("offers real account access without public demo controls or demo copy", () => {
    render(<Auth />);
    expect(screen.getByRole("button", { name: "تسجيل الدخول" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "إنشاء حساب مشرف" }),
    ).toBeVisible();
    expect(screen.queryByText(/تعرّف على المساحة أولًا/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/بيانات تجريبية|استكشاف النسخة التجريبية/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/آية ورفيقتها مريم/)).not.toBeInTheDocument();
  });

  it("submits supervisor signup with name, email and password without a required consent checkbox", async () => {
    const user = userEvent.setup();
    actions.signup.mockResolvedValue(undefined);
    render(<Auth />);
    await user.click(screen.getByRole("button", { name: "إنشاء حساب مشرف" }));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/أؤكد أن عمري|تجربة خاصة/),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByRole("textbox", { name: "الاسم الكامل" }),
      "آية بن علي خوجة",
    );
    await user.type(
      screen.getByRole("textbox", { name: "البريد الإلكتروني" }),
      "aya@example.test",
    );
    await user.type(screen.getByLabelText(/^كلمة المرور/), "SafePassword42");
    await user.click(screen.getByRole("button", { name: "إنشاء حساب مشرف" }));
    await waitFor(() =>
      expect(actions.signup).toHaveBeenCalledWith(
        "آية بن علي خوجة",
        "aya@example.test",
        "SafePassword42",
        true,
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "تحقّق من بريدك الإلكتروني لتأكيد حسابك",
    );
  });

  it("keeps invited signup as a member", async () => {
    const user = userEvent.setup();
    actions.signup.mockResolvedValue(undefined);
    window.history.replaceState(null, "", "/#invite=opaque-invitation");
    render(<Auth />);
    await user.click(screen.getByRole("button", { name: "إنشاء حساب عضو" }));
    await user.type(
      screen.getByRole("textbox", { name: "الاسم الكامل" }),
      "مريم",
    );
    await user.type(
      screen.getByRole("textbox", { name: "البريد الإلكتروني" }),
      "maryam@example.test",
    );
    await user.type(screen.getByLabelText(/^كلمة المرور/), "SafePassword42");
    await user.click(
      screen.getByRole("button", { name: "إنشاء حساب والانضمام" }),
    );
    await waitFor(() =>
      expect(actions.signup).toHaveBeenCalledWith(
        "مريم",
        "maryam@example.test",
        "SafePassword42",
        false,
      ),
    );
  });

  it("uses the favicon artwork for the brand without duplicating its accessible name", () => {
    const { container } = render(<Brand />);
    const mark = container.querySelector("img.brand-mark");
    expect(mark).toHaveAttribute(
      "src",
      `${import.meta.env.BASE_URL}favicon.svg`,
    );
    expect(mark).toHaveAttribute("alt", "");
    expect(mark).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("رفقاء الحفظ")).toBeVisible();
    expect(container.querySelector(".brand-mark > span")).toBeNull();
  });
});
