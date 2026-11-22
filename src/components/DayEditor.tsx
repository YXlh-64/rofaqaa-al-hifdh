import { useState } from "react";
import { BookOpen, CircleCheck, RotateCcw } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button, Field, FormError, Modal, SaveButton, useSubmit } from "./ui";
import { RangeEditor } from "./RangeEditor";
import type { VerseRange } from "./RangeEditor";
import { dateText, localToday } from "./presentation";

type PlanActivity = {
  state: "draft" | "planned" | "none";
  ranges: VerseRange[];
};
type ActualActivity = {
  state: "unlogged" | "not_done" | "partial" | "completed";
  ranges: VerseRange[];
};
function PlanInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PlanActivity;
  onChange: (v: PlanActivity) => void;
}) {
  return (
    <div className="activity-editor">
      <h3>
        {label === "الحفظ الجديد" ? (
          <BookOpen size={18} />
        ) : (
          <RotateCcw size={18} />
        )}
        {label}
      </h3>
      <Field label={`خطة ${label}`}>
        <select
          value={value.state}
          onChange={(e) => {
            const state = e.target.value as PlanActivity["state"];
            onChange({
              state,
              ranges:
                state === "planned"
                  ? value.ranges.length
                    ? value.ranges
                    : [{ surah: 24, from: 1, to: 1 }]
                  : [],
            });
          }}
        >
          <option value="draft">لم أُحدّد بعد · مسودة</option>
          <option value="planned">سأُنجز آيات محدّدة</option>
          <option value="none">لا يوجد هدف لهذا النشاط اليوم</option>
        </select>
      </Field>
      {value.state === "planned" && (
        <RangeEditor
          label={label}
          value={value.ranges}
          onChange={(ranges) => onChange({ ...value, ranges })}
        />
      )}
    </div>
  );
}
function ActualInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ActualActivity;
  onChange: (v: ActualActivity) => void;
}) {
  return (
    <div className="activity-editor">
      <h3>
        {label === "الحفظ الجديد" ? (
          <BookOpen size={18} />
        ) : (
          <RotateCcw size={18} />
        )}
        {label}
      </h3>
      <Field label={`حالة إنجاز ${label}`}>
        <select
          value={value.state}
          onChange={(e) => {
            const state = e.target.value as ActualActivity["state"];
            onChange({
              state,
              ranges:
                state === "partial" || state === "completed"
                  ? value.ranges.length
                    ? value.ranges
                    : [{ surah: 24, from: 1, to: 1 }]
                  : [],
            });
          }}
        >
          <option value="unlogged">لم أُسجّل بعد</option>
          <option value="not_done">لم أُنجز</option>
          <option value="partial">أنجزت جزءًا</option>
          <option value="completed">أتممت النشاط</option>
        </select>
      </Field>
      {(value.state === "partial" || value.state === "completed") && (
        <>
          <p className="field-hint" style={{ marginTop: ".6rem" }}>
            حدّدي ما أنجزتِه بالفعل، حتى لو اختلف عن الخطة.
          </p>
          <RangeEditor
            label={`إنجاز ${label}`}
            value={value.ranges}
            onChange={(ranges) => onChange({ ...value, ranges })}
          />
        </>
      )}
    </div>
  );
}
export default function DayEditor({
  date,
  initialTab = "actual",
  onClose,
}: {
  date: string;
  initialTab?: "plan" | "actual";
  onClose: () => void;
}) {
  const { entries, profile, saveDay } = useApp();
  const existing = entries.find(
    (e) => e.owner_id === profile?.id && e.date === date,
  );
  const [tab, setTab] = useState(initialTab);
  const [ph, setPh] = useState<PlanActivity>(
    existing?.plan_hifdh ?? { state: "draft", ranges: [] },
  );
  const [pr, setPr] = useState<PlanActivity>(
    existing?.plan_revision ?? { state: "draft", ranges: [] },
  );
  const [ah, setAh] = useState<ActualActivity>(
    existing?.actual_hifdh ?? { state: "unlogged", ranges: [] },
  );
  const [ar, setAr] = useState<ActualActivity>(
    existing?.actual_revision ?? { state: "unlogged", ranges: [] },
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const { busy, error, setError, submit } = useSubmit();
  const save = (draft: boolean) => {
    if (
      tab === "plan" &&
      !draft &&
      (ph.state === "draft" || pr.state === "draft")
    ) {
      setError(
        "حدّدي الحفظ والمراجعة، أو اختاري صراحةً عدم وجود هدف، ثم احفظي الخطة. يمكنك حفظها كمسودة أيضًا.",
      );
      return;
    }
    if (
      [ph, pr, ah, ar].some(
        (a) =>
          ["planned", "partial", "completed"].includes(a.state) &&
          !a.ranges.length,
      )
    ) {
      setError("أضيفي نطاق الآيات لكل نشاط محدّد.");
      return;
    }
    void submit(
      () =>
        saveDay(date, {
          kind: tab,
          plan_hifdh: ph,
          plan_revision: pr,
          actual_hifdh: ah,
          actual_revision: ar,
          note,
          version: existing?.version,
        }),
      onClose,
    );
  };
  return (
    <Modal
      wide
      title={dateText(date, { weekday: "long", day: "numeric", month: "long" })}
      onClose={onClose}
    >
      <div className="tabs day-form-tabs">
        <button
          className={`tab ${tab === "plan" ? "active" : ""}`}
          onClick={() => setTab("plan")}
        >
          خطة اليوم
        </button>
        <button
          className={`tab ${tab === "actual" ? "active" : ""}`}
          onClick={() => setTab("actual")}
        >
          تسجيل الإنجاز
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
      >
        {date < localToday() && tab === "actual" && (
          <div className="info-note">
            هذا تسجيل ليوم سابق. سيبقى تاريخ اليوم الأصلي محفوظًا.
          </div>
        )}
        {tab === "plan" ? (
          <>
            <p className="field-hint">
              لكل نشاط خطته المستقلة، بما في ذلك أيام الراحة.
            </p>
            <div className="target-grid">
              <PlanInput label="الحفظ الجديد" value={ph} onChange={setPh} />
              <PlanInput label="المراجعة" value={pr} onChange={setPr} />
            </div>
          </>
        ) : (
          <>
            <div className="info-note">
              <CircleCheck size={18} />
              كل خطوة تُحسب. تسجيل الإنجاز مستقل عن حضور اللقاء.
            </div>
            <div className="target-grid">
              <ActualInput label="الحفظ الجديد" value={ah} onChange={setAh} />
              <ActualInput label="المراجعة" value={ar} onChange={setAr} />
            </div>
          </>
        )}
        <div style={{ marginTop: "1rem" }}>
          <Field label="ملاحظة (اختياري)">
            <textarea
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ما الذي أعانك اليوم؟ وما الذي يحتاج إلى تيسير؟"
            />
          </Field>
        </div>
        <FormError error={error} />
        <div className="form-actions">
          <SaveButton busy={busy}>
            {tab === "plan" ? "حفظ خطة اليوم" : "حفظ الإنجاز"}
          </SaveButton>
          {tab === "plan" && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => save(true)}
            >
              حفظ كمسودة
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </div>
      </form>
    </Modal>
  );
}
