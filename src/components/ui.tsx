import { useEffect, useId, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertCircle, BookOpen, LoaderCircle, X } from "lucide-react";

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "teal",
}: {
  children: ReactNode;
  tone?: "teal" | "gold" | "muted" | "red";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = old;
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          type="button"
          onClick={onClose}
          aria-label="إغلاق النافذة"
        >
          <X size={20} />
        </button>
      </div>
      <div className="modal-content">{children}</div>
    </dialog>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <BookOpen size={27} strokeWidth={1.4} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function FormError({ error }: { error: string }) {
  return error ? (
    <div className="form-error" role="alert">
      <AlertCircle size={19} />
      <span>{error}</span>
    </div>
  ) : null;
}

export function SaveButton({
  busy,
  children = "حفظ التغييرات",
}: {
  busy: boolean;
  children?: ReactNode;
}) {
  return (
    <Button type="submit" disabled={busy}>
      {busy && <LoaderCircle size={18} className="spin" />}
      {busy ? "جارٍ الحفظ…" : children}
    </Button>
  );
}

export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (fn: () => Promise<unknown>, done?: () => void) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      done?.();
    } catch (e) {
      setError(
        e instanceof Error && /[\u0600-\u06ff]/.test(e.message)
          ? e.message
          : "تعذّر حفظ التغييرات. تحقّقي من الاتصال وحاولي مجددًا.",
      );
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, submit };
}
