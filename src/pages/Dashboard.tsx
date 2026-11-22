import { useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  Clock3,
  FileText,
  HeartHandshake,
  Leaf,
  Link2,
  Plus,
  RotateCcw,
  Sprout,
  Video,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Button, EmptyState, SectionTitle } from "../components/ui";
import { Rosette } from "../components/Brand";
import WeekControl from "../components/WeekControl";
import DayEditor from "../components/DayEditor";
import TargetEditor from "../components/TargetEditor";
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
  number,
  shiftDate,
} from "../components/presentation";

export default function Dashboard({
  navigate,
}: {
  navigate: (page: string) => void;
}) {
  const { profile, pair, targets, entries, meetings, resources, role, week } =
    useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const [targetOpen, setTargetOpen] = useState(false);
  if (!pair)
    return (
      <EmptyState
        title={role === "supervisor" ? "أول رفقة تبدأ بدعوة" : "رفقتك تبدأ هنا"}
        description={
          role === "supervisor"
            ? "أنشئ مساحة لرفيقين اختارا أن يحفظا معًا، ثم شارك رابط الدعوة مع كل منهما."
            : "بعد قبول دعوة المشرف واكتمال انضمام الرفيقين، ستظهر مساحتك هنا."
        }
        action={
          role === "supervisor" ? (
            <Button onClick={() => navigate("pairs")}>
              <Plus size={17} />
              إنشاء رفقة
            </Button>
          ) : undefined
        }
      />
    );
  if (pair.status === "pending")
    return (
      <EmptyState
        title="ننتظر اكتمال الرفقة"
        description="تبقى هذه المساحة معلّقة حتى يقبل الشخصان دعوتهما. يمكنك إدارة رابط كل دعوة من صفحة الرفقاء."
        action={
          <Button onClick={() => navigate("pairs")}>إدارة الدعوات</Button>
        }
      />
    );
  const people = pair.members ?? [];
  const self = people.find((p) => p.id === profile?.id) ?? people[0];
  const partner = people.find((p) => p.id !== self?.id);
  const canWrite =
    role === "member" && pair.status === "active" && !pair.frozen;
  const today = localToday();
  const day = today >= week && today <= shiftDate(week, 6) ? today : week;
  const entry = entries.find((e) => e.owner_id === self?.id && e.date === day);
  const target =
    targets.find((t) => t.status === "confirmed" && t.mode === "shared") ??
    targets.find((t) => t.status === "confirmed" && t.owner_id === self?.id);
  const hifdhRanges = entries
    .filter((e) => e.owner_id === self?.id)
    .flatMap((e) => e.actual_hifdh.ranges);
  const revisionRanges = entries
    .filter((e) => e.owner_id === self?.id)
    .flatMap((e) => e.actual_revision.ranges);
  const hifdhTotal = uniqueAyahs(target?.hifdh ?? []);
  const revisionTotal = uniqueAyahs(target?.revision ?? []);
  const hifdhDone = coveredAyahs(target?.hifdh ?? [], hifdhRanges);
  const revisionDone = coveredAyahs(target?.revision ?? [], revisionRanges);
  const upcoming = meetings
    .filter(
      (m) => m.status === "planned" && Date.parse(m.scheduled_at) >= Date.now(),
    )
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  const status = (state: string | undefined) =>
    state === "completed" ? (
      <Badge>تمّ الإنجاز</Badge>
    ) : state === "partial" ? (
      <Badge tone="gold">إنجاز جزئي</Badge>
    ) : state === "not_done" ? (
      <Badge tone="muted">لم يُنجز</Badge>
    ) : (
      <Badge tone="muted">لم يُسجّل</Badge>
    );
  return (
    <>
      <div className="welcome-row">
        <div>
          <p className="eyebrow">
            السَّلَامُ عَلَيْكِ، {profile?.display_name.split(" ")[0]}{" "}
            <span className="gold">✦</span>
          </p>
          <h1>معًا، نُثبّت ما نحفظ.</h1>
        </div>
        <WeekControl />
      </div>
      {pair.status === "archived" && (
        <div className="info-note" style={{ marginBottom: "1rem" }}>
          هذه الرفقة مؤرشفة. يمكنك الاطلاع على ما مضى، دون إجراء تغييرات.
        </div>
      )}
      {pair.frozen && (
        <div className="info-note" style={{ marginBottom: "1rem" }}>
          توقّفت الكتابة لهذه الرفقة مؤقتًا لأن أحد المشاركين موقوف. تبقى السجلات
          متاحة للمصرّح لهم.
        </div>
      )}
      <div className="dashboard-grid">
        <div className="dashboard-primary">
          <section className="journey-card">
            <Rosette />
            <div>
              <span className="journey-tag">
                <Sprout size={16} />
                نوايا طيبة، وخطوات ثابتة
              </span>
              <h2>على مهلٍ، وبصحبةٍ طيبة.</h2>
              <p>
                ليست العبرة بكثرة الخطوات، بل بصدقها ودوامها.
                <br />
                اجعلي لهذا اليوم نصيبًا من الحفظ والمراجعة.
              </p>
              <Button variant="secondary" onClick={() => navigate("plan")}>
                <BookOpen size={16} />
                {target ? "الاطّلاع على خطة الأسبوع" : "لنضع خطة هذا الأسبوع"}
              </Button>
            </div>
          </section>
          <div className="stats-row">
            <section className="stat-card">
              <div className="stat-top">
                <h2>
                  {role === "member"
                    ? "حفظك هذا الأسبوع"
                    : "الحفظ لهذا الأسبوع"}
                </h2>
                <span className="stat-icon">
                  <BookOpen size={18} />
                </span>
              </div>
              <div className="stat-value">
                {hifdhTotal ? (
                  <>
                    {number(hifdhDone)}{" "}
                    <span>/ {number(hifdhTotal)} آيات مخطّطة</span>
                  </>
                ) : (
                  <span>لا ينطبق · بلا هدف</span>
                )}
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${hifdhTotal ? (hifdhDone / hifdhTotal) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="stat-caption">
                {hifdhTotal
                  ? `${number(uniqueAyahs(hifdhRanges))} آيات محفوظة إجمالًا · يُحسب النطاق المشترك مرة واحدة`
                  : "لم يُحدّد هدف للحفظ بعد"}
              </p>
            </section>
            <section className="stat-card gold-stat">
              <div className="stat-top">
                <h2>
                  {role === "member"
                    ? "مراجعتك هذا الأسبوع"
                    : "المراجعة لهذا الأسبوع"}
                </h2>
                <span className="stat-icon">
                  <RotateCcw size={18} />
                </span>
              </div>
              <div className="stat-value">
                {revisionTotal ? (
                  <>
                    {number(revisionDone)}{" "}
                    <span>/ {number(revisionTotal)} آيات مخطّطة</span>
                  </>
                ) : (
                  <span>لا ينطبق · بلا هدف</span>
                )}
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${revisionTotal ? (revisionDone / revisionTotal) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="stat-caption">
                {revisionTotal
                  ? `${number(uniqueAyahs(revisionRanges))} آيات روجعت إجمالًا · كل نشاط على حدة`
                  : "لم يُحدّد هدف للمراجعة بعد"}
              </p>
            </section>
          </div>
          <section className="panel">
            <div className="day-header">
              <div>
                <h2>{day === today ? "خطوتك اليوم" : "خطوة هذا اليوم"}</h2>
                <p>
                  {dateText(day, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              </div>
              <Badge tone="gold">
                <Leaf size={13} />
                قليلٌ دائم
              </Badge>
            </div>
            <div className="activity-row">
              <span className="activity-symbol">
                <BookOpen size={21} strokeWidth={1.5} />
              </span>
              <div className="activity-text">
                <h3>الحفظ الجديد</h3>
                <p>
                  {entry?.plan_hifdh.state === "planned" ? (
                    <RangeText ranges={entry.plan_hifdh.ranges} />
                  ) : entry?.plan_hifdh.state === "none" ? (
                    "لا يوجد هدف لهذا النشاط اليوم"
                  ) : (
                    "لم تُحفظ خطة بعد"
                  )}
                </p>
              </div>
              {status(entry?.actual_hifdh.state)}
            </div>
            <div className="activity-row">
              <span className="activity-symbol revision">
                <RotateCcw size={21} strokeWidth={1.5} />
              </span>
              <div className="activity-text">
                <h3>المراجعة</h3>
                <p>
                  {entry?.plan_revision.state === "planned" ? (
                    <RangeText ranges={entry.plan_revision.ranges} />
                  ) : entry?.plan_revision.state === "none" ? (
                    "لا يوجد هدف لهذا النشاط اليوم"
                  ) : (
                    "لم تُحفظ خطة بعد"
                  )}
                </p>
              </div>
              {status(entry?.actual_revision.state)}
            </div>
            <div className="today-action">
              <small>كل إنجاز تُسجّلينه، خطوة نحو الثبات.</small>
              {canWrite ? (
                <Button onClick={() => setEditing(day)}>
                  <CheckCheck size={17} />
                  تسجيل إنجاز اليوم
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => navigate("progress")}>
                  الاطّلاع على الإنجاز
                  <ChevronLeft size={15} />
                </Button>
              )}
            </div>
          </section>
        </div>
        <aside className="dashboard-secondary">
          <section className="panel partner-card">
            <SectionTitle
              title="رفقتك في الرحلة"
              action={<HeartHandshake size={19} className="gold" />}
            />
            <div className="partner-card-top">
              <span className="avatar avatar-gold">
                {initials(partner?.display_name ?? "رفيق الحفظ")}
              </span>
              <div>
                <h3>{partner?.display_name ?? "رفيق الحفظ"}</h3>
                <p>رفيقة الحفظ والمراجعة</p>
              </div>
            </div>
            <p className="quote">«نشدُّ أزر بعضنا، ونمضي إلى ما نحبّ.»</p>
            <div className="mini-info" style={{ marginTop: ".7rem" }}>
              <Sprout size={15} />
              بإشراف {pair.supervisor?.display_name ?? "المشرف المكلّف"}
            </div>
          </section>
          <section className="panel next-meeting">
            <SectionTitle
              title="لقاؤكما القادم"
              action={<CalendarDays size={18} className="gold" />}
            />
            {upcoming ? (
              <>
                <Badge tone="gold">
                  {upcoming.type === "weekly"
                    ? "لقاء أسبوعي مع المشرف"
                    : "لقاء يومي بين الرفيقين"}
                </Badge>
                <div className="meeting-date">
                  <span className="calendar-tile">
                    <strong>
                      {dateText(upcoming.date, { day: "numeric" })}
                    </strong>
                    <small>{dateText(upcoming.date, { month: "short" })}</small>
                  </span>
                  <div>
                    <h3>{dayName(upcoming.date)}</h3>
                    <p>
                      <Clock3 size={12} style={{ verticalAlign: "middle" }} />{" "}
                      {dateText(upcoming.scheduled_at, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      · الجزائر
                    </p>
                  </div>
                </div>
                {upcoming.link ? (
                  <a
                    className="button button-secondary"
                    href={upcoming.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Video size={16} />
                    فتح رابط اللقاء
                  </a>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => navigate("meetings")}
                  >
                    تفاصيل اللقاء
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className="muted" style={{ fontSize: ".8125rem" }}>
                  لم يُحدّد موعد للقاء القادم بعد.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => navigate("meetings")}
                >
                  إلى اللقاءات
                </Button>
              </>
            )}
          </section>
          <section className="panel">
            <SectionTitle
              title="زاد الرحلة"
              subtitle="موارد اختارها لكما المشرف"
              action={
                <button
                  className="icon-button"
                  aria-label="عرض كل الموارد"
                  onClick={() => navigate("resources")}
                >
                  <ChevronLeft size={18} />
                </button>
              }
            />
            {resources
              .filter((r) => r.status === "published")
              .slice(0, 2)
              .map((r) => (
                <div key={r.id} className="resource-mini">
                  <span className="resource-symbol">
                    {r.type === "file" ? (
                      <FileText size={20} />
                    ) : (
                      <Link2 size={20} />
                    )}
                  </span>
                  <div>
                    <h3>{r.title}</h3>
                    <p>
                      {r.type === "file" ? "ملف خاص بالرفقة" : "رابط تعليمي"}
                    </p>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`عرض ${r.title}`}
                    onClick={() => navigate("resources")}
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>
              ))}
            {!resources.length && (
              <p className="muted" style={{ fontSize: ".8125rem" }}>
                ستجدين هنا ما يشاركه المشرف من مواد نافعة.
              </p>
            )}
          </section>
        </aside>
        <section className="panel weekly-panel">
          <SectionTitle
            title="أسبوعك، خطوة بخطوة"
            subtitle="اختاري يومًا للاطّلاع على خطته وتسجيل إنجازه"
            action={
              canWrite ? (
                <Button variant="ghost" onClick={() => setTargetOpen(true)}>
                  <Plus size={15} />
                  هدف الأسبوع
                </Button>
              ) : undefined
            }
          />
          <div className="week-days">
            {Array.from({ length: 7 }, (_, i) => {
              const d = shiftDate(week, i);
              const e = entries.find(
                (x) => x.owner_id === self?.id && x.date === d,
              );
              const logged =
                e &&
                e.actual_hifdh.state !== "unlogged" &&
                e.actual_revision.state !== "unlogged";
              const planned =
                e &&
                e.plan_hifdh.state !== "draft" &&
                e.plan_revision.state !== "draft";
              return (
                <button
                  key={d}
                  className={`week-day ${d === today ? "is-today" : ""}`}
                  onClick={() =>
                    canWrite ? setEditing(d) : navigate("progress")
                  }
                >
                  <span className="day-name">{dayName(d)}</span>
                  <span className="day-number">
                    {dateText(d, { day: "numeric" })}
                  </span>
                  <span className="day-indicator">
                    {logged ? (
                      <>
                        <Check size={14} />
                        تمّ التسجيل
                      </>
                    ) : planned ? (
                      <>
                        <CalendarDays size={12} />
                        مخطّط
                      </>
                    ) : (
                      "بلا خطة"
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="week-legend">
            <span>
              <Check size={13} />
              تمّ تسجيل النشاطين
            </span>
            <span>
              <CalendarDays size={12} />
              خطة محفوظة
            </span>
            <span>— غياب التسجيل لا يعني عدم الإنجاز</span>
          </div>
          <div className="pair-progress">
            <div className="comparison-labels">
              <span>رفقاء الأسبوع</span>
              <span>الحفظ الجديد</span>
              <span>المراجعة</span>
            </div>
            {people.map((person, i) => {
              const t =
                targets.find(
                  (t) => t.status === "confirmed" && t.mode === "shared",
                ) ??
                targets.find(
                  (t) => t.status === "confirmed" && t.owner_id === person.id,
                );
              return (
                <div className="member-progress" key={person.id}>
                  <div className="flex">
                    <span className={`avatar ${i ? "avatar-gold" : ""}`}>
                      {initials(person.display_name)}
                    </span>
                    <strong>
                      {person.display_name.split(" ").slice(0, 2).join(" ")}
                      {person.id === profile?.id ? " (أنتِ)" : ""}
                    </strong>
                  </div>
                  {(["hifdh", "revision"] as const).map((activity) => {
                    const total = uniqueAyahs(t?.[activity] ?? []);
                    const actual = entries
                      .filter((e) => e.owner_id === person.id)
                      .flatMap((e) => e[`actual_${activity}`].ranges);
                    const done = coveredAyahs(t?.[activity] ?? [], actual);
                    return (
                      <div key={activity}>
                        <div className="progress-label">
                          <span>
                            {total
                              ? `${number(done)} من ${number(total)} آيات`
                              : "لا ينطبق · بلا هدف"}
                          </span>
                          <span>
                            {total
                              ? `${number(Math.round((done / total) * 100))}٪`
                              : "—"}
                          </span>
                        </div>
                        <div className="progress-track">
                          <div
                            className={`progress-fill ${activity === "revision" ? "gold-fill" : ""}`}
                            style={{
                              width: `${total ? (done / total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>
      </div>
      {editing && <DayEditor date={editing} onClose={() => setEditing(null)} />}
      {targetOpen && <TargetEditor onClose={() => setTargetOpen(false)} />}
    </>
  );
}
