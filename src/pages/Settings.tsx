import { useEffect, useState } from "react";
import {
  FlaskConical,
  Globe2,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  Badge,
  Button,
  Field,
  FormError,
  Modal,
  SaveButton,
  SectionTitle,
  useSubmit,
} from "../components/ui";
import { initials } from "../components/presentation";
import "./extras.css";

export default function SettingsPage() {
  const { profile, demo, role, updateProfile, setDemoRole, resetDemo } =
    useApp();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [resetting, setResetting] = useState(false);
  const [saved, setSaved] = useState(false);
  const { busy, error, submit } = useSubmit();
  useEffect(() => {
    setName(profile?.display_name ?? "");
    setSaved(false);
  }, [profile?.id]);
  if (!profile) return null;
  const roles = [
    { id: "member", title: "آية", icon: UserRound },
    { id: "partner", title: "مريم", icon: UserRound },
    { id: "supervisor", title: "مشرف", icon: Globe2 },
    { id: "admin", title: "مسؤول", icon: ShieldCheck },
  ] as const;
  return (
    <div className="settings-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">مساحتك كما تحبّها</p>
          <h1>الإعدادات</h1>
          <p>بيانات حسابك، وتفاصيل تجربتك في رفقاء الحفظ.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <SectionTitle
            title="الملف الشخصي"
            subtitle="نكتفي بالبيانات اللازمة للتعرّف إليك داخل الرفقة."
          />
          <div className="flex">
            <span className="avatar avatar-gold">
              {initials(profile.display_name)}
            </span>
            <div>
              <strong>{profile.display_name}</strong>
              <div>
                <Badge tone="teal">
                  {role === "member"
                    ? "عضو في الرفقة"
                    : role === "supervisor"
                      ? "مشرف"
                      : "مسؤول النظام"}
                </Badge>
                {profile.is_admin && role !== "admin" && (
                  <Badge tone="gold">صلاحية إدارة الحسابات</Badge>
                )}
              </div>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSaved(false);
              void submit(
                () => updateProfile(name.trim()),
                () => setSaved(true),
              );
            }}
          >
            <Field label="الاسم الكامل">
              <input
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                maxLength={100}
              />
            </Field>
            <Field
              label="البريد الإلكتروني"
              hint="هوية الدخول المرتبطة بدعواتك؛ لا تتغيّر من هذا النموذج."
            >
              <input type="email" dir="ltr" value={profile.email} readOnly />
            </Field>
            <FormError error={error} />
            {saved && (
              <p className="aux-success" role="status">
                حُفظ اسمك بنجاح.
              </p>
            )}
            <div className="form-actions">
              <SaveButton busy={busy}>حفظ البيانات</SaveButton>
            </div>
          </form>
        </section>
        <div className="stack">
          <section className="panel">
            <SectionTitle title="إعدادات المساحة" />
            <div className="settings-list">
              <div>
                <strong>اللغة</strong>
                <p>العربية · من اليمين إلى اليسار</p>
              </div>
              <div>
                <strong>الأسبوع والتوقيت</strong>
                <p>
                  من الأحد إلى السبت · توقيت الجزائر <bdi>Africa/Algiers</bdi>
                </p>
              </div>
              <div>
                <strong>الخصوصية</strong>
                <p>
                  خططك وإنجازاتك ولقاءاتك ومواردك لا تظهر إلا لرفيقك والمشرف
                  المكلّف.
                </p>
              </div>
            </div>
          </section>
          <section className="panel">
            <SectionTitle
              title="بياناتك ملك لك"
              action={<LockKeyhole size={19} className="gold" />}
            />
            <p className="aux-hint">
              لطلب تصدير بياناتك أو حذفها، تواصل مع مشرف التجربة عبر وسيلة
              التواصل المعتادة. تُحدَّد إجراءات الحذف والاحتفاظ قبل استقبال
              مستخدمين حقيقيين.
            </p>
          </section>
        </div>
        {demo && (
          <section className="panel demo-settings">
            <SectionTitle
              title="استكشف الأدوار"
              subtitle="يغيّر هذا العرض هوية التجربة المحلية فقط."
              action={<FlaskConical size={20} className="gold" />}
            />
            <div className="role-switcher">
              {roles.map(({ id, title, icon: Icon }) => (
                <Button
                  key={id}
                  variant={
                    (role === "member"
                      ? profile.display_name.includes("مريم")
                        ? "partner"
                        : "member"
                      : role) === id
                      ? "primary"
                      : "secondary"
                  }
                  aria-pressed={
                    (role === "member"
                      ? profile.display_name.includes("مريم")
                        ? "partner"
                        : "member"
                      : role) === id
                  }
                  onClick={() => {
                    setDemoRole(id);
                    setSaved(false);
                  }}
                >
                  <Icon size={17} />
                  {title}
                </Button>
              ))}
            </div>
            <p className="aux-hint" style={{ marginTop: "1rem" }}>
              دور المشرف يتيح إدارة الدعوات والموارد واللقاء الأسبوعي. دور
              المسؤول يتيح إدارة الحسابات دون الاطلاع على المحتوى الخاص.
            </p>
            <hr />
            <div className="settings-reset">
              <div>
                <strong>بداية جديدة للتجربة</strong>
                <p className="aux-hint">
                  أعد بيانات آية ومريم إلى حالتها الأصلية، مع مسح تعديلاتك
                  والملفات المحلية.
                </p>
              </div>
              <Button variant="secondary" onClick={() => setResetting(true)}>
                <RotateCcw size={16} />
                إعادة تهيئة التجربة
              </Button>
            </div>
          </section>
        )}
      </div>
      {resetting && (
        <Modal
          title="إعادة تهيئة النسخة التجريبية"
          onClose={() => setResetting(false)}
        >
          <p>
            ستُمسح تعديلات هذه التجربة والملفات المحفوظة على هذا الجهاز، ثم تعود
            بيانات آية ومريم الأصلية.
          </p>
          <div className="aux-form-footer">
            <Button variant="secondary" onClick={() => setResetting(false)}>
              إلغاء
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetDemo();
                setResetting(false);
                setSaved(false);
              }}
            >
              إعادة التهيئة
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
