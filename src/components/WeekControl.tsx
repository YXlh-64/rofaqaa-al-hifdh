import { ChevronLeft, ChevronRight } from "lucide-react";
import { useApp } from "../context/AppContext";
import { dateText, shiftDate, startOfWeek } from "./presentation";
export default function WeekControl() {
  const { week, setWeek } = useApp();
  const current = startOfWeek();
  return (
    <div className="week-control" aria-label="اختيار الأسبوع">
      <button
        className="icon-button"
        aria-label="الأسبوع السابق"
        onClick={() => setWeek(shiftDate(week, -7))}
      >
        <ChevronRight size={18} />
      </button>
      <div className="week-label">
        {dateText(week)} – {dateText(shiftDate(week, 6))}
        <small>
          {week === current
            ? "الأسبوع الحالي"
            : week > current
              ? "الأسبوع القادم"
              : "أسبوع سابق"}{" "}
          · بتوقيت الجزائر
        </small>
      </div>
      <button
        className="icon-button"
        aria-label="الأسبوع التالي"
        disabled={week >= shiftDate(current, 7)}
        onClick={() => setWeek(shiftDate(week, 7))}
      >
        <ChevronLeft size={18} />
      </button>
    </div>
  );
}
