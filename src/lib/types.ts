export type Role = "member" | "supervisor" | "admin";
export type AyahRange = { surah: number; from: number; to: number };
export type Profile = {
  id: string;
  email: string;
  display_name: string;
  is_supervisor: boolean;
  is_admin: boolean;
  enabled: boolean;
  created_at: string;
};
export type Pair = {
  id: string;
  name: string;
  supervisor_id: string;
  status: "pending" | "active" | "archived";
  time_zone: string;
  created_at: string;
  members: Profile[];
  supervisor?: Profile;
  frozen?: boolean;
};
export type PairMember = {
  pair_id: string;
  slot: number;
  user_id: string | null;
  accepted_at: string | null;
};
export type Invitation = {
  id: string;
  pair_id: string;
  slot: number;
  recipient_email: string;
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  created_at?: string;
};
/** Recipient inbox metadata only; pair/seat details remain private until acceptance. */
export type ReceivedInvitation = {
  id: string;
  supervisor_name: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  state: "pending" | "accepted" | "expired" | "revoked" | "unavailable";
};
export type InvitationAcceptance = {
  pair_id: string;
  status: "pending" | "active" | "archived";
  name: string;
};
export type Target = {
  id: string;
  pair_id: string;
  week_start: string;
  owner_id: string | null;
  mode: "individual" | "shared";
  status: "confirmed" | "proposed" | "rejected" | "superseded";
  hifdh: AyahRange[];
  revision: AyahRange[];
  note: string;
  proposed_by: string;
  confirmed_by?: string | null;
  version: number;
};
export type PlanActivity = {
  state: "draft" | "planned" | "none";
  ranges: AyahRange[];
};
export type ActualActivity = {
  state: "unlogged" | "not_done" | "partial" | "completed";
  ranges: AyahRange[];
};
export type DailyEntry = {
  id: string;
  pair_id: string;
  owner_id: string;
  date: string;
  plan_hifdh: PlanActivity;
  plan_revision: PlanActivity;
  actual_hifdh: ActualActivity;
  actual_revision: ActualActivity;
  note: string;
  version: number;
  created_at: string;
  updated_at: string;
};
export type Meeting = {
  id: string;
  pair_id: string;
  type: "daily" | "weekly";
  date: string;
  scheduled_at: string;
  link: string | null;
  status: "planned" | "held" | "missed";
  note: string | null;
  updated_by: string;
  updated_at: string;
  version: number;
};
export type Resource = {
  id: string;
  pair_id: string;
  title: string;
  description: string | null;
  type: "link" | "file";
  url: string | null;
  object_key: string | null;
  size: number | null;
  mime_type: string | null;
  status: "published" | "withdrawn";
  week_start: string | null;
  surah: number | null;
  surah_label?: string | null;
  version: number;
  created_at: string;
};
export type DayInput = Pick<
  DailyEntry,
  "plan_hifdh" | "plan_revision" | "actual_hifdh" | "actual_revision" | "note"
> & { kind: "plan" | "actual"; version?: number };
export type TargetInput = {
  mode: "individual" | "shared";
  hifdh: AyahRange[];
  revision: AyahRange[];
  note: string;
  id?: string;
  version?: number;
};
export type MeetingInput = Omit<
  Meeting,
  "id" | "updated_by" | "updated_at" | "version"
> & { id?: string; version?: number };
export type ResourceInput = {
  id?: string;
  pair_id: string;
  type: "link" | "file";
  title: string;
  description: string | null;
  url: string | null;
  week_start: string | null;
  surah_label: string | null;
  version?: number;
};
