import { createClient } from "@supabase/supabase-js";
const url =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://gpkysjljythifexyutlg.supabase.co";
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_zIpBm34VKNH3GBhujzzknA_KCStyYjU";
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
export function localizedError(error: unknown): Error {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "";
  if (/[\u0600-\u06ff]/.test(message)) return new Error(message);
  if (/invalid login|invalid credentials/i.test(message))
    return new Error(
      "تعذّر تسجيل الدخول. تحقّق من البريد الإلكتروني وكلمة المرور.",
    );
  if (/email not confirmed/i.test(message))
    return new Error("أكّد بريدك الإلكتروني من رسالة التفعيل ثم سجّل الدخول.");
  if (/rate|too many/i.test(message))
    return new Error("طلبات كثيرة في وقت قصير. انتظر قليلًا ثم حاول مجددًا.");
  if (/already registered|already been registered/i.test(message))
    return new Error(
      "تعذّر إنشاء الحساب بهذه البيانات. يمكنك تسجيل الدخول أو استعادة كلمة المرور.",
    );
  if (/fetch|network/i.test(message))
    return new Error("تعذّر الاتصال بالخادم. تحقّق من الإنترنت ثم حاول مجددًا.");
  if (/schema|relation|function|PGRST/i.test(message))
    return new Error(
      "لم تكتمل تهيئة قاعدة البيانات بعد. يُرجى تطبيق ملفات إعداد Supabase أو استكشاف النسخة التجريبية.",
    );
  return new Error(
    "تعذّر إتمام العملية. تحقّق من البيانات وصلاحية الوصول ثم حاول مجددًا.",
  );
}
