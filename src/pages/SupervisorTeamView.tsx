import {
  BookOpen,
  CalendarDays,
  FolderOpen,
  LockKeyhole,
  RotateCcw,
  Users,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Button, EmptyState } from "../components/ui";
import {
  coveredAyahs,
  RangeText,
  uniqueAyahs,
} from "../components/RangeEditor";
import {
  dateText,
  dayName,
  initials,
  number,
  shiftDate,
} from "../components/presentation";
import WeekControl from "../components/WeekControl";
import type { ActualActivity, PlanActivity } from "../lib/types";
import "./SupervisorTeamView.css";

const pairLabels = {
  pending: "بانتظار الرفيقين",
  active: "نشطة",
  archived: "مؤرشفة",
} as const;
const actualLabels = {
  unlogged: "لم يُسجّل بعد",
  not_done: "لم يُنجز",
  partial: "إنجاز جزئي",
  completed: "تمّ الإنجاز",
} as const;
const activities = [
  { key: "hifdh", label: "الحفظ الجديد" },
  { key: "revision", label: "المراجعة" },
] as const;

function PlanValue({ activity }: { activity?: PlanActivity }) {
  if (activity?.state === "planned")
    return <RangeText ranges={activity.ranges} />;
  return (
    <span className="team-record-muted">
      {activity?.state === "none"
        ? "لا يوجد هدف لهذا النشاط اليوم"
        : "لم تُحفظ خطة بعد"}
    </span>
  );
}
function ActualValue({
  activity,
  plan,
}: {
  activity?: ActualActivity;
  plan?: PlanActivity;
}) {
  const status = activity?.state ?? "unlogged";
  const outsidePlan =
    !!activity?.ranges.length &&
    coveredAyahs(plan?.ranges ?? [], activity.ranges) <
      uniqueAyahs(activity.ranges);
  return (
    <div className="team-actual">
      <Badge
        tone={
          status === "completed"
            ? "teal"
            : status === "partial"
              ? "gold"
              : "muted"
        }
      >
        {actualLabels[status]}
      </Badge>
      {activity?.ranges.length ? <RangeText ranges={activity.ranges} /> : null}
      {outsidePlan && <small>يتضمّن إنجازًا خارج الخطة</small>}
    </div>
  );
}

export default function SupervisorTeamView({
  onBack,
  onResources,
  onMeetings,
  onManageInvites,
}: {
  onBack: () => void;
  onResources: () => void;
  onMeetings: () => void;
  onManageInvites: () => void;
}) {
  const { profile, pair, supervisedWorkspaces, supervisedPairSummaries, week } =
    useApp();
  const workspace = supervisedWorkspaces.find(
    (item) => item.pair.id === pair?.id,
  );
  const summary = supervisedPairSummaries.find(
    (item) => item.pair.id === pair?.id,
  );
  if (
    !profile?.enabled ||
    !profile.is_supervisor ||
    !pair ||
    pair.supervisor_id !== profile.id ||
    !workspace
  )
    return (
      <EmptyState
        title="مساحة الرفقة غير متاحة"
        description="يمكنك عرض الرفقات المسندة إلى إشرافك فقط."
        action={
          <Button variant="secondary" onClick={onBack}>
            العودة إلى مساحاتي
          </Button>
        }
      />
    );

  return (
    <div className="supervisor-team-view">
      <Button variant="ghost" onClick={onBack}>
        العودة إلى مساحاتي
      </Button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">متابعة الرفقة</p>
          <h1>{pair.name}</h1>
          <div className="team-view-status">
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
            <span>
              <Users size={16} />
              {number(pair.members.length)} من الرفيقين
            </span>
          </div>
        </div>
        {pair.status !== "pending" && <WeekControl />}
      </div>
      {pair.status === "pending" ? (
        <section className="panel team-pending">
          <h2>بانتظار اكتمال الانضمام</h2>
          <p>تُفعّل المساحة بعد قبول الشخصين دعوتهما.</p>
          {pair.members.length > 0 && (
            <ul>
              {pair.members.map((member) => (
                <li key={member.id}>{member.display_name} · قَبِل الدعوة</li>
              ))}
            </ul>
          )}
          <Button variant="secondary" onClick={onManageInvites}>
            إدارة الدعوات
          </Button>
        </section>
      ) : (
        <>
          {(pair.status === "archived" || pair.frozen) && (
            <div className="info-note">
              <LockKeyhole size={18} />
              {pair.status === "archived"
                ? "هذه الرفقة مؤرشفة. سجلاتها محفوظة للقراءة فقط."
                : "توقّفت الكتابة مؤقتًا لأن أحد المشاركين موقوف. تبقى السجلات متاحة للمصرّح لهم."}
            </div>
          )}
          <div className="team-view-tools">
            <p>الخطط والإنجازات لكل شخص على حدة، للمراجعة والمتابعة.</p>
            <div>
              <Button variant="secondary" onClick={onResources}>
                <FolderOpen size={17} />
                موارد الرفقة
              </Button>
              <Button variant="secondary" onClick={onMeetings}>
                <CalendarDays size={17} />
                لقاءات الرفقة
              </Button>
            </div>
          </div>
          <p className="team-record-help">
            غياب التسجيل لا يعني عدم الإنجاز. حضور اللقاءات مستقل عن الحفظ
            والمراجعة.
          </p>
          {pair.members.map((member) => {
            const target =
              summary?.members.find((item) => item.profile.id === member.id)
                ?.target ??
              workspace.targets.find(
                (item) => item.status === "confirmed" && item.mode === "shared",
              ) ??
              workspace.targets.find(
                (item) =>
                  item.status === "confirmed" &&
                  item.mode === "individual" &&
                  item.owner_id === member.id,
              );
            return (
              <section
                className="panel team-member-record"
                key={member.id}
                aria-label={`متابعة ${member.display_name}`}
              >
                <div className="team-member-title">
                  <span className="avatar" aria-hidden="true">
                    {initials(member.display_name)}
                  </span>
                  <h2>{member.display_name}</h2>
                  {target?.mode === "shared" && (
                    <Badge tone="muted">هدف مشترك</Badge>
                  )}
                </div>
                <h3>هدف الأسبوع</h3>
                {target ? (
                  <div className="team-targets">
                    {activities.map((activity) => (
                      <div key={activity.key}>
                        <h4>
                          {activity.key === "hifdh" ? (
                            <BookOpen size={16} />
                          ) : (
                            <RotateCcw size={16} />
                          )}
                          {activity.label}
                        </h4>
                        {target[activity.key].length ? (
                          <RangeText ranges={target[activity.key]} />
                        ) : (
                          <span className="team-record-muted">
                            لا يوجد هدف لهذا النشاط
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="team-record-muted">لم يُحدّد هدف لهذا الأسبوع.</p>
                )}
                {target?.note && (
                  <p className="team-target-note">{target.note}</p>
                )}
                <h3>الخطة والإنجاز اليومي</h3>
                <div
                  className="team-record-scroll"
                  role="region"
                  aria-label={`جدول متابعة ${member.display_name}`}
                  tabIndex={0}
                >
                  <table className="team-record-table">
                    <caption>
                      خطة وإنجاز {member.display_name} خلال الأسبوع المحدّد
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">اليوم</th>
                        <th scope="col">خطة الحفظ</th>
                        <th scope="col">إنجاز الحفظ</th>
                        <th scope="col">خطة المراجعة</th>
                        <th scope="col">إنجاز المراجعة</th>
                        <th scope="col">ملاحظة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 7 }, (_, index) => {
                        const date = shiftDate(week, index);
                        const entry = workspace.entries.find(
                          (item) =>
                            item.owner_id === member.id && item.date === date,
                        );
                        return (
                          <tr key={date}>
                            <th scope="row">
                              <strong>{dayName(date)}</strong>
                              <small>
                                {dateText(date, {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </small>
                            </th>
                            {activities.map((activity) => (
                              <PlanActualCells
                                key={activity.key}
                                plan={entry?.[`plan_${activity.key}`]}
                                actual={entry?.[`actual_${activity.key}`]}
                              />
                            ))}
                            <td className="team-day-note">
                              {entry?.note || "—"}
                              {entry && entry.version > 1 && (
                                <small>
                                  عُدّل · {dateText(entry.updated_at)}
                                </small>
                              )}
                              {entry &&
                                entry.created_at.slice(0, 10) > date && (
                                  <small>سُجّل ليوم سابق</small>
                                )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
          {pair.members.length === 0 && (
            <EmptyState
              title="لا توجد سجلات أعضاء متاحة"
              description="ستظهر متابعة الرفيقين بعد اكتمال بيانات الرفقة."
            />
          )}
        </>
      )}
    </div>
  );
}

function PlanActualCells({
  plan,
  actual,
}: {
  plan?: PlanActivity;
  actual?: ActualActivity;
}) {
  return (
    <>
      <td>
        <PlanValue activity={plan} />
      </td>
      <td>
        <ActualValue activity={actual} plan={plan} />
      </td>
    </>
  );
}
