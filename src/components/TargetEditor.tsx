import { useState } from "react";
import { BookOpen, HeartHandshake, RotateCcw } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button, Field, FormError, Modal, SaveButton, useSubmit } from "./ui";
import { RangeEditor } from "./RangeEditor";
import type { VerseRange } from "./RangeEditor";
export default function TargetEditor({ onClose }: { onClose: () => void }) {
  const { targets, profile, saveTarget } = useApp();
  const current = targets.find(
    (t) => t.owner_id === profile?.id && t.status === "confirmed",
  );
  const [baseline] = useState(current);
  const [sharedBaseline] = useState(
    targets.find(
      (t) =>
        t.mode === "shared" &&
        t.status === "proposed" &&
        t.proposed_by === profile?.id,
    ),
  );
  const [mode, setMode] = useState<"individual" | "shared">("individual");
  const [hifdh, setHifdh] = useState<VerseRange[]>(
    current?.hifdh ?? [{ surah: 24, from: 1, to: 10 }],
  );
  const [revision, setRevision] = useState<VerseRange[]>(
    current?.revision ?? [{ surah: 23, from: 1, to: 10 }],
  );
  const [note, setNote] = useState(current?.note ?? "");
  const { busy, error, setError, submit } = useSubmit();
  return (
    <Modal wide title="هدف الأسبوع" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!hifdh.length && !revision.length) {
            setError("أضيفي هدفًا للحفظ أو المراجعة على الأقل.");
            return;
          }
          void submit(
            () =>
              saveTarget({
                mode,
                hifdh,
                revision,
                note,
                ...((mode === "individual" ? baseline : sharedBaseline)
                  ? {
                      id: (mode === "individual" ? baseline : sharedBaseline)!
                        .id,
                      version: (mode === "individual"
                        ? baseline
                        : sharedBaseline)!.version,
                    }
                  : {}),
              }),
            onClose,
          );
        }}
      >
        <Field label="كيف تحبّان التخطيط؟">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="individual">هدف فردي خاص بي</option>
            <option value="shared">اقتراح هدف مشترك للرفيقين</option>
          </select>
        </Field>
        {mode === "shared" && (
          <div className="info-note" style={{ marginTop: "1rem" }}>
            <HeartHandshake size={20} />
            لن يصبح الهدف المشترك نافذًا حتى يوافق رفيقك. تبقى الخطط والإنجازات
            اليومية مستقلة لكل شخص.
          </div>
        )}
        <div className="target-grid">
          <div className="activity-editor">
            <h3>
              <BookOpen size={18} />
              الحفظ الجديد
            </h3>
            <RangeEditor label="هدف الحفظ" value={hifdh} onChange={setHifdh} />
          </div>
          <div className="activity-editor">
            <h3>
              <RotateCcw size={18} />
              المراجعة
            </h3>
            <RangeEditor
              label="هدف المراجعة"
              value={revision}
              onChange={setRevision}
            />
          </div>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <Field label="ملاحظة (اختياري)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
            />
          </Field>
        </div>
        <FormError error={error} />
        <div className="form-actions">
          <SaveButton busy={busy}>
            {mode === "shared" ? "إرسال الاقتراح إلى رفيقي" : "حفظ الهدف"}
          </SaveButton>
          <Button type="button" variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </div>
      </form>
    </Modal>
  );
}
