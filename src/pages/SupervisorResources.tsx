import { useId } from "react";
import { FileText, FolderOpen, Link2, LockKeyhole, Users } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Badge, Button, EmptyState } from "../components/ui";
import { initials, number } from "../components/presentation";
import type { SupervisedWorkspace } from "../lib/types";
import "./SupervisorResources.css";

const statuses = {
  active: "نشطة",
  pending: "بانتظار الرفيقين",
  archived: "مؤرشفة",
} as const;

function TeamResourcesCard({
  workspace,
  onOpen,
}: {
  workspace: SupervisedWorkspace;
  onOpen: () => void;
}) {
  const titleId = useId();
  const { pair } = workspace;
  const readOnly =
    pair.status !== "active" ||
    pair.frozen ||
    pair.members.some((member) => !member.enabled);
  const published = workspace.resources
    .filter(
      (resource) =>
        resource.pair_id === pair.id && resource.status === "published",
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const files = published.filter((resource) => resource.type === "file").length;
  return (
    <article
      className="panel supervisor-resources-card"
      aria-labelledby={titleId}
    >
      <div className="supervisor-resources-card-heading">
        <h2 id={titleId}>{pair.name}</h2>
        <Badge
          tone={
            pair.status === "active" && !pair.frozen
              ? "teal"
              : pair.status === "pending" || pair.frozen
                ? "gold"
                : "muted"
          }
        >
          {pair.frozen && pair.status === "active"
            ? "الكتابة موقوفة"
            : statuses[pair.status]}
        </Badge>
      </div>
      <div className="supervisor-resources-members">
        {pair.members.length ? (
          pair.members.map((member) => (
            <span className="supervisor-resource-member" key={member.id}>
              <span className="avatar" aria-hidden="true">
                {initials(member.display_name)}
              </span>
              <span>{member.display_name}</span>
            </span>
          ))
        ) : (
          <p>لم يكتمل انضمام الرفيقين بعد.</p>
        )}
      </div>
      {readOnly && (
        <p className="supervisor-resources-readonly">
          <LockKeyhole size={15} />
          {pair.status === "pending"
            ? "تتاح مشاركة الموارد بعد تفعيل الرفقة."
            : pair.status === "archived"
              ? "موارد الرفقة المؤرشفة متاحة للقراءة فقط."
              : "توقّفت إضافة الموارد وتعديلها مؤقتًا لهذه الرفقة."}
        </p>
      )}
      <div className="supervisor-resources-counts">
        <span>
          <FolderOpen size={17} />
          <strong>{number(published.length)}</strong>موارد منشورة
        </span>
        <span>
          {number(files)} ملفات · {number(published.length - files)} روابط
        </span>
      </div>
      {published.length ? (
        <ul
          className="supervisor-resources-preview"
          aria-label={`موارد ${pair.name}`}
        >
          {published.slice(0, 3).map((resource) => (
            <li key={resource.id}>
              <span
                className={`supervisor-resource-type ${resource.type === "file" ? "file" : ""}`}
                aria-hidden="true"
              >
                {resource.type === "file" ? (
                  <FileText size={18} />
                ) : (
                  <Link2 size={18} />
                )}
              </span>
              <strong>{resource.title}</strong>
              <span className="supervisor-resource-kind">
                {resource.type === "file" ? "ملف" : "رابط"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="supervisor-resources-empty">
          {pair.status === "pending"
            ? "ستظهر هنا موارد الرفقة بعد تفعيلها ومشاركة أول مورد."
            : "لم تُنشر موارد لهذه الرفقة بعد."}
        </p>
      )}
      {published.length > 3 && (
        <p className="supervisor-resources-more">
          وموارد أخرى داخل مساحة الرفقة.
        </p>
      )}
      <div className="supervisor-resources-card-footer">
        <Button
          variant="secondary"
          onClick={onOpen}
          aria-label={`إدارة موارد ${pair.name}`}
        >
          {readOnly ? "عرض موارد الرفقة" : "إدارة موارد الرفقة"}
        </Button>
      </div>
    </article>
  );
}

export default function SupervisorResources({
  onOpenTeam,
  navigate,
}: {
  onOpenTeam: (pairId: string) => void;
  navigate?: (page: string) => void;
}) {
  const { profile, supervisedWorkspaces } = useApp();
  if (!profile?.is_supervisor)
    return (
      <EmptyState
        title="هذه المساحة للمشرف"
        description="تظهر هنا موارد الرفقات التي تتولى الإشراف عليها."
      />
    );
  const workspaces = supervisedWorkspaces.filter(
    (workspace) => workspace.pair.supervisor_id === profile.id,
  );
  return (
    <div className="supervisor-resources-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">زاد كل رفقة في مكانها</p>
          <h1>الموارد</h1>
          <p>اختر رفقة للاطّلاع على مواردها أو مشاركة ما يعين الرفيقين.</p>
        </div>
        {navigate && (
          <Button variant="secondary" onClick={() => navigate("pairs")}>
            <Users size={17} />
            إدارة الرفقاء
          </Button>
        )}
      </div>
      {workspaces.length ? (
        <>
          <div className="supervisor-resources-grid">
            {workspaces.map((workspace) => (
              <TeamResourcesCard
                key={workspace.pair.id}
                workspace={workspace}
                onOpen={() => onOpenTeam(workspace.pair.id)}
              />
            ))}
          </div>
          <p className="supervisor-resources-privacy">
            <LockKeyhole size={15} />
            كل مورد خاص برفقته. افتح مساحة الرفقة لتنزيل الملفات أو إدارة
            الموارد المصرّح بها.
          </p>
        </>
      ) : (
        <div className="panel">
          <EmptyState
            title="موارد ترافق كل رفقة"
            description="أنشئ رفقة أولًا. ستجد هنا موارد كل رفقة تشرف عليها في قسم مستقل."
            action={
              navigate && (
                <Button variant="secondary" onClick={() => navigate("pairs")}>
                  إنشاء رفقة
                </Button>
              )
            }
          />
        </div>
      )}
    </div>
  );
}
