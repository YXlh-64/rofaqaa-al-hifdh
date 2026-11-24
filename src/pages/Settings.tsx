import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  Badge,
  Button,
  Field,
  FormError,
  SaveButton,
  SectionTitle,
  useSubmit,
} from "../components/ui";
import { initials } from "../components/presentation";
import ProfileInvitations from "../components/ProfileInvitations";
import "./extras.css";

export default function SettingsPage({ onLogout }: { onLogout: () => void }) {
  const { profile, role, updateProfile } = useApp();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [saved, setSaved] = useState(false);
  const { busy, error, submit } = useSubmit();
  useEffect(() => {
    setName(profile?.display_name ?? "");
    setSaved(false);
  }, [profile?.id]);
  if (!profile) return null;
  return (
    <div className="settings-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">مساحتك كما تحبّها</p>
          <h1>الإعدادات</h1>
          <p>بيانات حسابك، وتفاصيل تجربتك في رفقاء الحفظ.</p>
        </div>
        <Button type="button" variant="secondary" onClick={onLogout}>
          <LogOut size={17} />
          تسجيل الخروج
        </Button>
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
              hint={
                profile.is_supervisor
                  ? "البريد الإلكتروني المرتبط بحسابك؛ لا يتغيّر من هذا النموذج."
                  : "هوية الدخول المرتبطة بدعواتك؛ لا تتغيّر من هذا النموذج."
              }
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
                <p>العربية</p>
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
                  {profile.is_supervisor
                    ? "يمكنك الاطّلاع على بيانات الفرق المسندة إلى إشرافك فقط. موارد كل فريق ولقاءاته خاصة به."
                    : "خططك وإنجازاتك ولقاءاتك ومواردك لا تظهر إلا لرفيقك والمشرف المكلّف."}
                </p>
              </div>
            </div>
          </section>
        </div>
        <ProfileInvitations />
      </div>
    </div>
  );
}
