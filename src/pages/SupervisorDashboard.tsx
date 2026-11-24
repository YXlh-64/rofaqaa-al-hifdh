import { useId } from "react";
import {
  BookOpen,
  CalendarDays,
  FolderOpen,
  LockKeyhole,
  Plus,
  RotateCcw,
  Users,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Button, EmptyState } from "../components/ui";
import WeekControl from "../components/WeekControl";
import { dateText, initials, number } from "../components/presentation";
import type { Meeting, SupervisedPairSummary } from "../lib/types";
import "./SupervisorDashboard.css";

const pairLabels = {
  active: "نشطة",
  pending: "بانتظار الرفيقين",
  archived: "مؤرشفة",
} as const;

function ActivitySummary({
  label,
  activity,
  revision = false,
}: {
  label: string;
  activity: SupervisedPairSummary["members"][number]["hifdh"];
  revision?: boolean;
}) {
  const covered = activity.targetAyahs
    ? Math.min(activity.targetAyahs, activity.completedTargetAyahs)
    : 0;
  return (
    <div
      className={`supervisor-activity ${revision ? "supervisor-activity-revision" : ""}`}
    >
      <h4>
        {revision ? <RotateCcw size={15} /> : <BookOpen size={15} />}
        {label}
      </h4>
      <dl className="supervisor-activity-metrics">
        <div>
          <dt>هدف الأسبوع</dt>
          <dd>
            {activity.targetAyahs
              ? `${number(activity.targetAyahs)} آيات`
              : "لا يوجد هدف"}
          </dd>
        </div>
        <div>
          <dt>المخطّط يوميًا</dt>
          <dd>{number(activity.plannedAyahs)} آيات</dd>
        </div>
        <div>
          <dt>المنجز المسجّل</dt>
          <dd>{number(activity.actualAyahs)} آيات</dd>
        </div>
      </dl>
      <p className="supervisor-target-progress">
        {activity.targetAyahs
          ? `${number(covered)} من ${number(activity.targetAyahs)} آيات الهدف`
          : "لا ينطبق · بلا هدف أسبوعي"}
      </p>
      <div className="supervisor-progress-track" aria-hidden="true">
        <span
          style={{
            width: `${activity.targetAyahs ? (covered / activity.targetAyahs) * 100 : 0}%`,
          }}
        />
      </div>
      <p className="supervisor-unlogged">
        {activity.unloggedDays
          ? `${number(activity.unloggedDays)} أيام لم يُسجّل إنجازها بعد`
          : "لا توجد أيام تحتاج إلى تسجيل حتى الآن"}
      </p>
    </div>
  );
}

function WeeklyMeeting({
  meeting,
  upcoming,
}: {
  meeting: Meeting | null;
  upcoming: boolean;
}) {
  const pastPlanned =
    meeting?.status === "planned" &&
    Date.parse(meeting.scheduled_at) < Date.now();
  return (
    <div className="supervisor-weekly-meeting">
      <span className="supervisor-footer-label">
        <CalendarDays size={16} />
        {meeting
          ? upcoming
            ? "اللقاء الأسبوعي القادم"
            : "آخر لقاء أسبوعي"
          : "اللقاء الأسبوعي"}
      </span>
      {meeting ? (
        <>
          <Badge
            tone={
              meeting.status === "held"
                ? "teal"
                : meeting.status === "missed"
                  ? "red"
                  : "muted"
            }
          >
            {meeting.status === "held"
              ? "تمّ اللقاء"
              : meeting.status === "missed"
                ? "لم يتمّ اللقاء"
                : "مجدول"}
          </Badge>
          <time dateTime={meeting.scheduled_at}>
            {dateText(meeting.scheduled_at, {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
          {pastPlanned && (
            <span className="supervisor-outcome-cue">
              بانتظار تسجيل النتيجة
            </span>
          )}
        </>
      ) : (
        <span className="supervisor-muted">لم يُحدّد لقاء أسبوعي بعد</span>
      )}
    </div>
  );
}

function PairCard({
  summary,
  onOpen,
  onManageInvites,
}: {
  summary: SupervisedPairSummary;
  onOpen: () => void;
  onManageInvites: () => void;
}) {
  const { pair } = summary;
  const titleId = useId();
  return (
    <article
      className="panel supervisor-overview-card"
      aria-labelledby={titleId}
    >
      <div className="supervisor-card-header">
        <h2 id={titleId}>{pair.name}</h2>
        <div className="supervisor-card-badges">
          <Badge
            tone={
              pair.status === "active"
                ? "teal"
                : pair.status === "pending"
                  ? "gold"
                  : "muted"
            }
          >
            {pairLabels[pair.status]}
          </Badge>
          {pair.frozen && pair.status !== "archived" && (
            <Badge tone="gold">الكتابة موقوفة</Badge>
          )}
        </div>
      </div>
      {pair.status === "pending" ? (
        <div className="supervisor-pending-pair">
          <Users size={25} aria-hidden="true" />
          <p>انضم {number(pair.members.length)} من الرفيقين</p>
          {pair.members.length > 0 && (
            <p className="supervisor-muted">
              {pair.members.map((member) => member.display_name).join("، ")}
            </p>
          )}
          <span>تُفعّل المساحة بعد قبول الشخصين دعوتهما.</span>
        </div>
      ) : (
        <>
          {(pair.status === "archived" || pair.frozen) && (
            <p className="supervisor-readonly">
              <LockKeyhole size={15} />
              {pair.status === "archived"
                ? "سجلّ محفوظ للقراءة فقط"
                : "توقّفت الكتابة مؤقتًا لأن أحد المشاركين موقوف."}
            </p>
          )}
          <div className="supervisor-members">
            {summary.members.map((member) => (
              <section
                className="supervisor-member"
                key={member.profile.id}
                aria-label={`متابعة ${member.profile.display_name}`}
              >
                <div className="supervisor-member-heading">
                  <span className="avatar" aria-hidden="true">
                    {initials(member.profile.display_name)}
                  </span>
                  <h3>{member.profile.display_name}</h3>
                  {member.target?.mode === "shared" && (
                    <Badge tone="muted">هدف مشترك</Badge>
                  )}
                </div>
                {!member.target && (
                  <p className="supervisor-no-target">
                    لم يُحدّد هدف أسبوعي بعد.
                  </p>
                )}
                <div className="supervisor-member-activities">
                  <ActivitySummary
                    label="الحفظ الجديد"
                    activity={member.hifdh}
                  />
                  <ActivitySummary
                    label="المراجعة"
                    activity={member.revision}
                    revision
                  />
                </div>
              </section>
            ))}
          </div>
          {summary.members.length === 0 && (
            <p className="supervisor-muted">
              لا توجد سجلات أعضاء متاحة لهذه الرفقة.
            </p>
          )}
          <div className="supervisor-card-review">
            <WeeklyMeeting
              meeting={summary.nextWeeklyMeeting ?? summary.lastWeeklyMeeting}
              upcoming={!!summary.nextWeeklyMeeting}
            />
            <p className="supervisor-resource-count">
              <FolderOpen size={16} />
              <span>الموارد المنشورة</span>
              <strong>{number(summary.publishedResourceCount)}</strong>
            </p>
          </div>
        </>
      )}
      <div className="supervisor-card-actions">
        {pair.status === "pending" ? (
          <Button variant="secondary" onClick={onManageInvites}>
            إدارة الدعوات
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={onOpen}
            aria-label={`فتح مساحة ${pair.name}`}
          >
            {pair.status === "archived" ? "فتح سجل الرفقة" : "فتح مساحة الرفقة"}
          </Button>
        )}
      </div>
    </article>
  );
}

export default function SupervisorDashboard({
  onOpenPair,
  navigate,
}: {
  onOpenPair: (pairId: string) => void;
  navigate: (page: string) => void;
}) {
  const { profile, supervisedPairSummaries } = useApp();
  if (!profile?.is_supervisor)
    return (
      <EmptyState
        title="هذه المساحة للمشرف"
        description="تظهر هنا الرفقات التي أُسندت إليك متابعتها."
      />
    );
  const summaries = supervisedPairSummaries.filter(
    (summary) => summary.pair.supervisor_id === profile.id,
  );
  const activeCount = summaries.filter(
    (summary) => summary.pair.status === "active",
  ).length;
  const pendingCount = summaries.filter(
    (summary) => summary.pair.status === "pending",
  ).length;
  return (
    <div className="supervisor-dashboard">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">
            السَّلَامُ عَلَيْكَ، {profile.display_name.split(" ")[0]}
          </p>
          <h1>مساحاتي</h1>
          <p className="supervisor-intro">
            نظرة إلى كل رفقة تحت إشرافك، وخطوة كل شخص في الحفظ والمراجعة.
          </p>
        </div>
        <WeekControl />
      </div>
      <div className="supervisor-overview-toolbar">
        <p>
          <Users size={18} />
          <strong>{number(summaries.length)} رفقات</strong>
          <span>
            {number(activeCount)} نشطة · {number(pendingCount)} بانتظار الانضمام
          </span>
        </p>
        <div>
          <Button variant="secondary" onClick={() => navigate("pairs")}>
            إدارة الرفقاء
          </Button>
          <Button onClick={() => navigate("pairs")}>
            <Plus size={16} />
            إنشاء رفقة
          </Button>
        </div>
      </div>
      {summaries.length === 0 ? (
        <div className="panel">
          <EmptyState
            title="أول رفقة تبدأ بدعوة"
            description="أنشئ مساحة لشخصين اختارا الحفظ معًا. ستظهر هنا متابعة كل رفقة تحت إشرافك."
            action={
              <Button variant="secondary" onClick={() => navigate("pairs")}>
                دعوة رفيقين
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="supervisor-overview-grid">
            {summaries.map((summary) => (
              <PairCard
                key={summary.pair.id}
                summary={summary}
                onOpen={() => onOpenPair(summary.pair.id)}
                onManageInvites={() => navigate("pairs")}
              />
            ))}
          </div>
          <p className="supervisor-overview-note">
            الأعداد تمثّل آيات مختلفة لكل نشاط خلال الأسبوع المحدّد. غياب التسجيل
            لا يعني عدم الإنجاز، واللقاء مستقل عن الحفظ والمراجعة.
          </p>
        </>
      )}
    </div>
  );
}
