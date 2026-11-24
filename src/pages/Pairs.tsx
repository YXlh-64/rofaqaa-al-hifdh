import { useState } from "react";
import {
  Archive,
  Check,
  Copy,
  Link2,
  Mail,
  Plus,
  RefreshCw,
  Users,
  X,
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
import { dateText, initials } from "../components/presentation";
import "./extras.css";

type InviteSecret = {
  slot: number;
  token: string;
  recipient_email: string;
  expires_at: string;
};
type InvitationMetadata = {
  id: string;
  pair_id: string;
  slot: number;
  recipient_email: string;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  created_at?: string;
};

function InviteLink({ invite }: { invite: InviteSecret }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const url = `${window.location.origin}${window.location.pathname}#invite=${encodeURIComponent(invite.token)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `دعوة للانضمام إلى رفقاء الحفظ. سجّل الدخول بالبريد ${invite.recipient_email} ثم افتح هذا الرابط:\n${url}`,
      );
      setCopied(true);
      setCopyError("");
    } catch {
      setCopyError("تعذّر النسخ التلقائي. يمكنك تحديد الرابط ونسخه يدويًا.");
    }
  };
  return (
    <div className="invite-result">
      <strong>دعوة الرفيق {invite.slot === 1 ? "الأول" : "الثاني"}</strong>
      <p>
        <bdi dir="ltr">{invite.recipient_email}</bdi>
      </p>
      <code>{url}</code>
      <div className="flex">
        <Button type="button" variant="secondary" onClick={() => void copy()}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "نُسخت الدعوة" : "نسخ الدعوة"}
        </Button>
        <span className="field-hint">
          صالحة حتى {dateText(invite.expires_at)}
        </span>
      </div>
      {copyError && (
        <p className="aux-hint" role="status">
          {copyError}
        </p>
      )}
    </div>
  );
}

export default function Pairs({
  navigate,
}: {
  navigate: (page: string) => void;
}) {
  const {
    pairs,
    profile,
    invitations,
    createPair,
    rotateInvite,
    revokeInvite,
    archivePair,
    setPairId,
  } = useApp();
  const [filter, setFilter] = useState<
    "all" | "pending" | "active" | "archived"
  >("all");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email1, setEmail1] = useState("");
  const [email2, setEmail2] = useState("");
  const [newLinks, setNewLinks] = useState<InviteSecret[]>([]);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<{
    pairId: string;
    slot: number;
  } | null>(null);
  const { busy, error, setError, submit } = useSubmit();
  const ownPairs = pairs.filter((p) => p.supervisor_id === profile?.id);
  const visible = ownPairs.filter(
    (p) => filter === "all" || p.status === filter,
  );
  const closeCreate = () => {
    setCreating(false);
    setError("");
  };
  const title = {
    pending: "بانتظار الرفيقين",
    active: "نشطة",
    archived: "مؤرشفة",
  };
  const latestInvite = (pairId: string, slot: number) =>
    (invitations as InvitationMetadata[])
      .filter((inv) => inv.pair_id === pairId && inv.slot === slot)
      .sort((a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? ""),
      )[0];
  return (
    <div className="pairs-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">صحبة تختار الطريق معًا</p>
          <h1>الرفقاء</h1>
          <p className="page-intro">
            أنشئ مساحة لرفيقين اختارا الحفظ معًا، وتابع خطوتهما.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreating(true);
            setError("");
            setName("");
            setEmail1("");
            setEmail2("");
          }}
        >
          <Plus size={18} />
          إنشاء رفقة
        </Button>
      </div>
      <div className="view-toolbar">
        <div className="filter-tabs" role="group" aria-label="تصفية الرفقاء">
          {(["all", "active", "pending", "archived"] as const).map((value) => (
            <button
              type="button"
              aria-pressed={filter === value}
              key={value}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "كل الرفقاء" : title[value]}
            </button>
          ))}
        </div>
        <span className="aux-hint">لكل رفقة شخصان، ولكل شخص خطوته.</span>
      </div>
      <FormError error={creating || archiveId || revoking ? "" : error} />
      {visible.length === 0 ? (
        <EmptyState
          title={
            ownPairs.length ? "لا توجد رفقة بهذه الحالة" : "أول رفقة تبدأ بدعوة"
          }
          description="أرسل لكل رفيق دعوة خاصة ببريده. تُفعّل المساحة بعد قبول الاثنين."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setCreating(true);
                setError("");
              }}
            >
              إنشاء رفقة جديدة
            </Button>
          }
        />
      ) : (
        <div className="supervisor-pairs">
          {visible.map((pair) => (
            <article className="panel pair-card" key={pair.id}>
              <div className="pair-title">
                <h2>{pair.name}</h2>
                <Badge
                  tone={
                    pair.status === "active"
                      ? "teal"
                      : pair.status === "pending"
                        ? "gold"
                        : "muted"
                  }
                >
                  {title[pair.status]}
                </Badge>
              </div>
              {pair.status === "pending" ? (
                <div className="pair-seats">
                  {[1, 2].map((slot) => {
                    const invitation = latestInvite(pair.id, slot);
                    const accepted = !!invitation?.accepted_at;
                    const revoked = !!invitation?.revoked_at;
                    const expired =
                      !!invitation &&
                      Date.parse(invitation.expires_at) <= Date.now();
                    return (
                      <div className="pair-seat" key={slot}>
                        <span className="avatar avatar-gold">
                          <Mail size={17} />
                        </span>
                        <div className="pair-seat-info">
                          <strong>
                            الرفيق {slot === 1 ? "الأول" : "الثاني"}
                          </strong>
                          {invitation && (
                            <bdi dir="ltr">{invitation.recipient_email}</bdi>
                          )}
                          <Badge tone={accepted ? "teal" : "muted"}>
                            {accepted
                              ? "قَبِل الدعوة"
                              : revoked
                                ? "أُلغيت الدعوة"
                                : expired
                                  ? "انتهت الدعوة"
                                  : "بانتظار القبول"}
                          </Badge>
                        </div>
                        {!accepted && (
                          <div className="pair-seat-actions">
                            <Button
                              variant="ghost"
                              disabled={busy}
                              aria-label={`تجديد دعوة الرفيق ${slot === 1 ? "الأول" : "الثاني"}`}
                              onClick={() =>
                                void submit(async () => {
                                  const invite = await rotateInvite(
                                    pair.id,
                                    slot,
                                  );
                                  setNewLinks([invite]);
                                })
                              }
                            >
                              <RefreshCw size={15} />
                              تجديد
                            </Button>
                            {!revoked && !expired && (
                              <Button
                                variant="ghost"
                                disabled={busy}
                                aria-label={`إلغاء دعوة الرفيق ${slot === 1 ? "الأول" : "الثاني"}`}
                                onClick={() => {
                                  setRevoking({ pairId: pair.id, slot });
                                  setError("");
                                }}
                              >
                                <X size={15} />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="pair-members-list">
                  {pair.members.map((member) => (
                    <div className="pair-card-members" key={member.id}>
                      <span className="avatar">
                        {initials(member.display_name)}
                      </span>
                      <div>
                        <p>{member.display_name}</p>
                        <small>
                          {member.enabled
                            ? "حساب مفعّل"
                            : "حساب موقوف · الرفقة مجمّدة"}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {pair.status === "pending" && (
                <p className="aux-hint">
                  قبول شخص واحد لا يفعّل المساحة. لا يمكن عرض رابط قديم؛ تجدّد
                  الدعوة لإصدار رابط جديد.
                </p>
              )}
              <div className="pair-card-footer">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPairId(pair.id);
                    navigate(
                      pair.status === "pending"
                        ? "pairs"
                        : `workspace=${encodeURIComponent(pair.id)}`,
                    );
                  }}
                >
                  <Users size={16} />
                  {pair.status === "pending"
                    ? "اختيار الرفقة"
                    : "فتح مساحة الرفقة"}
                </Button>
                {pair.status !== "archived" && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setArchiveId(pair.id);
                      setError("");
                    }}
                  >
                    <Archive size={16} />
                    أرشفة
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {creating && (
        <Modal title="إنشاء رفقة جديدة" onClose={closeCreate}>
          <form
            className="aux-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(async () => {
                const first = email1.trim().toLowerCase();
                const second = email2.trim().toLowerCase();
                if (
                  first === second ||
                  [first, second].includes(profile?.email.toLowerCase() ?? "")
                )
                  throw new Error(
                    "أدخل بريدين مختلفين للرفيقين، غير بريد المشرف.",
                  );
                const result = await createPair(name.trim(), first, second);
                setNewLinks(result.invites);
                closeCreate();
              });
            }}
          >
            <p className="aux-hint">
              للرفيقين اللذين اتفقا على الحفظ معًا. لا يحتاج حساب المشرف إلى
              موافقة إدارية.
            </p>
            <Field label="اسم الرفقة">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="مثال: رفقة النور"
                required
              />
            </Field>
            <Field label="بريد الرفيق الأول">
              <input
                type="email"
                dir="ltr"
                required
                value={email1}
                onChange={(e) => setEmail1(e.target.value)}
                placeholder="first@example.com"
              />
            </Field>
            <Field label="بريد الرفيق الثاني">
              <input
                type="email"
                dir="ltr"
                required
                value={email2}
                onChange={(e) => setEmail2(e.target.value)}
                placeholder="second@example.com"
              />
            </Field>
            <p className="aux-note">
              <Link2 size={16} /> ستظهر دعوتان خاصتان لنسخهما وإرسالهما خارج
              الموقع. كل رابط مرتبط بالبريد المحدّد وصالح لسبعة أيام.
            </p>
            <FormError error={error} />
            <div className="aux-form-footer">
              <Button
                variant="secondary"
                type="button"
                onClick={closeCreate}
                disabled={busy}
              >
                إلغاء
              </Button>
              <SaveButton busy={busy}>إنشاء الرفقة والدعوات</SaveButton>
            </div>
          </form>
        </Modal>
      )}
      {newLinks.length > 0 && (
        <Modal title="دعوات الرفقة جاهزة" onClose={() => setNewLinks([])}>
          <p className="aux-hint">
            انسخ كل دعوة وأرسلها إلى صاحب البريد المحدّد. لا يُحفظ الرابط في
            المتصفح ولن يظهر بعد إغلاق هذه النافذة. تجديد الدعوة يُبطل رابطها
            السابق.
          </p>
          {newLinks.map((invite) => (
            <InviteLink invite={invite} key={invite.slot} />
          ))}
          <div className="aux-form-footer">
            <Button onClick={() => setNewLinks([])}>تمّ، حفظت الدعوات</Button>
          </div>
        </Modal>
      )}
      {archiveId && (
        <Modal title="أرشفة الرفقة" onClose={() => setArchiveId(null)}>
          <p>
            ستبقى الخطط والإنجازات واللقاءات والموارد متاحة للمخوّلين بالقراءة،
            مع إيقاف التعديلات والدعوات الجديدة.
          </p>
          <p className="aux-hint">
            لرفيقين مختلفين، أنشئ رفقة جديدة بدل استبدال الأعضاء.
          </p>
          <FormError error={error} />
          <div className="aux-form-footer">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setArchiveId(null)}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void submit(
                  () => archivePair(archiveId),
                  () => setArchiveId(null),
                )
              }
            >
              {busy ? "جارٍ الأرشفة…" : "تأكيد الأرشفة"}
            </Button>
          </div>
        </Modal>
      )}
      {revoking && (
        <Modal title="إلغاء الدعوة" onClose={() => setRevoking(null)}>
          <p>
            سيصبح الرابط الحالي غير صالح. يمكنك تجديد الدعوة لاحقًا لإصدار رابط
            جديد للبريد نفسه.
          </p>
          <FormError error={error} />
          <div className="aux-form-footer">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setRevoking(null)}
            >
              تراجع
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void submit(
                  () => revokeInvite(revoking.pairId, revoking.slot),
                  () => setRevoking(null),
                )
              }
            >
              إلغاء الدعوة
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
