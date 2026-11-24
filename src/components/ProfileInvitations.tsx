import { useEffect, useId, useRef, useState } from "react";
import { Check, LoaderCircle, MailOpen, RefreshCw } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { InvitationAcceptance, ReceivedInvitation } from "../lib/types";
import { Badge, Button, FormError } from "./ui";
import { dateText } from "./presentation";
import "./ProfileInvitations.css";

const labels: Record<ReceivedInvitation["state"], string> = {
  pending: "بانتظار قبولك",
  accepted: "مقبولة",
  expired: "منتهية الصلاحية",
  revoked: "أُلغيَت",
  unavailable: "غير متاحة",
};

function visibleState(invitation: ReceivedInvitation) {
  return invitation.state === "pending" &&
    Date.parse(invitation.expires_at) <= Date.now()
    ? "expired"
    : invitation.state;
}

function arabicError(value: unknown, fallback: string) {
  return value instanceof Error && /[\u0600-\u06ff]/.test(value.message)
    ? value.message
    : fallback;
}

function InvitationInbox({
  listInvitations,
  acceptInvitation,
}: {
  listInvitations: () => Promise<ReceivedInvitation[]>;
  acceptInvitation: (id: string) => Promise<InvitationAcceptance>;
}) {
  const titleId = useId();
  const [invitations, setInvitations] = useState<ReceivedInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [acceptError, setAcceptError] = useState("");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<InvitationAcceptance | null>(null);
  const active = useRef(true);
  const request = useRef(0);
  const accepting = useRef(false);
  const api = useRef({ listInvitations, acceptInvitation });
  api.current = { listInvitations, acceptInvitation };

  const reload = async () => {
    const generation = ++request.current;
    setLoading(true);
    setLoadError("");
    setAcceptError("");
    try {
      const result = await api.current.listInvitations();
      if (active.current && generation === request.current)
        setInvitations(result);
    } catch {
      if (active.current && generation === request.current) {
        setInvitations([]);
        setLoadError("تعذّر تحميل دعواتك. حاولي مجددًا.");
      }
    } finally {
      if (active.current && generation === request.current) setLoading(false);
    }
  };

  useEffect(() => {
    active.current = true;
    void reload();
    return () => {
      active.current = false;
      ++request.current;
    };
  }, []);

  const accept = async (invitation: ReceivedInvitation) => {
    if (accepting.current || visibleState(invitation) !== "pending") return;
    accepting.current = true;
    setAcceptingId(invitation.id);
    setAcceptError("");
    setAccepted(null);
    try {
      const result = await api.current.acceptInvitation(invitation.id);
      if (!active.current) return;
      setAccepted(result);
      await reload();
    } catch (error) {
      if (active.current)
        setAcceptError(
          arabicError(error, "تعذّر قبول الدعوة. حدّثي القائمة وحاولي مجددًا."),
        );
    } finally {
      if (active.current) {
        accepting.current = false;
        setAcceptingId(null);
      }
    }
  };

  const pending = invitations.filter(
    (item) => visibleState(item) === "pending",
  );
  const history = invitations.filter(
    (item) => visibleState(item) !== "pending",
  );
  const invitationList = (items: ReceivedInvitation[]) => (
    <ul className="profile-invitation-list">
      {items.map((invitation) => {
        const state = visibleState(invitation);
        return (
          <li className="profile-invitation" key={invitation.id}>
            <div className="profile-invitation-details">
              <div className="profile-invitation-heading">
                <strong>دعوة من {invitation.supervisor_name}</strong>
                <Badge
                  tone={
                    state === "pending"
                      ? "gold"
                      : state === "accepted"
                        ? "teal"
                        : "muted"
                  }
                >
                  {labels[state]}
                </Badge>
              </div>
              <dl className="profile-invitation-dates">
                <div>
                  <dt>تاريخ الدعوة</dt>
                  <dd>
                    <time dateTime={invitation.created_at}>
                      {dateText(invitation.created_at, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                  </dd>
                </div>
                {state === "accepted" && invitation.accepted_at ? (
                  <div>
                    <dt>تاريخ القبول</dt>
                    <dd>
                      <time dateTime={invitation.accepted_at}>
                        {dateText(invitation.accepted_at, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </time>
                    </dd>
                  </div>
                ) : (
                  <div>
                    <dt>صالحة حتى</dt>
                    <dd>
                      <time dateTime={invitation.expires_at}>
                        {dateText(invitation.expires_at, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </time>
                    </dd>
                  </div>
                )}
              </dl>
              {state === "expired" && (
                <p className="profile-invitation-hint">
                  اطلبي من المشرف دعوة جديدة إذا أردتِ الانضمام.
                </p>
              )}
              {state === "unavailable" && (
                <p className="profile-invitation-hint">
                  لا يمكن قبول هذه الدعوة حاليًا. تواصلي مع المشرف.
                </p>
              )}
            </div>
            {state === "pending" && (
              <Button
                disabled={!!acceptingId}
                onClick={() => void accept(invitation)}
                aria-label={`قبول دعوة ${invitation.supervisor_name}`}
              >
                {acceptingId === invitation.id ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Check size={16} />
                )}
                {acceptingId === invitation.id ? "جارٍ القبول…" : "قبول الدعوة"}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="panel profile-invitations" aria-labelledby={titleId}>
      <div className="section-title">
        <div>
          <h2 id={titleId}>دعواتك</h2>
          <p>الدعوات المرسلة إلى بريد حسابك من المشرفين.</p>
        </div>
        <Button
          variant="ghost"
          disabled={loading || !!acceptingId}
          onClick={() => void reload()}
          aria-label="تحديث دعواتك"
        >
          <RefreshCw size={17} />
          تحديث
        </Button>
      </div>
      {accepted && (
        <div className="profile-invitation-success" role="status">
          <Check size={19} />
          <div>
            <p>
              {accepted.status === "active"
                ? "قُبلت الدعوة وأصبحت رفقة الحفظ نشطة. يمكنك الآن فتح مساحتك."
                : accepted.status === "archived"
                  ? "سبق قبول هذه الدعوة. الرفقة مؤرشفة ومتاحة للقراءة فقط."
                  : "قُبلت الدعوة. ننتظر قبول الرفيق الآخر لتفعيل مساحة الحفظ."}
            </p>
            {accepted.status !== "pending" && (
              <a className="safe-link" href="#dashboard">
                فتح مساحة الرفقة
              </a>
            )}
          </div>
        </div>
      )}
      <FormError error={acceptError} />
      <div aria-busy={loading}>
        {loading ? (
          <p className="profile-invitation-hint" role="status">
            جارٍ تحميل دعواتك…
          </p>
        ) : loadError ? (
          <div>
            <FormError error={loadError} />
            <Button variant="secondary" onClick={() => void reload()}>
              إعادة المحاولة
            </Button>
          </div>
        ) : invitations.length === 0 ? (
          <div className="profile-invitation-empty">
            <MailOpen size={25} aria-hidden="true" />
            <p>لا توجد دعوات لحسابك حاليًا.</p>
            <span>عندما يدعوكِ مشرف إلى رفقة، تظهر الدعوة هنا.</span>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div>
                <h3>بانتظار قبولك</h3>
                {invitationList(pending)}
              </div>
            )}
            {history.length > 0 && (
              <div className="profile-invitation-history">
                <h3>الدعوات السابقة</h3>
                {invitationList(history)}
              </div>
            )}
            <p className="profile-invitation-hint">
              تُعرض المواعيد بتوقيت الجزائر. تبقى بيانات الرفيق الآخر خاصة حتى
              تفعيل الرفقة.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export default function ProfileInvitations() {
  const { profile, listProfileInvitations, acceptProfileInvitation } = useApp();
  if (!profile?.enabled || profile.is_supervisor) return null;
  return (
    <InvitationInbox
      key={`${profile.id}:${profile.email}`}
      listInvitations={listProfileInvitations}
      acceptInvitation={acceptProfileInvitation}
    />
  );
}
