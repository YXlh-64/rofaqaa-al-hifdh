import { useId } from "react";
import { CalendarDays, Clock3, LockKeyhole, Users } from "lucide-react";
import { Badge, Button, EmptyState } from "../components/ui";
import { number } from "../components/presentation";
import { useApp } from "../context/AppContext";
import type { Meeting, SupervisedWorkspace } from "../lib/types";
import type { SupervisorMeetingVisibility } from "./Meetings";
import "./SupervisorMeetings.css";

const statusLabels = {
  planned: "مجدول",
  held: "تمّ اللقاء",
  missed: "لم يتمّ اللقاء",
} as const;
const teamLabels = {
  active: "نشط",
  pending: "بانتظار التفعيل",
  archived: "مؤرشف",
} as const;

function sortMeetings(meetings: Meeting[]) {
  const now = Date.now();
  return [...meetings].sort((a, b) => {
    const aUpcoming =
      a.status === "planned" && Date.parse(a.scheduled_at) >= now;
    const bUpcoming =
      b.status === "planned" && Date.parse(b.scheduled_at) >= now;
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    return aUpcoming
      ? Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at)
      : Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at);
  });
}

function MeetingSection({
  title,
  description,
  meetings,
  timeZone,
}: {
  title: string;
  description: string;
  meetings: Meeting[];
  timeZone: string;
}) {
  const upcomingCount = meetings.filter(
    (meeting) =>
      meeting.status === "planned" &&
      Date.parse(meeting.scheduled_at) >= Date.now(),
  ).length;
  return (
    <section className="supervisor-meetings-preview-section" aria-label={title}>
      <div className="supervisor-meetings-preview-heading">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {meetings.length ? (
        <>
          <p className="supervisor-meetings-count">
            <CalendarDays size={16} />
            عدد اللقاءات: {number(meetings.length)}
            <span>{number(upcomingCount)} قادمة</span>
          </p>
          <ol className="supervisor-meetings-preview" aria-label={title}>
            {meetings.slice(0, 3).map((meeting) => (
              <li key={meeting.id}>
                <div>
                  <time dateTime={meeting.scheduled_at}>
                    {new Intl.DateTimeFormat("ar-DZ", {
                      numberingSystem: "arab",
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone,
                    }).format(new Date(meeting.scheduled_at))}
                  </time>
                  <span>
                    <Clock3 size={14} />
                    {new Intl.DateTimeFormat("ar-DZ", {
                      numberingSystem: "arab",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone,
                    }).format(new Date(meeting.scheduled_at))}
                  </span>
                  {meeting.status === "planned" &&
                    Date.parse(meeting.scheduled_at) < Date.now() && (
                      <small>بانتظار تسجيل النتيجة</small>
                    )}
                </div>
                <Badge
                  tone={
                    meeting.status === "held"
                      ? "teal"
                      : meeting.status === "missed"
                        ? "red"
                        : "muted"
                  }
                >
                  {statusLabels[meeting.status]}
                </Badge>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="supervisor-meetings-empty">
          <CalendarDays size={24} strokeWidth={1.5} />
          <p>لا توجد لقاءات مسجّلة في هذا القسم.</p>
          <span>ستظهر هنا المواعيد ونتائج اللقاءات.</span>
        </div>
      )}
    </section>
  );
}

function TeamMeetings({
  workspace,
  visibility,
  onOpen,
}: {
  workspace: SupervisedWorkspace;
  visibility: SupervisorMeetingVisibility;
  onOpen: () => void;
}) {
  const titleId = useId();
  const { pair } = workspace;
  const meetings = sortMeetings(
    workspace.meetings.filter(
      (meeting) =>
        meeting.pair_id === pair.id &&
        (visibility === "all" || meeting.type === "weekly"),
    ),
  );
  const readOnly = pair.status !== "active" || pair.frozen;
  return (
    <article
      className="supervisor-meetings-team panel"
      aria-labelledby={titleId}
    >
      <header className="supervisor-meetings-team-heading">
        <div>
          <h2 id={titleId}>{pair.name}</h2>
          <p>
            {pair.members.length
              ? pair.members.map((member) => member.display_name).join("، ")
              : "يظهر أعضاء الفريق بعد قبول الدعوات."}
          </p>
        </div>
        <Badge
          tone={
            pair.frozen ? "gold" : pair.status === "active" ? "teal" : "muted"
          }
        >
          {pair.frozen ? "متوقف مؤقتًا" : teamLabels[pair.status]}
        </Badge>
      </header>
      {visibility === "all" && (
        <MeetingSection
          title="اللقاءات الداخلية"
          description="بين أعضاء الفريق"
          meetings={meetings.filter((meeting) => meeting.type === "daily")}
          timeZone={pair.time_zone}
        />
      )}
      <MeetingSection
        title="لقاءات المتابعة"
        description="بمشاركة المشرفة"
        meetings={meetings.filter((meeting) => meeting.type === "weekly")}
        timeZone={pair.time_zone}
      />
      <footer className="supervisor-meetings-team-footer">
        <span>
          {readOnly && <LockKeyhole size={14} />}
          <bdi>{pair.time_zone}</bdi>
          {readOnly ? " · للقراءة فقط" : ""}
        </span>
        <Button variant="secondary" onClick={onOpen}>
          فتح لقاءات الفريق
        </Button>
      </footer>
    </article>
  );
}

export default function SupervisorMeetings({
  onOpenTeam,
  visibility = "all",
}: {
  onOpenTeam: (pairId: string) => void;
  visibility?: SupervisorMeetingVisibility;
}) {
  const { profile, supervisedWorkspaces } = useApp();
  if (!profile?.enabled || !profile.is_supervisor)
    return (
      <EmptyState
        title="هذه المساحة للمشرف"
        description="تظهر هنا لقاءات الفرق التي تتولى متابعتها."
      />
    );
  const workspaces = supervisedWorkspaces.filter(
    (workspace) => workspace.pair.supervisor_id === profile.id,
  );
  return (
    <div className="supervisor-meetings-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">مساحة الإشراف</p>
          <h1>لقاءات الفرق</h1>
          <p className="page-intro">
            مواعيد كل فريق وحالة لقاءاته، في مكان واحد.
          </p>
        </div>
        <p className="supervisor-meetings-total">
          <Users size={19} />
          الفرق تحت إشرافك: {number(workspaces.length)}
        </p>
      </div>
      {workspaces.length ? (
        <div className="supervisor-meetings-grid">
          {workspaces.map((workspace) => (
            <TeamMeetings
              key={workspace.pair.id}
              workspace={workspace}
              visibility={visibility}
              onOpen={() => onOpenTeam(workspace.pair.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="لا توجد فرق لعرض لقاءاتها"
          description="بعد إنشاء فريق، تظهر مواعيده هنا ضمن مساحة مستقلة."
        />
      )}
    </div>
  );
}
