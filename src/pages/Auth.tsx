import { useState } from "react";
import {
  BookOpen,
  CircleCheck,
  HeartHandshake,
  LockKeyhole,
  Sprout,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import Brand, { Rosette } from "../components/Brand";
import { Button, Field, FormError, useSubmit } from "../components/ui";

export default function Auth() {
  const {
    login,
    signup,
    startDemo,
    resetPassword,
    updatePassword,
    error: accountError,
  } = useApp();
  const invited =
    window.location.hash.startsWith("#invite=") ||
    !!sessionStorage.getItem("rofaqa-invite");
  const recovery =
    window.location.hash.includes("type=recovery") ||
    sessionStorage.getItem("rofaqa-recovery") === "true";
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">(
    recovery ? "reset" : "login",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, setError, submit } = useSubmit();
  const changeMode = (next: typeof mode) => {
    setMode(next);
    setSent(false);
    setError("");
  };
  return (
    <div className="auth-page">
      <aside className="auth-art">
        <Brand />
        <Rosette />
        <div className="auth-art-content">
          <span className="eyebrow">رفقةٌ صالحة، وخطوةٌ كل يوم</span>
          <div className="auth-art-title">
            نحفظُ معًا،
            <br />
            ونُثبّتُ <em>بالصحبة.</em>
          </div>
          <p>
            مساحة تجمعك برفيقك ومشرفك، لرحلةٍ مع القرآن تصنعها النية، ويُعين عليها
            الرفيق.
          </p>
          <div className="auth-features">
            <span>
              <BookOpen size={18} />
              حفظٌ ومراجعة
            </span>
            <span>
              <HeartHandshake size={18} />
              صحبةٌ ومتابعة
            </span>
            <span>
              <Sprout size={18} />
              أثرٌ ينمو
            </span>
          </div>
        </div>
        <div className="auth-art-footer">
          <LockKeyhole size={15} />
          مساحة خاصة بك، وبرفيقك، وبمشرفك
        </div>
      </aside>
      <main className="auth-form-side">
        <div className="auth-form">
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <span className="eyebrow">أهلًا بك في رفقاء الحفظ</span>
          <h1>
            {mode === "signup"
              ? "ابدأ رفقةً طيبة"
              : mode === "forgot"
                ? "استعادة كلمة المرور"
                : mode === "reset"
                  ? "كلمة مرور جديدة"
                  : "لنكمل الرحلة."}
          </h1>
          <p>
            {mode === "signup"
              ? invited
                ? "أنشئي حسابك بالبريد المدعوّ، ثم اقبلي دعوة المشرف."
                : "أنشئ حساب مشرف، وادعُ رفيقين اختارا الحفظ معًا."
              : mode === "forgot"
                ? "أدخل بريدك الإلكتروني لنرسل لك رابط الاستعادة."
                : mode === "reset"
                  ? "اختر كلمة مرور جديدة وآمنة لحسابك."
                  : "سجّل الدخول لتجد خطتك، ورفيقك، وخطوتك القادمة."}
          </p>
          {sent ? (
            <div className="recovery-note" role="status">
              <CircleCheck size={24} />
              <p>
                {mode === "forgot"
                  ? "إذا كان البريد مسجّلًا، ستصلك رسالة تتضمن رابط الاستعادة. تحقّق من البريد غير المرغوب فيه أيضًا."
                  : mode === "reset"
                    ? "تم تحديث كلمة المرور. يمكنك متابعة رحلتك."
                    : "تم استلام طلب إنشاء الحساب. تحقّق من بريدك الإلكتروني لتأكيد حسابك ثم سجّل الدخول."}
              </p>
              <Button variant="ghost" onClick={() => changeMode("login")}>
                العودة لتسجيل الدخول
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(async () => {
                  if (mode === "login") await login(email, password);
                  else if (mode === "signup") {
                    await signup(name, email, password, !invited);
                    setSent(true);
                  } else if (mode === "forgot") {
                    await resetPassword(email);
                    setSent(true);
                  } else {
                    await updatePassword(password);
                    sessionStorage.removeItem("rofaqa-recovery");
                    setSent(true);
                  }
                });
              }}
            >
              {mode === "signup" && (
                <Field label="الاسم الكامل">
                  <input
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="كيف نُناديك؟"
                    maxLength={100}
                  />
                </Field>
              )}
              {mode !== "reset" && (
                <Field label="البريد الإلكتروني">
                  <input
                    type="email"
                    required
                    dir="ltr"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                  />
                </Field>
              )}
              {mode !== "forgot" && (
                <Field
                  label="كلمة المرور"
                  hint={
                    mode === "signup" || mode === "reset"
                      ? "٨ أحرف على الأقل، مع أحرف وأرقام."
                      : undefined
                  }
                >
                  <input
                    type="password"
                    required
                    minLength={mode === "login" ? 1 : 8}
                    dir="ltr"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                  />
                </Field>
              )}
              {mode === "login" && (
                <div className="password-row">
                  <span className="mini-info">
                    <LockKeyhole size={13} />
                    دخول آمن
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => changeMode("forgot")}
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>
              )}
              {mode === "signup" && (
                <label className="consent">
                  <input type="checkbox" required />
                  <span>
                    أؤكد أن عمري ١٨ سنة أو أكثر، وأوافق على استخدام بياناتي
                    لمتابعة الحفظ ضمن تجربة خاصة.
                  </span>
                </label>
              )}
              <FormError error={error || accountError} />
              <Button type="submit" disabled={busy}>
                {busy
                  ? "لحظة من فضلك…"
                  : mode === "login"
                    ? "تسجيل الدخول"
                    : mode === "signup"
                      ? invited
                        ? "إنشاء حساب والانضمام"
                        : "إنشاء حساب مشرف"
                      : mode === "reset"
                        ? "حفظ كلمة المرور"
                        : "إرسال رابط الاستعادة"}
              </Button>
            </form>
          )}
          <div className="auth-switch">
            {mode === "login" ? (
              <>
                {invited ? "أول زيارة لكِ؟" : "تُشرف على رفيقين؟"}{" "}
                <button
                  className="text-button"
                  onClick={() => changeMode("signup")}
                >
                  {invited ? "إنشاء حساب عضو" : "إنشاء حساب مشرف"}
                </button>
              </>
            ) : (
              <button
                className="text-button"
                onClick={() => changeMode("login")}
              >
                لديك حساب؟ تسجيل الدخول
              </button>
            )}
          </div>
          <div className="auth-divider">تعرّف على المساحة أولًا</div>
          <Button
            variant="secondary"
            className="demo-button"
            onClick={() => startDemo()}
          >
            <Sprout size={18} />
            استكشاف النسخة التجريبية
          </Button>
          <p className="auth-footnote">
            بيانات تجريبية لآية ورفيقتها مريم، تُحفظ على هذا الجهاز فقط.
            <br />
            الأعضاء ينضمون عبر دعوة من المشرف.
          </p>
        </div>
      </main>
    </div>
  );
}
