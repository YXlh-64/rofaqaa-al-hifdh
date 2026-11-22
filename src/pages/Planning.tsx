import { useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Check,
  HeartHandshake,
  Pencil,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import {
  Badge,
  Button,
  EmptyState,
  FormError,
  SectionTitle,
  useSubmit,
} from "../components/ui";
import { RangeText } from "../components/RangeEditor";
import {
  dateText,
  dayName,
  initials,
  localToday,
  shiftDate,
} from "../components/presentation";
import WeekControl from "../components/WeekControl";
import TargetEditor from "../components/TargetEditor";
import DayEditor from "../components/DayEditor";

export default function Planning() {
  const { pair, profile, targets, entries, week, role, respondTarget } =
    useApp();
  const [targetOpen, setTargetOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState(profile?.id ?? "");
  const { busy, error, submit } = useSubmit();
  if (!pair || pair.status === "pending")
    return (
      <EmptyState
        title="لم تكتمل الرفقة بعد"
        description="يبدأ التخطيط بعد انضمام الرفيقين وتفعيل المساحة."
      />
    );
  const people = pair.members ?? [];
  const person = people.find((p) => p.id === selected) ?? people[0];
  const canWrite =
    role === "member" &&
    person?.id === profile?.id &&
    pair.status === "active" &&
    !pair.frozen;
  const shared = targets.find(
    (t) => t.mode === "shared" && t.status === "confirmed",
  );
  const pending = targets.filter(
    (t) => t.mode === "shared" && t.status === "proposed",
  );
  const target =
    shared ??
    targets.find((t) => t.owner_id === person?.id && t.status === "confirmed");
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">النية أول الطريق</span>
          <h1>خطة الأسبوع</h1>
          <p>هدف واضح، وخطوات يومية تناسب كلًّا منكما.</p>
        </div>
        <WeekControl />
      </div>
      {pending.map((t) => (
        <section className="panel" style={{ marginBottom: "1rem" }} key={t.id}>
          <SectionTitle
            title="اقتراح هدف مشترك"
            action={<Badge tone="gold">بانتظار الموافقة</Badge>}
          />
          <div className="target-grid">
            <div className="target-box">
              <h3>
                <BookOpen size={17} />
                الحفظ
              </h3>
              <RangeText ranges={t.hifdh} />
            </div>
            <div className="target-box">
              <h3>
                <RotateCcw size={17} />
                المراجعة
              </h3>
              <RangeText ranges={t.revision} />
            </div>
          </div>
          {t.note && (
            <p
              className="muted"
              style={{ fontSize: ".875rem", marginTop: "1rem" }}
            >
              {t.note}
            </p>
          )}
          {role === "member" &&
          t.proposed_by !== profile?.id &&
          pair.status === "active" &&
          !pair.frozen ? (
            <div className="form-actions">
              <Button
                disabled={busy}
                onClick={() => submit(() => respondTarget(t.id, true))}
              >
                <Check size={16} />
                الموافقة على الهدف
              </Button>
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() => submit(() => respondTarget(t.id, false))}
              >
                <X size={16} />
                الإبقاء على هدفي الحالي
              </Button>
            </div>
          ) : (
            <p className="field-hint" style={{ marginTop: "1rem" }}>
              لا يغيّر هذا الاقتراح الأهداف الحالية حتى موافقة الرفيق الآخر.
            </p>
          )}
        </section>
      ))}
      <FormError error={error} />
      <div className="tabs" aria-label="خطط الرفيقين">
        {people.map((p) => (
          <button
            className={`tab ${p.id === person?.id ? "active" : ""}`}
            key={p.id}
            onClick={() => setSelected(p.id)}
          >
            {p.display_name}
            {p.id === profile?.id ? " (أنتِ)" : ""}
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="target-header">
          <div className="target-member">
            <span className="avatar">
              {initials(person?.display_name ?? "")}
            </span>
            <div>
              <h2>
                {shared
                  ? "هدفكما المشترك"
                  : `هدف ${person?.display_name.split(" ")[0] ?? "الأسبوع"}`}
              </h2>
              <span className="eyebrow">
                {shared
                  ? "وافق عليه الرفيقان · الإنجاز يبقى فرديًّا"
                  : "هدف فردي، بخطى تناسبك"}
              </span>
            </div>
          </div>
          {canWrite && (
            <Button variant="secondary" onClick={() => setTargetOpen(true)}>
              {target ? <Pencil size={15} /> : <Plus size={15} />}
              {target ? "تعديل الهدف" : "إضافة هدف"}
            </Button>
          )}
        </div>
        {target ? (
          <>
            <div className="target-grid">
              <div className="target-box">
                <h3>
                  <BookOpen size={17} />
                  الحفظ الجديد
                </h3>
                {target.hifdh.length ? (
                  <RangeText ranges={target.hifdh} />
                ) : (
                  <span className="field-hint">لا يوجد هدف للحفظ</span>
                )}
              </div>
              <div className="target-box">
                <h3>
                  <RotateCcw size={17} />
                  المراجعة
                </h3>
                {target.revision.length ? (
                  <RangeText ranges={target.revision} />
                ) : (
                  <span className="field-hint">لا يوجد هدف للمراجعة</span>
                )}
              </div>
            </div>
            {target.note && (
              <p style={{ marginTop: "1rem" }} className="field-hint">
                {target.note}
              </p>
            )}
            {shared && (
              <p className="mini-info" style={{ marginTop: "1rem" }}>
                <HeartHandshake size={16} />
                اتفاق على الوجهة، ومساحة لكل رفيق ليخطّط يومه.
              </p>
            )}
          </>
        ) : (
          <EmptyState
            title="لم تُحفظ خطة لهذا الأسبوع"
            description="الأسبوع الخالي من الخطة ليس أسبوعًا فاشلًا. ضعي هدفًا مناسبًا وابدئي من حيث أنتِ."
          />
        )}
      </section>
      <div
        className="section-title"
        style={{ marginTop: "1.8rem", marginBottom: ".5rem" }}
      >
        <div>
          <h2>الأيام التي تصنع الأثر</h2>
          <p>الحفظ والمراجعة حاضران في كل خطة، ولو باختيار يوم راحة.</p>
        </div>
        <CalendarDays size={20} className="gold" />
      </div>
      <div className="plan-days">
        {Array.from({ length: 7 }, (_, i) => {
          const date = shiftDate(week, i);
          const day = entries.find(
            (e) => e.owner_id === person?.id && e.date === date,
          );
          const draft =
            !day ||
            day.plan_hifdh.state === "draft" ||
            day.plan_revision.state === "draft";
          return (
            <div className="plan-day-row" key={date}>
              <div className="plan-day-name">
                <strong>{dayName(date)}</strong>
                <small>
                  {dateText(date, { day: "numeric", month: "short" })}
                </small>
                {date === localToday() && <Badge tone="teal">اليوم</Badge>}
              </div>
              {(["hifdh", "revision"] as const).map((activity) => (
                <div className="plan-day-activity" key={activity}>
                  <small>
                    {activity === "hifdh" ? "الحفظ الجديد" : "المراجعة"}
                  </small>
                  <p>
                    {day?.[`plan_${activity}`].state === "planned" ? (
                      <RangeText ranges={day[`plan_${activity}`].ranges} />
                    ) : day?.[`plan_${activity}`].state === "none" ? (
                      "لا يوجد هدف اليوم"
                    ) : (
                      "لم يُحدّد بعد"
                    )}
                  </p>
                </div>
              ))}
              {canWrite ? (
                <Button variant="ghost" onClick={() => setEditing(date)}>
                  <Pencil size={14} />
                  {draft ? "تخطيط اليوم" : "تعديل الخطة"}
                </Button>
              ) : (
                <Badge tone={draft ? "muted" : "teal"}>
                  {draft ? "مسودة / بلا خطة" : "خطة محفوظة"}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
      {targetOpen && <TargetEditor onClose={() => setTargetOpen(false)} />}
      {editing && (
        <DayEditor
          date={editing}
          initialTab="plan"
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
