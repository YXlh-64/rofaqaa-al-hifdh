import { Plus, Trash2 } from "lucide-react";
import { SURAHS } from "../lib/surahs";
import { Button } from "./ui";
import { number } from "./presentation";
export interface VerseRange {
  surah: number;
  from: number;
  to: number;
}
export function RangeText({ ranges }: { ranges: VerseRange[] | undefined }) {
  return (
    <>
      {ranges?.map((range, i) => (
        <span key={i} className="range-line">
          سورة {SURAHS.find((s) => s.id === range.surah)?.name ?? range.surah}{" "}
          <span className="muted">·</span>{" "}
          <bdi>
            {number(range.from)} – {number(range.to)}
          </bdi>
        </span>
      ))}
    </>
  );
}
export function RangeEditor({
  value,
  onChange,
  label,
}: {
  value: VerseRange[];
  onChange: (value: VerseRange[]) => void;
  label: string;
}) {
  const update = (index: number, change: Partial<VerseRange>) =>
    onChange(
      value.map((range, i) => (i === index ? { ...range, ...change } : range)),
    );
  return (
    <div className="range-editor">
      {value.map((range, index) => (
        <div className="range-editor-row" key={index}>
          <label>
            السورة
            <select
              aria-label={`${label} السورة ${index + 1}`}
              value={range.surah}
              onChange={(e) =>
                update(index, { surah: +e.target.value, from: 1, to: 1 })
              }
            >
              {SURAHS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            من آية
            <input
              aria-label={`${label} من آية ${index + 1}`}
              type="number"
              required
              min={1}
              max={SURAHS.find((s) => s.id === range.surah)?.ayahs}
              value={range.from}
              onChange={(e) => update(index, { from: +e.target.value })}
            />
          </label>
          <label>
            إلى آية
            <input
              aria-label={`${label} إلى آية ${index + 1}`}
              type="number"
              required
              min={range.from || 1}
              max={SURAHS.find((s) => s.id === range.surah)?.ayahs}
              value={range.to}
              onChange={(e) => update(index, { to: +e.target.value })}
            />
          </label>
          <button
            type="button"
            className="icon-button"
            aria-label={`حذف نطاق ${label} ${index + 1}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        className="button-small"
        onClick={() => onChange([...value, { surah: 24, from: 1, to: 1 }])}
      >
        <Plus size={15} />
        إضافة نطاق آيات
      </Button>
    </div>
  );
}
export function uniqueAyahs(ranges: VerseRange[]) {
  const set = new Set<string>();
  for (const r of ranges)
    for (let i = r.from; i <= r.to && i <= 286; i++) set.add(`${r.surah}:${i}`);
  return set.size;
}
export function coveredAyahs(target: VerseRange[], actual: VerseRange[]) {
  const done = new Set<string>();
  for (const r of actual)
    for (let i = r.from; i <= r.to && i <= 286; i++)
      done.add(`${r.surah}:${i}`);
  const planned = new Set<string>();
  for (const r of target)
    for (let i = r.from; i <= r.to && i <= 286; i++)
      if (done.has(`${r.surah}:${i}`)) planned.add(`${r.surah}:${i}`);
  return planned.size;
}
