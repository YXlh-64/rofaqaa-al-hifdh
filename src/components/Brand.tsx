import { BookOpen } from "lucide-react";

export function Rosette({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`rosette ${className}`}
      viewBox="0 0 240 240"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1">
        <path d="M120 5 145 53 195 45 187 95 235 120 187 145 195 195 145 187 120 235 95 187 45 195 53 145 5 120 53 95 45 45 95 53Z" />
        <path
          d="m120 24 29 30 42 9 9 42 30 29-30 29-9 42-42 9-29 30-29-30-42-9-9-42-30-29 30-29 9-42 42-9Z"
          transform="translate(0 -14)"
        />
        <path d="M120 41 176 64 199 120 176 176 120 199 64 176 41 120 64 64Z" />
        <path d="m120 59 43 18 18 43-18 43-43 18-43-18-18-43 18-43Z" />
        <circle cx="120" cy="120" r="25" />
        <path
          d="M120 5v230M5 120h230M45 45l150 150M195 45 45 195"
          opacity=".45"
        />
      </g>
    </svg>
  );
}

export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <span className="brand-mark">
        <BookOpen size={29} strokeWidth={1.3} />
        <span />
      </span>
      <div>
        <span className="brand-title">رفقاء الحفظ</span>
        {!compact && (
          <span className="brand-subtitle">معًا على طريق القرآن</span>
        )}
      </div>
    </div>
  );
}
