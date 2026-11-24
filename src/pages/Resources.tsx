import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  FolderHeart,
  HardDrive,
  Link2,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  Trash2,
  UploadCloud,
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
import { SURAHS } from "../lib/surahs";
import type { Resource as ResourceRecord, ResourceInput } from "../lib/types";
import "./extras.css";
import "./SupervisorResources.css";

const maxFileBytes = 5 * 1024 * 1024;
const pairQuotaBytes = 50 * 1024 * 1024;
const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
const number = new Intl.NumberFormat("ar-DZ", {
  maximumFractionDigits: 1,
  numberingSystem: "arab",
});
function fileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${number.format(bytes / (1024 * 1024))} ميبيبايت`
    : `${number.format(bytes / 1024)} كيبيبايت`;
}

function ResourceForm({
  resource,
  pairId,
  usedBytes,
  onSave,
  onClose,
}: {
  resource?: ResourceRecord;
  pairId: string;
  usedBytes: number;
  onSave: (input: ResourceInput, file?: File) => Promise<unknown>;
  onClose: () => void;
}) {
  const [type, setType] = useState<"link" | "file">(resource?.type ?? "link");
  const [title, setTitle] = useState(resource?.title ?? "");
  const [description, setDescription] = useState(resource?.description ?? "");
  const [url, setUrl] = useState(resource?.url ?? "");
  const [weekStart, setWeekStart] = useState(resource?.week_start ?? "");
  const [surah, setSurah] = useState<number | "">(
    resource?.surah ??
      SURAHS.find((s) => `سورة ${s.name}` === resource?.surah_label)?.id ??
      "",
  );
  const [file, setFile] = useState<File>();
  const { busy, error, submit, setError } = useSubmit();
  const validateFile = (value?: File) => {
    setFile(undefined);
    setError("");
    if (!value) return;
    if (!allowedTypes.includes(value.type)) {
      setError("الأنواع المسموح بها: PDF وPNG وJPEG فقط.");
      return;
    }
    if (value.size === 0) {
      setError("هذا الملف فارغ. اختاري ملفًا آخر.");
      return;
    }
    if (value.size > maxFileBytes) {
      setError("حجم الملف أكبر من الحد المسموح به: ٥ ميبيبايت.");
      return;
    }
    if (usedBytes + value.size > pairQuotaBytes) {
      setError("مساحة ملفات الرفقة ممتلئة. يمكنك مشاركة رابط بدلًا من رفع ملف.");
      return;
    }
    setFile(value);
  };
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(async () => {
      if (!title.trim()) throw new Error("أدخلي عنوانًا للمورد.");
      if (type === "link") {
        try {
          if (new URL(url.trim()).protocol !== "https:") throw new Error();
        } catch {
          throw new Error("أدخلي رابطًا صالحًا يبدأ بـ https://.");
        }
      }
      if (type === "file" && !resource && !file)
        throw new Error("اختاري ملف PDF أو PNG أو JPEG صالحًا أولًا.");
      if (weekStart && new Date(`${weekStart}T12:00:00Z`).getUTCDay() !== 0)
        throw new Error("اختاري يوم الأحد الذي يبدأ به الأسبوع المطلوب.");
      await onSave(
        {
          id: resource?.id,
          pair_id: pairId,
          type,
          title: title.trim(),
          description: description.trim() || null,
          url: type === "link" ? url.trim() : null,
          week_start: weekStart || null,
          surah_label: surah
            ? `سورة ${SURAHS.find((s) => s.id === surah)!.name}`
            : null,
          version: resource?.version,
        },
        file,
      );
    }, onClose);
  };
  return (
    <Modal
      title={resource ? "تعديل بيانات المورد" : "مشاركة مورد مع الرفقة"}
      onClose={onClose}
    >
      <form className="aux-form" onSubmit={handleSubmit}>
        <p className="aux-hint">
          لن يرى هذا المورد إلا الرفيقان والمشرف المكلّف بهذه الرفقة.
        </p>
        {!resource && (
          <Field label="نوع المورد">
            <select
              className="input"
              value={type}
              onChange={(e) => {
                setType(e.target.value as "link" | "file");
                setError("");
              }}
            >
              <option value="link">رابط خارجي</option>
              <option value="file">ملف خاص</option>
            </select>
          </Field>
        )}
        <Field label="عنوان المورد">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            required
            placeholder="مثال: تفسير سورة النور"
          />
        </Field>
        {type === "link" ? (
          <Field
            label="الرابط"
            hint="روابط HTTPS فقط. يُفتح المورد في موقعه الخارجي."
          >
            <input
              className="input"
              type="url"
              dir="ltr"
              value={url}
              disabled={!!resource}
              required
              onChange={(e) => setUrl(e.target.value)}
              maxLength={2048}
              placeholder="https://"
            />
          </Field>
        ) : !resource ? (
          <Field label="الملف">
            <div className="file-picker">
              <UploadCloud size={27} aria-hidden="true" />
              <strong>اختاري ما يعين الرفقة على رحلتها</strong>
              <span className="aux-hint">
                PDF أو PNG أو JPEG · حتى ٥ ميبيبايت
              </span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                aria-label="اختيار ملف للمورد"
                onChange={(e) => validateFile(e.target.files?.[0])}
              />
              {file && (
                <span className="aux-hint">
                  <bdi>{file.name}</bdi> · {fileSize(file.size)}
                </span>
              )}
            </div>
          </Field>
        ) : (
          <p className="aux-note">
            يمكن تعديل وصف الملف وتصنيفه. لمشاركة ملف آخر، أضيفي موردًا جديدًا ثم
            اسحبي القديم إذا لم تعد هناك حاجة إليه.
          </p>
        )}
        <Field label="وصف مختصر (اختياري)">
          <textarea
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="كيف يمكن أن يساعد هذا المورد؟"
          />
        </Field>
        <div className="form-grid">
          <Field
            label="بداية الأسبوع (اختياري)"
            hint="اختاري يوم الأحد لربط المورد بخطة أسبوع محدّد."
          >
            <input
              className="input"
              type="date"
              value={weekStart}
              disabled={!!resource}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </Field>
          <Field label="السورة (اختياري)">
            <select
              className="input"
              value={surah}
              disabled={!!resource}
              onChange={(e) =>
                setSurah(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">دون تصنيف بسورة</option>
              {SURAHS.map((s) => (
                <option value={s.id} key={s.id}>
                  سورة {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <FormError error={error} />
        <div className="aux-form-footer">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            إلغاء
          </Button>
          <SaveButton busy={busy}>
            {resource ? "حفظ التغييرات" : "مشاركة المورد"}
          </SaveButton>
        </div>
      </form>
    </Modal>
  );
}

export default function Resources({
  supervisorView = false,
  onBack,
}: { supervisorView?: boolean; onBack?: () => void } = {}) {
  const {
    profile,
    pair: currentPair,
    resources,
    saveResource,
    withdrawResource,
    downloadResource,
    demo,
    storageUsageBytes,
  } = useApp();
  const [filter, setFilter] = useState<"all" | "link" | "file">("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ResourceRecord | "new" | null>(null);
  const [withdrawing, setWithdrawing] = useState<ResourceRecord | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const { busy, error, submit, setError } = useSubmit();
  const supervisor = currentPair?.supervisor_id === profile?.id;
  const readOnly =
    currentPair?.status !== "active" ||
    currentPair?.frozen ||
    currentPair?.members.some((member) => !member.enabled);
  const published = useMemo(
    () =>
      resources.filter(
        (r: ResourceRecord) =>
          r.pair_id === currentPair?.id && r.status === "published",
      ),
    [resources, currentPair?.id],
  );
  const usedBytes = storageUsageBytes;
  const visible = published
    .filter(
      (resource: ResourceRecord) =>
        (filter === "all" || resource.type === filter) &&
        `${resource.title} ${resource.description ?? ""} ${resource.surah_label ?? ""}`.includes(
          query.trim(),
        ),
    )
    .sort(
      (a: ResourceRecord, b: ResourceRecord) =>
        Date.parse(b.created_at) - Date.parse(a.created_at),
    );
  const download = async (resource: ResourceRecord) => {
    setDownloading(resource.id);
    setDownloadError("");
    try {
      const url = await downloadResource(resource);
      if (url) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.download = resource.title;
        anchor.click();
      }
    } catch (e) {
      setDownloadError(
        e instanceof Error && /[\u0600-\u06ff]/.test(e.message)
          ? e.message
          : "تعذّر تنزيل الملف. تحقّقي من الاتصال وصلاحية الوصول ثم حاولي مجددًا.",
      );
    } finally {
      setDownloading(null);
    }
  };
  if (!currentPair)
    return (
      <EmptyState
        title="موارد ترافق رحلتكما"
        description="تظهر الموارد الخاصة بعد تفعيل رفقة الحفظ."
      />
    );
  return (
    <div className="resources-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">زادٌ على الطريق</p>
          <h1>
            {supervisorView && supervisor
              ? `موارد ${currentPair.name}`
              : "الموارد"}
          </h1>
          <p className="page-intro">
            {supervisorView && supervisor
              ? "روابط وملفات خاصة بهذه الرفقة، تُشاركها مع الرفيقين."
              : "مواد يختارها المشرف لتعينكما على الحفظ والفهم والمراجعة."}
          </p>
        </div>
        {supervisor && (
          <div className="resource-team-actions">
            {supervisorView && onBack && (
              <Button variant="ghost" onClick={onBack}>
                كل موارد الرفقاء
              </Button>
            )}
            <Button disabled={readOnly} onClick={() => setEditing("new")}>
              <Plus size={18} />
              مشاركة مورد
            </Button>
          </div>
        )}
      </div>
      {readOnly && (
        <p className="readonly-notice">
          <LockKeyhole size={17} />
          هذه الرفقة للقراءة فقط حاليًا؛ لا يمكن إضافة موارد أو تعديلها.
        </p>
      )}
      {supervisor && (
        <div className="storage-usage">
          <HardDrive size={22} />
          <div className="storage-usage-text">
            <span>مساحة الملفات: {fileSize(usedBytes)} من ٥٠ ميبيبايت</span>
            <div
              className="storage-track"
              role="progressbar"
              aria-label="مساحة ملفات الرفقة المستخدمة"
              aria-valuemin={0}
              aria-valuemax={50}
              aria-valuenow={Math.min(
                50,
                Number((usedBytes / (1024 * 1024)).toFixed(1)),
              )}
            >
              <span
                style={{
                  width: `${Math.min(100, (usedBytes / pairQuotaBytes) * 100)}%`,
                }}
              />
            </div>
          </div>
          <Badge tone="muted">٥ ميبيبايت للملف</Badge>
        </div>
      )}
      <div className="view-toolbar">
        <div className="filter-tabs" role="group" aria-label="تصفية الموارد">
          {(["all", "file", "link"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === "all"
                ? "كل الموارد"
                : value === "file"
                  ? "الملفات"
                  : "الروابط"}
            </button>
          ))}
        </div>
        <label className="resource-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            aria-label="البحث في الموارد"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحثي عن مورد…"
          />
        </label>
      </div>
      <FormError error={downloadError} />
      {visible.length === 0 ? (
        <EmptyState
          title={
            query || filter !== "all"
              ? "لا توجد موارد مطابقة"
              : "كل رحلة تحتاج إلى زاد"
          }
          description={
            query || filter !== "all"
              ? "جرّبي كلمات أخرى أو اعرضي كل الموارد."
              : supervisor
                ? "شاركي تفسيرًا أو مادة نافعة ترتبط بخطة الرفقة."
                : "ستجدين هنا ما يشاركه المشرف معكما من ملفات وروابط نافعة."
          }
          action={
            supervisor &&
            !query &&
            filter === "all" &&
            !readOnly && (
              <Button variant="secondary" onClick={() => setEditing("new")}>
                مشاركة أول مورد
              </Button>
            )
          }
        />
      ) : (
        <div className="resource-grid">
          {visible.map((resource: ResourceRecord) => (
            <article className="resource-card" key={resource.id}>
              <div className="resource-top">
                <span
                  className={`resource-icon ${resource.type === "file" ? "file" : ""}`}
                >
                  {resource.type === "file" ? (
                    <FileText size={24} strokeWidth={1.5} />
                  ) : (
                    <Link2 size={24} strokeWidth={1.5} />
                  )}
                </span>
                <Badge tone={resource.type === "file" ? "gold" : "teal"}>
                  {resource.type === "link"
                    ? "رابط"
                    : resource.mime_type === "application/pdf"
                      ? "PDF"
                      : "صورة"}
                </Badge>
              </div>
              <h2>{resource.title}</h2>
              <p>
                {resource.description || "مورد خاص اختاره المشرف لهذه الرفقة."}
              </p>
              {(resource.surah_label || resource.week_start) && (
                <div className="resource-labels">
                  {resource.surah_label && (
                    <Badge tone="muted">{resource.surah_label}</Badge>
                  )}
                  {resource.week_start && (
                    <Badge tone="muted">
                      أسبوع{" "}
                      {new Intl.DateTimeFormat("ar-DZ", {
                        numberingSystem: "arab",
                        month: "short",
                        day: "numeric",
                      }).format(new Date(`${resource.week_start}T12:00:00`))}
                    </Badge>
                  )}
                </div>
              )}
              <div className="resource-meta">
                <FolderHeart size={15} />
                خاص برفقتكما<span>·</span>
                <span>
                  {resource.type === "file"
                    ? fileSize(resource.size ?? 0)
                    : new Intl.DateTimeFormat("ar-DZ", {
                        numberingSystem: "arab",
                        dateStyle: "medium",
                      }).format(new Date(resource.created_at))}
                </span>
              </div>
              <div className="resource-actions">
                {resource.type === "link" && resource.url ? (
                  <a
                    className="safe-link"
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    فتح المورد
                    <ExternalLink size={15} />
                  </a>
                ) : (
                  <Button
                    variant="ghost"
                    disabled={downloading === resource.id}
                    onClick={() => void download(resource)}
                  >
                    <Download size={16} />
                    {downloading === resource.id
                      ? "جارٍ التجهيز…"
                      : "تنزيل الملف"}
                  </Button>
                )}
                {supervisor && !readOnly && (
                  <div className="resource-controls">
                    <Button
                      variant="ghost"
                      aria-label={`تعديل ${resource.title}`}
                      onClick={() => setEditing(resource)}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`سحب ${resource.title}`}
                      onClick={() => {
                        setWithdrawing(resource);
                        setError("");
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="aux-hint" style={{ marginTop: "1.25rem" }}>
        <LockKeyhole size={14} aria-hidden="true" /> الموارد خاصة بالرفقة. يُتحقّق
        من صلاحية الوصول عند كل تنزيل، ولا تُعرض الملفات داخل الموقع.
        {demo ? " الملفات التجريبية محفوظة على هذا الجهاز فقط." : ""}
      </p>
      {editing && (
        <ResourceForm
          resource={editing === "new" ? undefined : editing}
          pairId={currentPair.id}
          usedBytes={usedBytes}
          onSave={saveResource}
          onClose={() => setEditing(null)}
        />
      )}
      {withdrawing && (
        <Modal
          title="سحب المورد من الرفقة"
          onClose={() => setWithdrawing(null)}
        >
          <p>هل تريدين سحب «{withdrawing.title}»؟</p>
          <p className="withdraw-warning">
            لن يظهر المورد للرفيقين ولن تتاح له تنزيلات جديدة. النسخ التي نُزّلت
            سابقًا تبقى لدى أصحابها. سحب المورد لا يفرّغ مساحته المخزّنة تلقائيًا.
          </p>
          <FormError error={error} />
          <div className="aux-form-footer">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setWithdrawing(null)}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void submit(
                  () => withdrawResource(withdrawing.id),
                  () => setWithdrawing(null),
                )
              }
            >
              {busy ? "جارٍ السحب…" : "سحب المورد"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
