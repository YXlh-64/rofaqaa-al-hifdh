import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarDays,
  Clock3,
  ExternalLink,
  LockKeyhole,
  Pencil,
  Plus,
  UsersRound,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  FormError,
  Modal,
  SaveButton,
  useSubmit,
} from "../components/ui";
import type { Meeting as MeetingRecord, MeetingInput } from "../lib/types";
import "./extras.css";
import "./SupervisorMeetings.css";

type MeetingType = "daily" | "weekly";
type MeetingStatus = "planned" | "held" | "missed";

const typeLabels: Record<MeetingType, string> = {
  daily: "لقاء يومي بين الرفيقين",
  weekly: "لقاء أسبوعي مع المشرف",
};
const statusLabels: Record<MeetingStatus, string> = {
  planned: "مجدول",
  held: "تمّ اللقاء",
  missed: "لم يتمّ اللقاء",
};

function dateTimeParts(value: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function localToInstant(date: string, time: string, timeZone: string) {
  const requested = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(requested))
    throw new Error("اختاري تاريخًا ووقتًا صالحين للّقاء.");
  let result = requested;
  for (let i = 0; i < 3; i++) {
    const shown = dateTimeParts(new Date(result), timeZone);
    result += requested - Date.parse(`${shown.date}T${shown.time}:00Z`);
  }
  const shown = dateTimeParts(new Date(result), timeZone);
  if (shown.date !== date || shown.time !== time)
    throw new Error(
      "هذا التوقيت غير متاح في المنطقة الزمنية المختارة. اختاري وقتًا آخر.",
    );
  return new Date(result).toISOString();
}

function MeetingForm({
  meeting,
  pairId,
  timeZone,
  supervisor,
  supervisorView,
  onSave,
  onClose,
}: {
  meeting?: MeetingRecord;
  pairId: string;
  timeZone: string;
  supervisor: boolean;
  supervisorView: boolean;
  onSave: (value: MeetingInput) => Promise<unknown>;
  onClose: () => void;
}) {
  const initial = dateTimeParts(meeting?.scheduled_at ?? new Date(), timeZone);
  const [type, setType] = useState<MeetingType>(
    meeting?.type ?? (supervisor ? "weekly" : "daily"),
  );
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(meeting ? initial.time : "20:00");
  const [url, setUrl] = useState(meeting?.link ?? "");
  const [status, setStatus] = useState<MeetingStatus>(
    meeting?.status ?? "planned",
  );
  const [notes, setNotes] = useState(meeting?.note ?? "");
  const { busy, error, submit } = useSubmit();
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(async () => {
      if (url.trim()) {
        try {
          if (new URL(url.trim()).protocol !== "https:") throw new Error();
        } catch {
          throw new Error("أدخلي رابطًا صالحًا يبدأ بـ https://.");
        }
      }
      await onSave({
        id: meeting?.id,
        pair_id: pairId,
        type,
        scheduled_at: localToInstant(date, time, timeZone),
        status,
        date,
        link: url.trim(),
        note: notes.trim(),
        version: meeting?.version,
      });
    }, onClose);
  };
  return (
    <Modal
      title={
        meeting
          ? "تحديث اللقاء"
          : supervisorView
            ? "جدولة لقاء متابعة"
            : "جدولة لقاء جديد"
      }
      onClose={onClose}
    >
      <form className="aux-form" onSubmit={handleSubmit}>
        <p className="aux-hint">
          {supervisorView
            ? "حدّدي موعد المتابعة ورابط اللقاء وملاحظاته الخاصة بهذا الفريق."
            : "مساحة للمتابعة والتشجيع. تسجيل اللقاء مستقل عن إنجاز الحفظ والمراجعة."}
        </p>
        {!supervisorView && (
          <Field label="نوع اللقاء">
            <select
              className="input"
              value={type}
              disabled={!!meeting}
              onChange={(e) => setType(e.target.value as MeetingType)}
            >
              <option value={supervisor ? "weekly" : "daily"}>
                {typeLabels[supervisor ? "weekly" : "daily"]}
              </option>
            </select>
          </Field>
        )}
        <div className="form-grid">
          <Field label="التاريخ">
            <input
              className="input"
              type="date"
              value={date}
              required
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="الوقت">
            <input
              className="input"
              type="time"
              value={time}
              required
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
        </div>
        <p className="aux-hint">
          {supervisorView
            ? "تُعرض المواعيد بحسب توقيت الفريق:"
            : "تُعرض المواعيد بحسب توقيت الرفقة:"}{" "}
          <bdi>{timeZone}</bdi>.
        </p>
        <Field
          label="رابط اللقاء (اختياري)"
          hint="رابط HTTPS لأي خدمة لقاءات تختارونها؛ لا تُجرى مكالمات داخل الموقع."
        >
          <input
            className="input"
            dir="ltr"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            maxLength={2048}
          />
        </Field>
        {meeting && (
          <Field
            label="نتيجة اللقاء"
            hint={
              meeting.status !== "planned"
                ? "تبقى نتيجة اللقاء محفوظة عند تصحيح الموعد أو الملاحظات."
                : undefined
            }
          >
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as MeetingStatus)}
            >
              <option value="planned" disabled={meeting.status !== "planned"}>
                مجدول
              </option>
              <option value="held">تمّ اللقاء</option>
              <option value="missed">لم يتمّ اللقاء</option>
            </select>
          </Field>
        )}
        <Field label="ملاحظات (اختياري)">
          <textarea
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            placeholder="ما الذي تودّون مناقشته أو تذكّره؟"
          />
        </Field>
        <FormError error={error} />
        <div className="aux-form-footer">
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            إلغاء
          </Button>
          <SaveButton busy={busy}>
            {meeting ? "حفظ التغييرات" : "جدولة اللقاء"}
          </SaveButton>
        </div>
      </form>
    </Modal>
  );
}

export type SupervisorMeetingVisibility = "all" | "scheduled";

export default function Meetings({
  supervisorView = false,
  visibility = "all",
  onBack,
}: {
  supervisorView?: boolean;
  visibility?: SupervisorMeetingVisibility;
  onBack?: () => void;
}) {
  const { profile, pair: currentPair, meetings, saveMeeting } = useApp();
  const [filter, setFilter] = useState<"all" | MeetingType>("all");
  const [editing, setEditing] = useState<MeetingRecord | "new" | null>(null);
  const timeZone = currentPair?.time_zone ?? "Africa/Algiers";
  const supervisor = currentPair?.supervisor_id === profile?.id;
  const readOnly =
    currentPair?.status !== "active" ||
    currentPair?.frozen ||
    currentPair?.members.some((member) => !member.enabled);
  const visible = useMemo(
    () =>
      meetings
        .filter(
          (m: MeetingRecord) =>
            m.pair_id === currentPair?.id &&
            (supervisorView
              ? visibility === "all" || m.type === "weekly"
              : filter === "all" || m.type === filter),
        )
        .sort((a: MeetingRecord, b: MeetingRecord) => {
          const aUpcoming =
            a.status === "planned" && Date.parse(a.scheduled_at) >= Date.now();
          const bUpcoming =
            b.status === "planned" && Date.parse(b.scheduled_at) >= Date.now();
          if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
          return aUpcoming
            ? Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at)
            : Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at);
        }),
    [meetings, currentPair?.id, filter, supervisorView, visibility],
  );
  const sections = supervisorView
    ? [
        {
          kind: "daily",
          title: "اللقاءات الداخلية",
          description: "بين أعضاء الفريق",
        },
        {
          kind: "weekly",
          title: "لقاءات المتابعة",
          description: "بمشاركة المشرفة",
        },
      ].filter((section) => visibility === "all" || section.kind === "weekly")
    : [{ kind: "all", title: "", description: "" }];
  if (!currentPair)
    return (
      <EmptyState
        title={
          supervisorView
            ? "لا يوجد فريق لعرض لقاءاته"
            : "لا توجد رفقة لعرض لقاءاتها"
        }
        description={
          supervisorView
            ? "اختر فريقًا من قائمة لقاءات الفرق."
            : "تظهر اللقاءات بعد انضمام الرفيقين وتفعيل الرفقة."
        }
      />
    );
  return (
    <div className="meetings-page">
      {supervisorView && onBack && (
        <div className="view-toolbar">
          <Button variant="ghost" onClick={onBack}>
            <UsersRound size={17} />
            كل لقاءات الرفقاء
          </Button>
        </div>
      )}
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {supervisorView ? "متابعة الفريق" : "نلتقي لنثبت"}
          </p>
          <h1>{supervisorView ? `لقاءات ${currentPair.name}` : "اللقاءات"}</h1>
          <p className="page-intro">
            {supervisorView
              ? "نظّم المواعيد، وتابع النتائج والملاحظات الخاصة بهذا الفريق."
              : "موعد يجمعكما، وخطوة تُعينكما على الاستمرار."}
          </p>
        </div>
        <Button disabled={readOnly} onClick={() => setEditing("new")}>
          <Plus size={18} />
          جدولة لقاء
        </Button>
      </div>
      {readOnly && (
        <p className="readonly-notice">
          <LockKeyhole size={17} />
          {supervisorView
            ? "هذا الفريق للقراءة فقط حاليًا؛ لا يمكن تعديل اللقاءات."
            : "هذه الرفقة للقراءة فقط حاليًا؛ لا يمكن تعديل اللقاءات."}
        </p>
      )}
      <div className="view-toolbar">
        {!supervisorView && (
          <div className="filter-tabs" role="group" aria-label="تصفية اللقاءات">
            {(["all", "daily", "weekly"] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value === "all"
                  ? "كل اللقاءات"
                  : value === "daily"
                    ? "اللقاءات اليومية"
                    : "مع المشرف"}
              </button>
            ))}
          </div>
        )}
        <span className="aux-hint">
          {supervisorView ? "توقيت الفريق:" : "توقيت الرفقة:"}{" "}
          <bdi>{timeZone}</bdi>
        </span>
      </div>
      {sections.map((section) => {
        const sectionMeetings =
          section.kind === "all"
            ? visible
            : visible.filter((meeting) => meeting.type === section.kind);
        return (
          <section
            key={section.kind}
            className={
              supervisorView ? "supervisor-meeting-section" : undefined
            }
            aria-label={section.title || undefined}
          >
            {supervisorView && (
              <div className="supervisor-meeting-section-heading">
                <h2>{section.title}</h2>
                <p>{section.description}</p>
              </div>
            )}
            {sectionMeetings.length === 0 ? (
              <EmptyState
                title={
                  supervisorView
                    ? section.kind === "daily"
                      ? "لا توجد لقاءات داخلية مسجّلة"
                      : "لا توجد لقاءات متابعة مسجّلة"
                    : "مساحة للقاء القادم"
                }
                description={
                  supervisorView
                    ? section.kind === "daily"
                      ? "تظهر هنا المواعيد التي يسجّلها أعضاء الفريق."
                      : "يمكنك تحديد موعد المتابعة المناسب عند تفعيل الفريق."
                    : supervisor
                      ? "حدّدي موعدًا أسبوعيًا لمراجعة المسار مع الرفيقين."
                      : "حدّدا موعدًا يوميًا مناسبًا للتسميع والمتابعة."
                }
                action={
                  !readOnly &&
                  (!supervisorView || section.kind === "weekly") && (
                    <Button
                      variant="secondary"
                      onClick={() => setEditing("new")}
                    >
                      جدولة أول لقاء
                    </Button>
                  )
                }
              />
            ) : (
              <div className="meeting-list">
                {sectionMeetings.map((meeting: MeetingRecord) => {
                  const date = new Date(meeting.scheduled_at);
                  const canEdit =
                    !readOnly &&
                    (supervisor
                      ? meeting.type === "weekly"
                      : meeting.type === "daily");
                  const editor =
                    meeting.updated_by === profile?.id
                      ? profile.display_name
                      : currentPair.members.find(
                          (p: { id: string; display_name: string }) =>
                            p.id === meeting.updated_by,
                        )?.display_name;
                  return (
                    <article className="meeting-card" key={meeting.id}>
                      <div className="meeting-date-tile" aria-hidden="true">
                        <strong>
                          {new Intl.DateTimeFormat("ar-DZ", {
                            numberingSystem: "arab",
                            day: "numeric",
                            timeZone,
                          }).format(date)}
                        </strong>
                        <span>
                          {new Intl.DateTimeFormat("ar-DZ", {
                            numberingSystem: "arab",
                            month: "short",
                            timeZone,
                          }).format(date)}
                        </span>
                      </div>
                      <div className="meeting-content">
                        <div className="meeting-type-label">
                          {!supervisorView && (
                            <Badge
                              tone={meeting.type === "weekly" ? "gold" : "teal"}
                            >
                              {meeting.type === "weekly"
                                ? "مع المشرف"
                                : "بين الرفيقين"}
                            </Badge>
                          )}
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
                        </div>
                        {supervisorView ? (
                          <h3>
                            {meeting.type === "daily"
                              ? "لقاء داخلي"
                              : "لقاء متابعة"}
                          </h3>
                        ) : (
                          <h2>{typeLabels[meeting.type]}</h2>
                        )}
                        <div className="meeting-meta">
                          <span>
                            <CalendarDays size={15} />
                            {new Intl.DateTimeFormat("ar-DZ", {
                              numberingSystem: "arab",
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              timeZone,
                            }).format(date)}
                          </span>
                          <span>
                            <Clock3 size={15} />
                            {new Intl.DateTimeFormat("ar-DZ", {
                              numberingSystem: "arab",
                              hour: "numeric",
                              minute: "2-digit",
                              timeZone,
                            }).format(date)}
                          </span>
                          <span>
                            <UsersRound size={15} />
                            {supervisorView
                              ? [
                                  ...currentPair.members.map(
                                    (member) => member.display_name,
                                  ),
                                  ...(meeting.type === "weekly"
                                    ? [
                                        currentPair.supervisor?.display_name ??
                                          profile?.display_name,
                                      ].filter(Boolean)
                                    : []),
                                ].join("، ")
                              : meeting.type === "weekly"
                                ? "الرفيقان والمشرف"
                                : "الرفيقان"}
                          </span>
                        </div>
                        {meeting.status === "planned" &&
                          Date.parse(meeting.scheduled_at) < Date.now() && (
                            <p className="meeting-past-cue">
                              {supervisorView && meeting.type === "daily"
                                ? "بانتظار تسجيل أعضاء الفريق لنتيجة اللقاء."
                                : "مرّ موعد اللقاء؛ سجّلوا النتيجة عندما تتاح لكم الفرصة."}
                            </p>
                          )}
                        {meeting.note && (
                          <p className="meeting-notes">{meeting.note}</p>
                        )}
                        <p className="aux-hint">
                          آخر تحديث{editor ? ` بواسطة ${editor}` : ""} ·{" "}
                          {new Intl.DateTimeFormat("ar-DZ", {
                            numberingSystem: "arab",
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone,
                          }).format(new Date(meeting.updated_at))}
                        </p>
                      </div>
                      <div className="meeting-actions">
                        {meeting.link && (
                          <a
                            className="button button-secondary"
                            href={meeting.link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink size={16} />
                            رابط اللقاء
                          </a>
                        )}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            onClick={() => setEditing(meeting)}
                          >
                            <Pencil size={16} />
                            تحديث اللقاء
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
      {editing && (
        <MeetingForm
          meeting={editing === "new" ? undefined : editing}
          pairId={currentPair.id}
          timeZone={timeZone}
          supervisor={supervisor}
          supervisorView={supervisorView}
          onSave={saveMeeting}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
