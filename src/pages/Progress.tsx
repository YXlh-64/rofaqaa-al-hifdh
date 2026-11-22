import { useState } from "react";
import { BookOpen, Clock3, Pencil, RotateCcw } from "lucide-react";
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
  localToday,
  shiftDate,
} from "../components/presentation";
import WeekControl from "../components/WeekControl";
import DayEditor from "../components/DayEditor";

const states = {
  unlogged: "لم يُسجّل بعد",
  not_done: "لم يُنجز",
  partial: "إنجاز جزئي",
  completed: "تمّ الإنجاز",
} as const;
export default function Progress() {
  const { pair, entries, profile, role, week } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  if (!pair || pair.status === "pending")
    return (
      <EmptyState
        title="ما زالت الرحلة في بدايتها"
        description="بعد اكتمال الرفقة، تظهر هنا الخطط والإنجازات لكل شخص على حدة."
      />
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">خطوة تُرى، وأثر يبقى</span>
          <h1>سجلّ الإنجاز</h1>
          <p>إنجاز كل رفيق، في الحفظ والمراجعة، دون مقارنة أو ترتيب.</p>
        </div>
        <WeekControl />
      </div>
      <div className="info-note">
        <BookOpen size={20} />
        الفراغ يعني أن النشاط لم يُسجّل بعد، ولا يعني عدم الإنجاز. حضور اللقاءات
        يُسجّل على حدة.
      </div>
      {(pair.members ?? []).map((person) => (
        <section className="panel progress-person" key={person.id}>
          <div className="target-header">
            <div className="target-member">
              <span className="avatar">{initials(person.display_name)}</span>
              <div>
                <h2>
                  {person.display_name}
                  {person.id === profile?.id ? " (أنتِ)" : ""}
                </h2>
                <span className="eyebrow">الحفظ والمراجعة، يومًا بيوم</span>
              </div>
            </div>
            {role === "member" &&
              person.id === profile?.id &&
              pair.status === "active" &&
              !pair.frozen && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    setEditing(
                      localToday() >= week && localToday() <= shiftDate(week, 6)
                        ? localToday()
                        : week,
                    )
                  }
                >
                  <Pencil size={15} />
                  تسجيل إنجاز
                </Button>
              )}
          </div>
          <div className="table-scroll">
            <table className="progress-table">
              <thead>
                <tr>
                  <th scope="col">اليوم</th>
                  <th scope="col">
                    <BookOpen size={13} /> الحفظ الجديد
                  </th>
                  <th scope="col">
                    <RotateCcw size={13} /> المراجعة
                  </th>
                  <th scope="col">ملاحظة</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 7 }, (_, i) => {
                  const date = shiftDate(week, i);
                  const entry = entries.find(
                    (e) => e.owner_id === person.id && e.date === date,
                  );
                  return (
                    <tr key={date}>
                      <td>
                        <strong>{dayName(date)}</strong>
                        <small>
                          {dateText(date, { day: "numeric", month: "short" })}
                        </small>
                        {role === "member" &&
                          person.id === profile?.id &&
                          pair.status === "active" &&
                          !pair.frozen && (
                            <button
                              className="text-button"
                              onClick={() => setEditing(date)}
                              aria-label={`تعديل إنجاز ${dayName(date)}`}
                            >
                              <Pencil size={12} /> تعديل
                            </button>
                          )}
                      </td>
                      {(["hifdh", "revision"] as const).map((a) => {
                        const actual = entry?.[`actual_${a}`];
                        const plan = entry?.[`plan_${a}`];
                        const state = actual?.state ?? "unlogged";
                        const offPlan =
                          actual?.ranges.length &&
                          coveredAyahs(plan?.ranges ?? [], actual.ranges) <
                            uniqueAyahs(actual.ranges);
                        return (
                          <td key={a}>
                            <Badge
                              tone={
                                state === "completed"
                                  ? "teal"
                                  : state === "partial"
                                    ? "gold"
                                    : "muted"
                              }
                            >
                              {states[state]}
                            </Badge>
                            {actual?.ranges.length ? (
                              <RangeText ranges={actual.ranges} />
                            ) : null}
                            <small>
                              المخطّط:{" "}
                              {plan?.state === "none" ? (
                                "لا هدف اليوم"
                              ) : plan?.ranges.length ? (
                                <RangeText ranges={plan.ranges} />
                              ) : (
                                "لم يُحدّد"
                              )}
                            </small>
                            {offPlan ? (
                              <small className="gold">
                                يتضمّن إنجازًا خارج الخطة
                              </small>
                            ) : null}
                          </td>
                        );
                      })}
                      <td>
                        {entry?.note ? (
                          <p
                            style={{
                              minWidth: "100px",
                              maxWidth: "220px",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {entry.note}
                          </p>
                        ) : (
                          <span className="muted">—</span>
                        )}
                        {entry && entry.version > 1 && (
                          <span className="edited-label">
                            <Pencil size={10} />
                            عُدّل · {dateText(entry.updated_at)}
                          </span>
                        )}
                        {entry && entry.created_at.slice(0, 10) > date && (
                          <span className="edited-label">
                            <Clock3 size={10} />
                            سُجّل ليوم سابق
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {editing && <DayEditor date={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
