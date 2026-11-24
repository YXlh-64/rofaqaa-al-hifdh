import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  CircleHelp,
  FolderOpen,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sprout,
  Users,
  X,
} from "lucide-react";
import { useApp } from "./context/AppContext";
import Brand from "./components/Brand";
import {
  Badge,
  Button,
  EmptyState,
  FormError,
  Modal,
  useSubmit,
} from "./components/ui";
import { dateText, initials, localToday } from "./components/presentation";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import SupervisorDashboard from "./pages/SupervisorDashboard";
import Planning from "./pages/Planning";
import Progress from "./pages/Progress";
import Meetings from "./pages/Meetings";
import Resources from "./pages/Resources";
import Pairs from "./pages/Pairs";
import SettingsPage from "./pages/Settings";
import Admin from "./pages/Admin";

const pages = [
  { id: "dashboard", title: "مساحتي", icon: LayoutDashboard },
  { id: "plan", title: "خطة الأسبوع", icon: BookOpen },
  { id: "progress", title: "سجلّ الإنجاز", icon: CheckCheck },
  { id: "meetings", title: "اللقاءات", icon: CalendarDays },
  { id: "resources", title: "الموارد", icon: FolderOpen },
];
function workspaceIdFromHash() {
  if (!location.hash.startsWith("#workspace=")) return null;
  try {
    return decodeURIComponent(location.hash.slice("#workspace=".length));
  } catch {
    return null;
  }
}
function Invite({ token, onDone }: { token: string; onDone: () => void }) {
  const { profile, acceptInvite, logout } = useApp();
  const { busy, error, submit } = useSubmit();
  const [accepted, setAccepted] = useState(false);
  return (
    <div className="invite-page">
      <div className="panel">
        <Brand />
        <div className="empty-state" style={{ padding: "1rem 0" }}>
          <span className="empty-icon">
            <HeartHandshake size={30} />
          </span>
          <h1 style={{ fontSize: "1.6rem" }}>
            {accepted ? "قُبلت دعوتك، أهلًا بك" : "دعوة إلى رفقةٍ طيبة"}
          </h1>
          <p>
            {accepted
              ? "ستصبح المساحة متاحة بعد قبول الرفيق الآخر دعوته. يمكنك العودة لمساحتك لمعرفة حالة الرفقة."
              : "سيُتحقّق من ارتباط الدعوة ببريدك الإلكتروني. لا تُظهر هذه الصفحة بيانات الرفيق الآخر."}
          </p>
          {!accepted && (
            <p>
              الحساب الحالي: <bdi dir="ltr">{profile?.email}</bdi>
            </p>
          )}
        </div>
        <FormError error={error} />
        {accepted ? (
          <Button style={{ width: "100%" }} onClick={onDone}>
            الانتقال إلى مساحتي
          </Button>
        ) : (
          <div className="stack">
            <Button
              disabled={busy}
              onClick={() =>
                submit(async () => {
                  await acceptInvite(token);
                  setAccepted(true);
                })
              }
            >
              {busy ? "جارٍ قبول الدعوة…" : "قبول الدعوة والانضمام"}
            </Button>
            <Button variant="ghost" onClick={() => logout()}>
              استخدام حساب آخر
            </Button>
            <p className="field-hint" style={{ textAlign: "center" }}>
              إذا انتهت الدعوة أو أُلغيت، اطلب من المشرف رابطًا جديدًا.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
export default function App() {
  const app = useApp();
  const {
    loading,
    profile,
    demo,
    role,
    pairs,
    pair,
    setPairId,
    message,
    clearMessage,
    logout,
    error,
    refresh,
  } = app;
  const readPage = () => location.hash.slice(1).split("=")[0] || "dashboard";
  const [page, setPage] = useState(readPage);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const token = location.hash.startsWith("#invite=")
    ? location.hash.slice(8)
    : sessionStorage.getItem("rofaqa-invite");
  useEffect(() => {
    if (location.hash.startsWith("#invite="))
      sessionStorage.setItem("rofaqa-invite", location.hash.slice(8));
  }, []);
  useEffect(() => {
    const handle = () => {
      setPage(readPage());
      const workspaceId = workspaceIdFromHash();
      if (workspaceId) setPairId(workspaceId);
    };
    handle();
    window.addEventListener("hashchange", handle);
    return () => window.removeEventListener("hashchange", handle);
  }, [setPairId, profile?.id]);
  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    const previousFocus = document.activeElement as HTMLElement | null;
    const sidebar = document.getElementById("main-sidebar");
    sidebar?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab" || !sidebar) return;
      const controls = Array.from(
        sidebar.querySelectorAll<HTMLElement>("a[href],button:not([disabled])"),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
      previousFocus?.focus();
    };
  }, [mobileOpen]);
  const navigate = (next: string) => {
    location.hash = next;
    setPage(next.split("=")[0]);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("main-content")?.focus();
  };
  const openPairWorkspace = (id: string) => {
    if (!pairs.some((candidate) => candidate.id === id)) return;
    setPairId(id);
    navigate(`workspace=${encodeURIComponent(id)}`);
  };
  const handleLogout = () => {
    setMobileOpen(false);
    setHelp(false);
    navigate("dashboard");
    void logout();
  };
  if (loading)
    return (
      <div className="loading-page" role="status" aria-label="جارٍ تحميل مساحتك">
        <div className="loading-content">
          <Brand />
          <Sprout className="spin" size={24} />
          <span>نُهيّئ مساحتك…</span>
        </div>
      </div>
    );
  if (
    !profile ||
    location.hash.includes("type=recovery") ||
    sessionStorage.getItem("rofaqa-recovery") === "true"
  )
    return <Auth />;
  if (!profile.enabled)
    return (
      <div className="invite-page">
        <div className="panel">
          <EmptyState
            title="الحساب موقوف مؤقتًا"
            description="تواصل مع مسؤول النظام لإعادة تفعيل حسابك."
            action={<Button onClick={handleLogout}>تسجيل الخروج</Button>}
          />
        </div>
      </div>
    );
  if (token && !demo)
    return (
      <Invite
        token={token}
        onDone={() => {
          sessionStorage.removeItem("rofaqa-invite");
          navigate("dashboard");
        }}
      />
    );
  const visiblePages =
    role === "admin"
      ? []
      : [
          ...(profile.is_supervisor
            ? [{ id: "pairs", title: "الرفقاء", icon: Users }]
            : []),
          ...pages,
        ];
  const title =
    page === "workspace"
      ? (pair?.name ?? "مساحة الرفقة")
      : ([
          ...visiblePages,
          { id: "settings", title: "الإعدادات" },
          { id: "admin", title: "إدارة الحسابات" },
        ].find((p) => p.id === page)?.title ?? "مساحتي");
  const actualPage =
    role === "admin" && !["settings", "admin"].includes(page) ? "admin" : page;
  const navPage = actualPage === "workspace" ? "dashboard" : actualPage;
  const supervisorOverview =
    actualPage === "dashboard" && profile.is_supervisor;
  const workspaceId = workspaceIdFromHash();
  const unavailableWorkspace =
    actualPage === "workspace" &&
    (!workspaceId || !pairs.some((candidate) => candidate.id === workspaceId));
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        الانتقال إلى المحتوى
      </a>
      {mobileOpen && (
        <button
          className="drawer-backdrop"
          aria-label="إغلاق القائمة"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        id="main-sidebar"
        className={`sidebar ${mobileOpen ? "is-open" : ""}`}
        aria-label="التنقل الرئيسي"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen || undefined}
      >
        <button
          className="icon-button sidebar-close"
          aria-label="إغلاق القائمة"
          onClick={() => setMobileOpen(false)}
        >
          <X size={20} />
        </button>
        <Brand />
        <span className="nav-label">مساحة الرفقة</span>
        <nav className="nav-links">
          {visiblePages.map(({ id, title, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className={`nav-item ${navPage === id ? "active" : ""}`}
              aria-current={navPage === id ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(id);
              }}
            >
              <Icon size={19} strokeWidth={1.5} />
              {title}
            </a>
          ))}
          {profile.is_admin && (
            <a
              className={`nav-item ${actualPage === "admin" ? "active" : ""}`}
              href="#admin"
              onClick={(e) => {
                e.preventDefault();
                navigate("admin");
              }}
            >
              <ShieldCheck size={19} strokeWidth={1.5} />
              إدارة الحسابات
            </a>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-verse">
            <p>
              رفيقٌ يُعين،
              <br />
              وقرآنٌ يُنير الدرب.
            </p>
            <small>نلتقي على الخير، ونمضي معًا.</small>
          </div>
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings size={18} strokeWidth={1.5} />
            الإعدادات
          </button>
          <button className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={18} strokeWidth={1.5} />
            دليل المساحة
          </button>
          <button className="nav-item" onClick={handleLogout}>
            <LogOut size={18} strokeWidth={1.5} />
            تسجيل الخروج
          </button>
          <div className="profile-mini">
            <span className="avatar">{initials(profile.display_name)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{profile.display_name}</strong>
              <small>
                {role === "member"
                  ? "رفيقة في رحلة الحفظ"
                  : role === "supervisor"
                    ? "مشرف على رحلة الحفظ"
                    : "مسؤول النظام"}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-area">
        <header className="topbar">
          <div className="flex">
            <button
              className="icon-button mobile-menu"
              aria-label="فتح قائمة التنقل"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={22} />
            </button>
            <div className="breadcrumb">
              <span>رفقاء الحفظ</span>
              <ChevronLeft size={13} />
              <strong>{title}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            {pairs.length > 1 && role !== "admin" && !supervisorOverview && (
              <select
                className="pair-select"
                aria-label="الرفقة الحالية"
                value={pair?.id ?? ""}
                onChange={(e) => {
                  if (actualPage === "workspace")
                    openPairWorkspace(e.target.value);
                  else setPairId(e.target.value);
                }}
              >
                {pairs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <span className="top-date">
              <CalendarDays size={15} />
              {dateText(localToday(), {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </span>
            <span className="topbar-divider" />
            <a
              href="#settings"
              className="avatar avatar-gold profile-shortcut"
              aria-label="فتح إعدادات الملف الشخصي"
              title={`إعدادات ${profile.display_name}`}
              aria-current={actualPage === "settings" ? "page" : undefined}
              onClick={(event) => {
                if (
                  event.button !== 0 ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                navigate("settings");
              }}
            >
              {initials(profile.display_name)}
            </a>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="content">
          {error && (
            <div className="stack" style={{ marginBottom: "1rem" }}>
              <FormError error={error} />
              <Button variant="secondary" onClick={() => refresh()}>
                إعادة المحاولة
              </Button>
            </div>
          )}
          {supervisorOverview ? (
            <SupervisorDashboard
              onOpenPair={openPairWorkspace}
              navigate={navigate}
            />
          ) : unavailableWorkspace ? (
            <EmptyState
              title="هذه الرفقة غير متاحة لحسابك"
              description="ارجع إلى مساحتك لاختيار إحدى الرفقات المتاحة لك."
              action={
                <Button onClick={() => navigate("dashboard")}>
                  العودة إلى مساحتي
                </Button>
              }
            />
          ) : actualPage === "dashboard" || actualPage === "workspace" ? (
            <>
              {profile.is_supervisor && (
                <div className="view-toolbar">
                  <Button variant="ghost" onClick={() => navigate("dashboard")}>
                    <Users size={17} />
                    كل مساحاتي
                  </Button>
                  <strong>{pair?.name}</strong>
                </div>
              )}
              <Dashboard key={pair?.id} navigate={navigate} />
            </>
          ) : actualPage === "plan" ? (
            <Planning />
          ) : actualPage === "progress" ? (
            <Progress />
          ) : actualPage === "meetings" ? (
            <Meetings />
          ) : actualPage === "resources" ? (
            <Resources />
          ) : actualPage === "pairs" && profile.is_supervisor ? (
            <Pairs navigate={navigate} />
          ) : actualPage === "settings" ? (
            <SettingsPage onLogout={handleLogout} />
          ) : actualPage === "admin" && profile.is_admin ? (
            <Admin />
          ) : profile.is_supervisor ? (
            <SupervisorDashboard
              onOpenPair={openPairWorkspace}
              navigate={navigate}
            />
          ) : (
            <Dashboard navigate={navigate} />
          )}
          <footer className="page-footer">
            <span>
              رفقاء الحفظ <span className="gold">✦</span> معًا على طريق القرآن
            </span>
          </footer>
        </main>
      </div>
      {message && (
        <div className="toast" role="status">
          <CheckCheck size={19} />
          <span>{message}</span>
          <button
            className="icon-button"
            onClick={clearMessage}
            aria-label="إغلاق الإشعار"
          >
            <X size={17} />
          </button>
        </div>
      )}
      {help && (
        <Modal title="دليل مساحتك" onClose={() => setHelp(false)}>
          <div className="settings-list">
            <div>
              <strong>١. اتّفقا على هدف</strong>
              <p>
                لكل شخص هدف فردي، أو يقترح أحدكما هدفًا مشتركًا ويوافق عليه الآخر.
              </p>
            </div>
            <div>
              <strong>٢. خطّط ليومك وسجّل إنجازك</strong>
              <p>
                الحفظ والمراجعة نشاطان مستقلان. يمكنك تسجيل إنجاز جزئي أو عمل
                خارج الخطة.
              </p>
            </div>
            <div>
              <strong>٣. التقيا على الخير</strong>
              <p>
                اللقاء اليومي للرفيقين، واللقاء الأسبوعي مع المشرف. حضور اللقاء
                مستقل عن إنجاز الحفظ.
              </p>
            </div>
            <div>
              <strong>٤. تزوّدا بما ينفع</strong>
              <p>يشارك المشرف روابط وملفات خاصة برفقتكما، لا تظهر لغيركما.</p>
            </div>
            <Badge tone="gold">الأسبوع يبدأ الأحد · بتوقيت الجزائر</Badge>
          </div>
        </Modal>
      )}
    </>
  );
}
