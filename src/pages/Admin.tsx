import { useEffect, useState } from "react";
import { LockKeyhole, Search, ShieldCheck, UserRound } from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  FormError,
  Modal,
  useSubmit,
} from "../components/ui";
import { dateText, initials } from "../components/presentation";
import "./extras.css";

type Account = {
  id: string;
  email: string;
  display_name: string;
  enabled: boolean;
  is_supervisor: boolean;
  is_admin: boolean;
  created_at: string;
};

export default function Admin() {
  const { profile, accounts, searchAccounts, setAccountStatus } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Account[]>(accounts);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [target, setTarget] = useState<Account | null>(null);
  const [reason, setReason] = useState("");
  const { busy, error, setError, submit } = useSubmit();
  const search = async (value: string) => {
    setSearching(true);
    setSearchError("");
    try {
      setResults(await searchAccounts(value.trim()));
    } catch (e) {
      setSearchError(
        e instanceof Error && /[\u0600-\u06ff]/.test(e.message)
          ? e.message
          : "تعذّر البحث عن الحسابات. تحقّق من الاتصال ثم حاول مجددًا.",
      );
    } finally {
      setSearching(false);
    }
  };
  useEffect(() => {
    if (profile?.is_admin) void search("");
  }, [profile?.id]);
  if (!profile?.is_admin)
    return (
      <EmptyState
        title="هذه الصفحة لمسؤول النظام"
        description="إدارة الحسابات لا تمنح صلاحية الاطلاع على بيانات الرفقاء الخاصة."
      />
    );
  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">إدارة مسؤولة، وخصوصية محفوظة</p>
          <h1>إدارة الحسابات</h1>
          <p>البحث عن الحسابات وتفعيلها أو إيقافها.</p>
        </div>
        <Badge tone="gold">
          <ShieldCheck size={15} />
          مسؤول النظام
        </Badge>
      </div>
      <p className="aux-note">
        <LockKeyhole size={17} /> تعرض هذه الصفحة هوية الحساب وحالته فقط. صلاحية
        الإدارة لا تسمح بقراءة الخطط أو الملاحظات أو الملفات الخاصة.
      </p>
      <section className="panel admin-panel">
        <form
          className="account-search admin-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            void search(query);
          }}
        >
          <Field label="البحث بالاسم أو البريد الإلكتروني">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={100}
              placeholder="اسم الحساب أو البريد"
            />
          </Field>
          <Button type="submit" disabled={searching}>
            <Search size={17} />
            {searching ? "جارٍ البحث…" : "بحث"}
          </Button>
        </form>
        <FormError error={searchError} />
        {searching ? (
          <p className="aux-hint" role="status">
            جارٍ البحث عن الحسابات…
          </p>
        ) : results.length === 0 ? (
          <EmptyState
            title="لا توجد حسابات مطابقة"
            description="جرّب اسمًا آخر أو عنوان البريد الإلكتروني."
          />
        ) : (
          <div className="account-list">
            {results.map((account: Account) => (
              <article className="account-row" key={account.id}>
                <span className="avatar">{initials(account.display_name)}</span>
                <div className="account-details">
                  <strong>
                    {account.display_name}
                    {account.id === profile.id ? " (أنت)" : ""}
                  </strong>
                  <bdi dir="ltr">{account.email}</bdi>
                  <p className="aux-hint">
                    أُنشئ في {dateText(account.created_at)} ·{" "}
                    {account.is_supervisor ? "مشرف" : "عضو"}
                    {account.is_admin ? " · مسؤول النظام" : ""}
                  </p>
                </div>
                <Badge tone={account.enabled ? "teal" : "red"}>
                  {account.enabled ? "مفعّل" : "موقوف"}
                </Badge>
                <Button
                  variant={account.enabled ? "danger" : "secondary"}
                  onClick={() => {
                    setTarget(account);
                    setReason("");
                    setError("");
                  }}
                >
                  <UserRound size={15} />
                  {account.enabled ? "إيقاف الحساب" : "إعادة التفعيل"}
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>
      {target && (
        <Modal
          title={target.enabled ? "تأكيد إيقاف الحساب" : "إعادة تفعيل الحساب"}
          onClose={() => setTarget(null)}
        >
          <form
            className="aux-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(
                async () => {
                  await setAccountStatus(
                    target.id,
                    !target.enabled,
                    reason.trim(),
                  );
                  setResults((current) =>
                    current.map((account) =>
                      account.id === target.id
                        ? { ...account, enabled: !target.enabled }
                        : account,
                    ),
                  );
                },
                () => setTarget(null),
              );
            }}
          >
            <p>
              الحساب: <strong>{target.display_name}</strong>
              <br />
              <bdi dir="ltr">{target.email}</bdi>
            </p>
            <p className="aux-note">
              {target.enabled
                ? "سيُمنع الحساب من الوصول حتى من الجلسات المفتوحة، وستُجمّد الكتابة في الرفقاء المرتبطين به. لن تُنقل أي صلاحيات أو عضوية تلقائيًا."
                : "سيستعيد الحساب صلاحياته السابقة، وستُتاح الكتابة للرفقاء إذا كان جميع المشاركين مفعّلين."}
            </p>
            <Field
              label="السبب (اختياري)"
              hint="يُحفظ هذا الإجراء في سجل الإدارة مع هويتك وتوقيته."
            >
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
              />
            </Field>
            <FormError error={error} />
            <div className="aux-form-footer">
              <Button
                variant="secondary"
                type="button"
                disabled={busy}
                onClick={() => setTarget(null)}
              >
                إلغاء
              </Button>
              <Button
                variant={target.enabled ? "danger" : "primary"}
                type="submit"
                disabled={busy}
              >
                {busy
                  ? "جارٍ الحفظ…"
                  : target.enabled
                    ? "تأكيد إيقاف الحساب"
                    : "تأكيد إعادة التفعيل"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
