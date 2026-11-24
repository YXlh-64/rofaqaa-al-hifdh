import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, localizedError } from "../lib/supabase";
import { addDays, weekStart } from "../lib/dates";
import {
  DEMO_KEY,
  DEMO_SESSION,
  demoIds,
  emptyData,
  loadDemo,
  makeDemo,
} from "../lib/demo";
import type { DataState } from "../lib/demo";
import { clearDemoFiles, getDemoFile, putDemoFile } from "../lib/demoFiles";
import { SURAHS, validateRanges } from "../lib/surahs";
import type {
  DailyEntry,
  DayInput,
  Invitation,
  InvitationAcceptance,
  Meeting,
  MeetingInput,
  Pair,
  PairMember,
  Profile,
  ReceivedInvitation,
  Resource,
  ResourceInput,
  Role,
  Target,
  TargetInput,
} from "../lib/types";

type InviteSecret = {
  slot: number;
  token: string;
  recipient_email: string;
  expires_at: string;
};
type DemoRole = Role | "partner";
export interface AppContextValue {
  loading: boolean;
  error: string;
  profile: Profile | null;
  demo: boolean;
  isDemo: boolean;
  role: Role;
  pairs: Pair[];
  pair: Pair | null;
  currentPair: Pair | null;
  profiles: Profile[];
  invitations: Invitation[];
  targets: Target[];
  entries: DailyEntry[];
  meetings: Meeting[];
  resources: Resource[];
  accounts: Profile[];
  week: string;
  message: string;
  storageUsageBytes: number;
  setWeek: (value: string) => void;
  setPairId: (id: string) => void;
  clearMessage: () => void;
  notify: (message: string) => void;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    name: string,
    email: string,
    password: string,
    asSupervisor?: boolean,
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  startDemo: (role?: DemoRole) => void;
  switchDemoRole: (role: DemoRole) => void;
  setDemoRole: (role: DemoRole) => void;
  resetDemo: () => void;
  saveDay: (date: string, values: DayInput) => Promise<void>;
  saveTarget: (value: TargetInput) => Promise<void>;
  respondTarget: (id: string, accepted: boolean) => Promise<void>;
  saveMeeting: (value: MeetingInput) => Promise<void>;
  saveResource: (value: ResourceInput, file?: File) => Promise<void>;
  withdrawResource: (id: string) => Promise<void>;
  downloadResource: (resource: Pick<Resource, "id">) => Promise<string>;
  createPair: (
    name: string,
    email1: string,
    email2: string,
  ) => Promise<{ pair: Pair; invites: InviteSecret[] }>;
  rotateInvite: (pairId: string, slot: number) => Promise<InviteSecret>;
  revokeInvite: (pairId: string, slot: number) => Promise<void>;
  archivePair: (id: string) => Promise<void>;
  acceptInvite: (token: string) => Promise<void>;
  listProfileInvitations: () => Promise<ReceivedInvitation[]>;
  acceptProfileInvitation: (id: string) => Promise<InvitationAcceptance>;
  searchAccounts: (search?: string) => Promise<Profile[]>;
  setAccountEnabled: (
    id: string,
    enabled: boolean,
    reason?: string,
  ) => Promise<void>;
  setAccountStatus: (
    id: string,
    enabled: boolean,
    reason?: string,
  ) => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
}
const Context = createContext<AppContextValue | null>(null);
const stamp = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
export type ResourceUploadAttempt = {
  key: string;
  attempted: boolean;
  uploaded: boolean;
  pending?: Promise<Resource>;
};
type UploadOperations = {
  upload: (key: string, file: File) => Promise<{ error: unknown }>;
  publish: (key: string) => Promise<Resource>;
  find: (key: string) => Promise<{ data: Resource | null; error: unknown }>;
  remove: (key: string) => Promise<{ error: unknown }>;
};
function isKnownDuplicate(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const detail = error as {
    statusCode?: string | number;
    status?: number;
    code?: string;
    error?: string;
  };
  return (
    String(detail.statusCode ?? detail.status) === "409" ||
    detail.code === "Duplicate" ||
    detail.error === "Duplicate"
  );
}
// One attempt belongs to one selected File and one actor/pair. Its key survives
// ambiguous network responses, and concurrent form submits share the same work.
export async function finalizeResourceUpload(
  attempt: ResourceUploadAttempt,
  file: File,
  operations: UploadOperations,
): Promise<Resource> {
  if (attempt.pending) return attempt.pending;
  const pending = (async () => {
    if (!attempt.uploaded) {
      const retrying = attempt.attempted;
      attempt.attempted = true;
      const { error } = await operations.upload(attempt.key, file);
      if (error && !(retrying && isKnownDuplicate(error)))
        throw localizedError(error);
      attempt.uploaded = true;
    }
    try {
      return await operations.publish(attempt.key);
    } catch (publishError) {
      // A lost response can follow a successful commit. Never remove an object
      // whose publication is visible, or when the follow-up read is uncertain.
      const existing = await operations
        .find(attempt.key)
        .catch(() => ({ data: null, error: true }));
      if (!existing.error && existing.data) return existing.data;
      if (!existing.error) {
        const cleanup = await operations
          .remove(attempt.key)
          .catch(() => ({ error: true }));
        if (!cleanup.error) attempt.uploaded = false;
      }
      throw publishError;
    }
  })();
  attempt.pending = pending;
  try {
    return await pending;
  } finally {
    if (attempt.pending === pending) attempt.pending = undefined;
  }
}
const demoId = (role: DemoRole) =>
  role === "partner" ? "demo-maryam" : demoIds[role];
function ensureHttps(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password)
      return;
  } catch {
    /* localized below */
  }
  throw new Error("أدخل رابطًا صالحًا يبدأ بـ https://.");
}
async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw localizedError(error);
  if (data && typeof data === "object" && "error" in data)
    throw localizedError({ message: String(data.error) });
  return data as T;
}
async function read<T>(table: string, columns = "*"): Promise<T[]> {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw localizedError(error);
  return (data ?? []) as T[];
}

export function AppProvider({ children }: { children: ReactNode }) {
  const initialDemo =
    import.meta.env.MODE === "test" && !!sessionStorage.getItem(DEMO_SESSION);
  const [demo, setDemo] = useState(initialDemo);
  const [demoRole, updateDemoRole] = useState<DemoRole>(
    (sessionStorage.getItem(DEMO_SESSION) as DemoRole) || "member",
  );
  const [state, setState] = useState<DataState>(() =>
    initialDemo ? loadDemo() : emptyData(),
  );
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!initialDemo);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pairId, setPairId] = useState("");
  const [liveStorageUsage, setLiveStorageUsage] = useState<
    Record<string, number>
  >({});
  const [week, setWeek] = useState(weekStart());
  const sessionRef = useRef(0);
  const authenticatedActorRef = useRef<string | null>(null);
  const objectUrls = useRef<string[]>([]);
  const fileUploads = useRef(
    new WeakMap<File, Map<string, ResourceUploadAttempt>>(),
  );
  const profile =
    state.profiles.find((p) => p.id === (demo ? demoId(demoRole) : user?.id)) ??
    null;
  const authorizedPairs = profile?.enabled
    ? state.pairs.filter(
        (p) =>
          p.supervisor_id === profile.id ||
          (p.status !== "pending" &&
            p.members.some((m) => m.id === profile.id)),
      )
    : [];
  const pairs = authorizedPairs.map((p) => ({
    ...p,
    members: p.members.map(
      (m) => state.profiles.find((v) => v.id === m.id) ?? m,
    ),
    supervisor:
      state.profiles.find((v) => v.id === p.supervisor_id) ?? p.supervisor,
    frozen: [
      ...p.members,
      state.profiles.find((v) => v.id === p.supervisor_id),
    ].some(
      (v) => v && !(state.profiles.find((p) => p.id === v.id) ?? v).enabled,
    ),
  }));
  const pair = pairs.find((p) => p.id === pairId) ?? pairs[0] ?? null;
  const role: Role = pair?.members.some((p) => p.id === profile?.id)
    ? "member"
    : profile?.is_supervisor
      ? "supervisor"
      : profile?.is_admin
        ? "admin"
        : "member";
  const writable = (p = pair) => {
    if (!profile?.enabled || !p || p.status !== "active" || p.frozen)
      throw new Error(
        "هذه الرفقة للقراءة فقط حاليًا. تحقّق من حالة الرفقة والحسابات.",
      );
  };
  const requireMember = () => {
    writable();
    if (role !== "member")
      throw new Error("هذه العملية متاحة لصاحب السجل فقط.");
  };
  const requireSupervisor = (p = pair) => {
    if (!profile?.enabled || !p || p.supervisor_id !== profile.id)
      throw new Error("هذه العملية متاحة للمشرف المكلّف فقط.");
  };
  const mutate = (change: (draft: DataState) => DataState) => {
    setState((current) => {
      const next = change(current);
      localStorage.setItem(DEMO_KEY, JSON.stringify(next));
      return next;
    });
  };
  const notify = (text: string) => setMessage(text);

  const loadLive = async (currentUser: User) => {
    const generation = ++sessionRef.current;
    try {
      const { data: own, error: ownError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (ownError) throw localizedError(ownError);
      if (!own)
        throw new Error(
          "تعذّر الوصول إلى حسابك. قد يكون الحساب موقوفًا أو لم تكتمل تهيئته بعد. تواصل مع مشرف التجربة أو أعد المحاولة.",
        );
      if (!own.enabled) {
        if (generation === sessionRef.current)
          setState({ ...emptyData(), profiles: [own] });
        return;
      }
      const values = await Promise.all([
        read<Profile>("profiles"),
        read<Omit<Pair, "members">>("pairs"),
        read<PairMember>("pair_members"),
        read<Target>("weekly_targets"),
        read<DailyEntry>("daily_entries"),
        read<Meeting>("meetings"),
        read<Resource>("resources"),
        read<Invitation>(
          "invitations",
          "id,pair_id,slot,recipient_email,expires_at,accepted_at,revoked_at,created_at",
        ),
      ]);
      const [
        profiles,
        rawPairs,
        memberships,
        targets,
        entries,
        meetings,
        resources,
        invitations,
      ] = values;
      const pairs: Pair[] = rawPairs.map((p) => ({
        ...p,
        members: memberships
          .filter((m) => m.pair_id === p.id && m.user_id)
          .map((m) => profiles.find((v) => v.id === m.user_id))
          .filter((v): v is Profile => !!v),
        supervisor: profiles.find((v) => v.id === p.supervisor_id),
      }));
      const usageResults = await Promise.all(
        pairs
          .filter((p) => p.supervisor_id === currentUser.id)
          .map(
            async (p) =>
              [
                p.id,
                Number(
                  await rpc<number>("resource_storage_usage", {
                    p_pair_id: p.id,
                  }),
                ),
              ] as const,
          ),
      );
      if (generation === sessionRef.current) {
        setLiveStorageUsage(Object.fromEntries(usageResults));
        setState({
          profiles,
          pairs,
          targets,
          entries,
          meetings,
          resources: resources.map((r) => ({
            ...r,
            surah_label: r.surah
              ? `سورة ${SURAHS[r.surah - 1]?.name ?? ""}`
              : null,
          })),
          invitations,
        });
        setError("");
      }
    } catch (caught) {
      if (generation === sessionRef.current) {
        setState(emptyData());
        setError(localizedError(caught).message);
      }
    } finally {
      if (generation === sessionRef.current) setLoading(false);
    }
  };
  const refresh = async () => {
    if (demo) {
      setState(loadDemo());
      setError("");
      return;
    }
    if (user) await loadLive(user);
  };
  useEffect(() => {
    if (demo) {
      setLoading(false);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setError(localizedError(error).message);
        setLoading(false);
        return;
      }
      authenticatedActorRef.current = data.session?.user.id ?? null;
      setUser(data.session?.user ?? null);
      if (data.session?.user) void loadLive(data.session.user);
      else setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;
        if (event === "PASSWORD_RECOVERY")
          sessionStorage.setItem("rofaqa-recovery", "true");
        const nextActor = session?.user.id ?? null;
        if (authenticatedActorRef.current !== nextActor) ++sessionRef.current;
        authenticatedActorRef.current = nextActor;
        setUser(session?.user ?? null);
        if (session?.user)
          setTimeout(() => {
            if (active) void loadLive(session.user);
          }, 0);
        else {
          ++sessionRef.current;
          setState(emptyData());
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [demo]);
  useEffect(() => {
    if (demo || !user) return;
    const sync = () => {
      if (document.visibilityState === "visible") void loadLive(user);
    };
    window.addEventListener("focus", sync);
    const timer = setInterval(sync, 30000);
    return () => {
      window.removeEventListener("focus", sync);
      clearInterval(timer);
    };
  }, [demo, user?.id]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5500);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(
    () => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );

  const startDemo = (nextRole: DemoRole = "member") => {
    if (import.meta.env.MODE !== "test") return;
    ++sessionRef.current;
    sessionStorage.setItem(DEMO_SESSION, nextRole);
    updateDemoRole(nextRole);
    setState(loadDemo());
    setPairId("");
    setDemo(true);
    setLoading(false);
    setError("");
    setWeek(weekStart());
  };
  const switchDemoRole = (nextRole: DemoRole) => {
    if (import.meta.env.MODE !== "test" || !demo) return;
    sessionStorage.setItem(DEMO_SESSION, nextRole);
    updateDemoRole(nextRole);
    setPairId("");
    setError("");
    setMessage("");
  };
  const resetDemo = () => {
    if (import.meta.env.MODE !== "test" || !demo) return;
    const initial = makeDemo();
    localStorage.setItem(DEMO_KEY, JSON.stringify(initial));
    setState(initial);
    setPairId("");
    setWeek(weekStart());
    void clearDemoFiles().catch((e) => setError(localizedError(e).message));
    notify("أُعيدت تهيئة البيانات التجريبية.");
  };
  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw localizedError(error);
  };
  const signup = async (
    name: string,
    email: string,
    password: string,
    asSupervisor = true,
  ) => {
    if (!name.trim()) throw new Error("أدخل اسمك الكامل.");
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${location.origin}${location.pathname}`,
        data: { display_name: name.trim(), is_supervisor: asSupervisor },
      },
    });
    if (error) throw localizedError(error);
  };
  const logout = async () => {
    ++sessionRef.current;
    authenticatedActorRef.current = null;
    sessionStorage.removeItem(DEMO_SESSION);
    setDemo(false);
    setUser(null);
    setState(emptyData());
    setError("");
    setPairId("");
    setMessage("");
    if (!demo) {
      const { error } = await supabase.auth.signOut();
      if (error) setError(localizedError(error).message);
    }
  };
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}${location.pathname}`,
    });
    if (error) throw localizedError(error);
  };
  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw localizedError(error);
    sessionStorage.removeItem("rofaqa-recovery");
    if (location.hash.includes("type=recovery"))
      history.replaceState(null, "", location.pathname);
  };

  const saveDay = async (date: string, values: DayInput) => {
    requireMember();
    const kind = values.kind ?? "actual";
    const activities =
      kind === "plan"
        ? [values.plan_hifdh, values.plan_revision]
        : [values.actual_hifdh, values.actual_revision];
    activities.forEach((a) => {
      validateRanges(a.ranges);
      if (
        ["planned", "partial", "completed"].includes(a.state) &&
        !a.ranges.length
      )
        throw new Error("أضف نطاق الآيات المنجزة أو المخطّطة.");
    });
    const existing = state.entries.find(
      (e) =>
        e.pair_id === pair!.id && e.owner_id === profile!.id && e.date === date,
    );
    if (demo) {
      if (existing && values.version !== existing.version)
        throw new Error("تغيّر السجل منذ فتحه. أعد فتح النموذج للمحاولة مجددًا.");
      const updated: DailyEntry = {
        ...(existing ?? {
          id: uuid(),
          pair_id: pair!.id,
          owner_id: profile!.id,
          date,
          plan_hifdh: { state: "draft", ranges: [] },
          plan_revision: { state: "draft", ranges: [] },
          actual_hifdh: { state: "unlogged", ranges: [] },
          actual_revision: { state: "unlogged", ranges: [] },
          created_at: stamp(),
        }),
        ...(kind === "plan"
          ? {
              plan_hifdh: values.plan_hifdh,
              plan_revision: values.plan_revision,
            }
          : {
              actual_hifdh: values.actual_hifdh,
              actual_revision: values.actual_revision,
            }),
        note: values.note,
        updated_at: stamp(),
        version: (existing?.version ?? 0) + 1,
      };
      mutate((s) => ({
        ...s,
        entries: [...s.entries.filter((e) => e.id !== updated.id), updated],
      }));
    } else {
      await rpc("save_daily_entry", {
        p_pair_id: pair!.id,
        p_date: date,
        p_kind: kind,
        p_hifdh: activities[0],
        p_revision: activities[1],
        p_note: values.note,
        p_expected_version: values.version ?? null,
      });
      await refresh();
    }
    notify(
      kind === "plan" ? "حُفظت خطة اليوم." : "حُفظ إنجازك، بارك الله في خطاك.",
    );
  };
  const saveTarget = async (value: TargetInput) => {
    requireMember();
    validateRanges(value.hifdh);
    validateRanges(value.revision);
    if (!value.hifdh.length && !value.revision.length)
      throw new Error("أضف هدفًا للحفظ أو المراجعة.");
    const existing = state.targets.find(
      (t) =>
        t.pair_id === pair!.id &&
        t.week_start === week &&
        t.mode === value.mode &&
        (value.mode === "shared"
          ? t.status === "proposed"
          : t.owner_id === profile!.id && t.status === "confirmed"),
    );
    if (
      value.id &&
      (existing?.id !== value.id || existing.version !== value.version)
    )
      throw new Error("تغيّر الهدف منذ فتح النموذج. أعد فتحه للمحاولة مجددًا.");
    if (demo) {
      const hasActuals = state.entries.some(
        (e) =>
          e.pair_id === pair!.id &&
          e.date >= week &&
          e.date < addDays(week, 7) &&
          (e.actual_hifdh.state !== "unlogged" ||
            e.actual_revision.state !== "unlogged"),
      );
      const confirmed = state.targets.some(
        (t) =>
          t.pair_id === pair!.id &&
          t.week_start === week &&
          t.status === "confirmed" &&
          (t.mode === "shared" || t.owner_id === profile!.id),
      );
      if (hasActuals && (existing || confirmed))
        throw new Error(
          "لا يمكن استبدال الهدف بعد تسجيل الإنجاز. يبقى الهدف الأصلي محفوظًا.",
        );
      if (
        value.mode === "individual" &&
        state.targets.some(
          (t) =>
            t.pair_id === pair!.id &&
            t.week_start === week &&
            t.mode === "shared" &&
            t.status === "confirmed",
        )
      )
        throw new Error(
          "يوجد هدف مشترك مؤكّد لهذا الأسبوع. اقترح هدفًا مشتركًا جديدًا لتغييره.",
        );
      if (
        value.mode === "shared" &&
        existing &&
        existing.proposed_by !== profile!.id
      )
        throw new Error("يوجد اقتراح ينتظر ردّك. وافق عليه أو ارفضه أولًا.");
      const target: Target = {
        id: existing?.id ?? uuid(),
        pair_id: pair!.id,
        week_start: week,
        owner_id: value.mode === "shared" ? null : profile!.id,
        mode: value.mode,
        status: value.mode === "shared" ? "proposed" : "confirmed",
        hifdh: value.hifdh,
        revision: value.revision,
        note: value.note,
        proposed_by: profile!.id,
        version: (existing?.version ?? 0) + 1,
      };
      mutate((s) => ({
        ...s,
        targets: [...s.targets.filter((t) => t.id !== target.id), target],
      }));
    } else {
      await rpc("save_weekly_target", {
        p_pair_id: pair!.id,
        p_week_start: week,
        p_hifdh: value.hifdh,
        p_revision: value.revision,
        p_shared: value.mode === "shared",
        p_note: value.note,
        p_id: existing?.id ?? null,
        p_expected_version: value.version ?? existing?.version ?? null,
      });
      await refresh();
    }
    notify(
      value.mode === "shared"
        ? "أُرسل الاقتراح؛ يصبح نافذًا بعد موافقة رفيقك."
        : "حُفظ هدف الأسبوع.",
    );
  };
  const respondTarget = async (id: string, accepted: boolean) => {
    requireMember();
    const target = state.targets.find(
      (t) => t.id === id && t.pair_id === pair!.id,
    );
    if (
      !target ||
      target.status !== "proposed" ||
      target.proposed_by === profile!.id
    )
      throw new Error("لا يمكن الموافقة على هذا الاقتراح بهذا الحساب.");
    if (demo) {
      if (
        accepted &&
        state.entries.some(
          (e) =>
            e.pair_id === pair!.id &&
            e.date >= target.week_start &&
            e.date < addDays(target.week_start, 7) &&
            (e.actual_hifdh.state !== "unlogged" ||
              e.actual_revision.state !== "unlogged"),
        )
      )
        throw new Error("لا يمكن تغيير الهدف بعد تسجيل الإنجاز.");
      mutate((s) => ({
        ...s,
        targets: s.targets.map((t) =>
          t.id === id
            ? {
                ...t,
                status: accepted ? "confirmed" : "rejected",
                confirmed_by: accepted ? profile!.id : null,
                version: t.version + 1,
              }
            : accepted &&
                t.pair_id === pair!.id &&
                t.week_start === target.week_start &&
                t.mode === "shared" &&
                t.status === "confirmed"
              ? { ...t, status: "superseded" }
              : t,
        ),
      }));
    } else {
      await rpc("respond_shared_target", {
        p_id: id,
        p_accept: accepted,
        p_expected_version: target.version,
      });
      await refresh();
    }
    notify(
      accepted
        ? "اتّفقتما على الهدف المشترك."
        : "حُفظ قرارك، وأهدافكما الحالية مستمرة.",
    );
  };
  const saveMeeting = async (value: MeetingInput) => {
    writable();
    if (value.pair_id !== pair!.id)
      throw new Error("هذا اللقاء لا ينتمي إلى الرفقة الحالية.");
    if ((value.type === "weekly") !== (pair!.supervisor_id === profile!.id))
      throw new Error(
        "يمكن للأعضاء تعديل اللقاء اليومي، وللمشرف تعديل اللقاء الأسبوعي.",
      );
    if (value.link) ensureHttps(value.link);
    if (demo) {
      const existing = value.id
        ? state.meetings.find(
            (m) => m.id === value.id && m.pair_id === pair!.id,
          )
        : undefined;
      if (value.id && (!existing || existing.version !== value.version))
        throw new Error("تغيّر اللقاء منذ فتحه. أعد فتح النموذج.");
      if (
        state.meetings.some(
          (m) =>
            m.id !== value.id &&
            m.pair_id === pair!.id &&
            m.type === value.type &&
            (value.type === "daily"
              ? m.date === value.date
              : weekStart(m.date) === weekStart(value.date)),
        )
      )
        throw new Error("يوجد لقاء لهذا اليوم أو الأسبوع. عدّل اللقاء الموجود.");
      const updated: Meeting = {
        ...value,
        id: existing?.id ?? uuid(),
        updated_by: profile!.id,
        updated_at: stamp(),
        version: (existing?.version ?? 0) + 1,
      };
      mutate((s) => ({
        ...s,
        meetings: [...s.meetings.filter((m) => m.id !== updated.id), updated],
      }));
    } else {
      await rpc("save_meeting", {
        p_pair_id: pair!.id,
        p_type: value.type,
        p_date: value.date,
        p_scheduled_at: value.scheduled_at,
        p_link: value.link ?? "",
        p_status: value.status,
        p_note: value.note ?? "",
        p_id: value.id ?? null,
        p_expected_version: value.version ?? null,
      });
      await refresh();
    }
    notify("حُفظ اللقاء.");
  };
  const saveResource = async (value: ResourceInput, file?: File) => {
    requireSupervisor();
    writable();
    if (value.pair_id !== pair!.id)
      throw new Error("هذا المورد لا ينتمي إلى الرفقة الحالية.");
    if (!value.title.trim()) throw new Error("أدخل عنوانًا للمورد.");
    if (value.type === "link") ensureHttps(value.url ?? "");
    const old = value.id
      ? state.resources.find((r) => r.id === value.id && r.pair_id === pair!.id)
      : undefined;
    if (value.id && !old) throw new Error("المورد غير متاح.");
    const surah = value.surah_label
      ? (SURAHS.find((s) =>
          [s.name, `سورة ${s.name}`].includes(value.surah_label!.trim()),
        )?.id ?? null)
      : null;
    if (value.surah_label && !surah)
      throw new Error("اختر اسم سورة صحيحًا من قائمة السور.");
    if (!old && value.type === "file") {
      if (
        !file ||
        !["application/pdf", "image/png", "image/jpeg"].includes(file.type) ||
        !file.size ||
        file.size > 5 * 1024 * 1024
      )
        throw new Error("اختر ملف PDF أو PNG أو JPEG حتى ٥ ميبيبايت.");
      const used = demo
        ? state.resources
            .filter((r) => r.pair_id === pair!.id)
            .reduce((n, r) => n + (r.size ?? 0), 0)
        : (liveStorageUsage[pair!.id] ?? 0);
      const retrying = fileUploads.current
        .get(file)
        ?.has(`${profile!.id}:${pair!.id}`);
      if (!retrying && used + file.size > 50 * 1024 * 1024)
        throw new Error("مساحة الملفات ممتلئة. لا تزال مشاركة الروابط متاحة.");
    }
    if (demo) {
      if (old && old.version !== value.version)
        throw new Error("تغيّر المورد منذ فتحه. أعد فتح النموذج.");
      const key =
        old?.object_key ?? (file ? `${pair!.id}/${uuid()}/${file.name}` : null);
      if (file && key) await putDemoFile(key, file);
      const resource: Resource = old
        ? {
            ...old,
            title: value.title,
            description: value.description,
            version: old.version + 1,
          }
        : {
            ...value,
            id: uuid(),
            object_key: key,
            mime_type: file?.type ?? null,
            size: file?.size ?? null,
            surah,
            status: "published",
            version: 1,
            created_at: stamp(),
          };
      mutate((s) => ({
        ...s,
        resources: [
          ...s.resources.filter((r) => r.id !== resource.id),
          resource,
        ],
      }));
    } else if (old) {
      await rpc("update_resource", {
        p_id: old.id,
        p_title: value.title,
        p_description: value.description ?? "",
        p_withdraw: false,
        p_expected_version: value.version ?? old.version,
      });
      await refresh();
    } else {
      const publish = (key: string | null) =>
        rpc<Resource>("publish_resource", {
          p_pair_id: pair!.id,
          p_title: value.title,
          p_description: value.description ?? "",
          p_url: value.type === "link" ? value.url : null,
          p_object_key: key,
          p_week_start: value.week_start,
          p_surah: surah,
        });
      if (file) {
        const scope = `${profile!.id}:${pair!.id}`;
        let attempts = fileUploads.current.get(file);
        if (!attempts) {
          attempts = new Map();
          fileUploads.current.set(file, attempts);
        }
        let attempt = attempts.get(scope);
        if (!attempt) {
          attempt = {
            key: `${pair!.id}/${uuid()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
            attempted: false,
            uploaded: false,
          };
          attempts.set(scope, attempt);
        }
        await finalizeResourceUpload(attempt, file, {
          upload: async (key, selected) => {
            const { error } = await supabase.storage
              .from("pair-resources")
              .upload(key, selected, {
                contentType: selected.type,
                cacheControl: "0",
                upsert: false,
              });
            return { error };
          },
          publish,
          find: async (key) => {
            const { data, error } = await supabase
              .from("resources")
              .select("*")
              .eq("object_key", key)
              .maybeSingle();
            return { data: data as Resource | null, error };
          },
          remove: async (key) => {
            const { error } = await supabase.storage
              .from("pair-resources")
              .remove([key]);
            return { error };
          },
        });
      } else await publish(null);
      await refresh();
    }
    notify("حُفظ المورد الخاص بالرفقة.");
  };
  const withdrawResource = async (id: string) => {
    requireSupervisor();
    writable();
    const resource = state.resources.find(
      (r) => r.id === id && r.pair_id === pair!.id,
    );
    if (!resource) throw new Error("المورد غير متاح.");
    let cleanupPending = false;
    if (demo)
      mutate((s) => ({
        ...s,
        resources: s.resources.map((r) =>
          r.id === id
            ? { ...r, status: "withdrawn", version: r.version + 1 }
            : r,
        ),
      }));
    else {
      await rpc("update_resource", {
        p_id: id,
        p_title: resource.title,
        p_description: resource.description ?? "",
        p_withdraw: true,
        p_expected_version: resource.version,
      });
      if (resource.object_key) {
        const { error } = await supabase.storage
          .from("pair-resources")
          .remove([resource.object_key]);
        cleanupPending = !!error;
      }
      await refresh();
    }
    notify(
      cleanupPending
        ? "سُحب المورد. ما زالت مساحة الملف محسوبة حتى اكتمال تنظيف التخزين."
        : "سُحب المورد من الرفقة.",
    );
  };
  const downloadResource = async (value: Pick<Resource, "id">) => {
    const resource = state.resources.find(
      (r) =>
        r.id === value.id && r.pair_id === pair?.id && r.status === "published",
    );
    if (!profile?.enabled || !resource?.object_key)
      throw new Error("هذا الملف غير متاح للتحميل.");
    let blob: Blob;
    if (demo) blob = await getDemoFile(resource.object_key);
    else {
      const result = await supabase.storage
        .from("pair-resources")
        .download(resource.object_key);
      if (result.error || !result.data) throw localizedError(result.error);
      blob = result.data;
    }
    const url = URL.createObjectURL(blob);
    objectUrls.current.push(url);
    setTimeout(() => {
      URL.revokeObjectURL(url);
      objectUrls.current = objectUrls.current.filter((u) => u !== url);
    }, 60000);
    return url;
  };
  const createPair = async (name: string, email1: string, email2: string) => {
    if (!profile?.is_supervisor || !profile.enabled)
      throw new Error("إنشاء الرفقة متاح للمشرف فقط.");
    if (
      !name.trim() ||
      email1.toLowerCase() === email2.toLowerCase() ||
      [email1.toLowerCase(), email2.toLowerCase()].includes(
        profile.email.toLowerCase(),
      )
    )
      throw new Error("أدخل اسمًا للرفقة وبريدين مختلفين، غير بريد المشرف.");
    if (!demo) {
      const result = await rpc<{ pair: Pair; invites: InviteSecret[] }>(
        "create_pair",
        { p_name: name, p_email1: email1, p_email2: email2 },
      );
      await refresh();
      return result;
    }
    const pair: Pair = {
      id: uuid(),
      name,
      supervisor_id: profile.id,
      status: "pending",
      time_zone: "Africa/Algiers",
      created_at: stamp(),
      members: [],
      supervisor: profile,
    };
    const invites = [email1, email2].map((email, i) => ({
      slot: i + 1,
      token: uuid() + uuid(),
      recipient_email: email,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    }));
    mutate((s) => ({
      ...s,
      pairs: [...s.pairs, pair],
      invitations: [
        ...s.invitations,
        ...invites.map(({ token: _, ...invite }) => ({
          ...invite,
          id: uuid(),
          pair_id: pair.id,
          created_at: stamp(),
        })),
      ],
    }));
    notify("أُنشئت الرفقة. روابط التجربة المحلية للعرض فقط.");
    return { pair, invites };
  };
  const rotateInvite = async (
    id: string,
    slot: number,
  ): Promise<InviteSecret> => {
    const p = pairs.find((p) => p.id === id);
    requireSupervisor(p);
    if (p!.status !== "pending") throw new Error("الرفقة لا تقبل دعوات جديدة.");
    if (!demo) {
      const invite = await rpc<InviteSecret>("rotate_invitation", {
        p_pair_id: id,
        p_slot: slot,
      });
      await refresh();
      return invite;
    }
    const old = state.invitations
      .filter((i) => i.pair_id === id && i.slot === slot)
      .at(-1);
    if (!old || old.accepted_at) throw new Error("المقعد غير متاح للدعوة.");
    const invite = {
      slot,
      token: uuid() + uuid(),
      recipient_email: old.recipient_email,
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    };
    const { token: _, ...metadata } = invite;
    mutate((s) => ({
      ...s,
      invitations: [
        ...s.invitations.map((i) =>
          i.pair_id === id && i.slot === slot
            ? { ...i, revoked_at: stamp() }
            : i,
        ),
        { ...metadata, id: uuid(), pair_id: id, created_at: stamp() },
      ],
    }));
    return invite;
  };
  const revokeInvite = async (id: string, slot: number) => {
    const p = pairs.find((p) => p.id === id);
    requireSupervisor(p);
    if (demo)
      mutate((s) => ({
        ...s,
        invitations: s.invitations.map((i) =>
          i.pair_id === id && i.slot === slot
            ? { ...i, revoked_at: stamp() }
            : i,
        ),
      }));
    else {
      await rpc("revoke_invitation", { p_pair_id: id, p_slot: slot });
      await refresh();
    }
    notify("أُلغيت الدعوة.");
  };
  const archivePair = async (id: string) => {
    const p = pairs.find((p) => p.id === id);
    requireSupervisor(p);
    if (demo)
      mutate((s) => ({
        ...s,
        pairs: s.pairs.map((p) =>
          p.id === id ? { ...p, status: "archived" } : p,
        ),
      }));
    else {
      await rpc("archive_pair", { p_pair_id: id });
      await refresh();
    }
    notify("أُرشفت الرفقة وأصبحت للقراءة فقط.");
  };
  const acceptInvite = async (token: string) => {
    if (demo) throw new Error("قبول الدعوات متاح في الحساب الفعلي فقط.");
    await rpc("accept_invitation", { p_token: token });
    await refresh();
    notify("قُبلت دعوتك.");
  };
  // Loaded by Settings on demand. A missing inbox migration must not disrupt
  // authentication or erase an already available pair workspace.
  const listProfileInvitations = useCallback(async (): Promise<
    ReceivedInvitation[]
  > => {
    if (!profile?.enabled)
      throw new Error("سجّل الدخول بحساب مفعّل للاطّلاع على دعواتك.");
    if (demo) return [];
    return rpc<ReceivedInvitation[]>("list_my_invitations");
  }, [profile?.id, profile?.enabled, demo]);
  const acceptProfileInvitation = async (
    id: string,
  ): Promise<InvitationAcceptance> => {
    if (!profile?.enabled)
      throw new Error("سجّل الدخول بحساب مفعّل لقبول الدعوة.");
    if (demo) throw new Error("قبول الدعوات متاح في الحساب الفعلي فقط.");
    const generation = sessionRef.current;
    const actorId = profile.id;
    const assertCurrentSession = (expectedGeneration: number) => {
      if (
        sessionRef.current !== expectedGeneration ||
        authenticatedActorRef.current !== actorId
      )
        throw new Error(
          "تغيّرت جلسة الحساب. افتح دعوات الحساب الحالي وأعد المحاولة.",
        );
    };
    const result = await rpc<InvitationAcceptance>(
      "accept_profile_invitation",
      {
        p_invitation_id: id,
      },
    );
    assertCurrentSession(generation);
    await refresh();
    // A successful live refresh advances the existing load generation once.
    // Logout/account switches invalidate it before old acceptance side effects.
    assertCurrentSession(generation + 1);
    setPairId(result.pair_id);
    notify(
      result.status === "active"
        ? "قُبلت دعوتك واكتملت الرفقة."
        : "قُبلت دعوتك. تصبح المساحة متاحة بعد اكتمال انضمام الرفيقين.",
    );
    return result;
  };
  const searchAccounts = async (search = "") => {
    if (!profile?.is_admin || !profile.enabled)
      throw new Error("هذه العملية لمسؤول النظام فقط.");
    if (!demo) return rpc<Profile[]>("admin_accounts", { p_search: search });
    return state.profiles.filter((p) =>
      `${p.display_name} ${p.email}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  };
  const setAccountEnabled = async (
    id: string,
    enabled: boolean,
    reason = "",
  ) => {
    if (!profile?.is_admin || !profile.enabled)
      throw new Error("هذه العملية لمسؤول النظام فقط.");
    const target = state.profiles.find((p) => p.id === id);
    if (demo) {
      if (
        !enabled &&
        target?.is_admin &&
        state.profiles.filter((p) => p.is_admin && p.enabled).length <= 1
      )
        throw new Error("لا يمكن إيقاف آخر مسؤول نظام مفعّل.");
      mutate((s) => ({
        ...s,
        profiles: s.profiles.map((p) => (p.id === id ? { ...p, enabled } : p)),
      }));
    } else {
      await rpc("admin_set_enabled", {
        p_user_id: id,
        p_enabled: enabled,
        p_reason: reason,
      });
      await refresh();
    }
    notify(enabled ? "أُعيد تفعيل الحساب." : "أُوقف الحساب.");
  };
  const updateProfile = async (name: string) => {
    if (!name.trim() || !profile?.enabled) throw new Error("أدخل اسمًا صالحًا.");
    if (demo)
      mutate((s) => ({
        ...s,
        profiles: s.profiles.map((p) =>
          p.id === profile.id ? { ...p, display_name: name.trim() } : p,
        ),
      }));
    else {
      await rpc("complete_profile", {
        p_display_name: name.trim(),
        p_supervisor: false,
      });
      await refresh();
    }
  };

  const visibleProfiles =
    profile?.is_admin && !profile.is_supervisor && !pair
      ? [profile]
      : state.profiles.filter(
          (p) =>
            p.id === profile?.id ||
            p.id === pair?.supervisor_id ||
            pair?.members.some((m) => m.id === p.id),
        );
  const storageUsageBytes = demo
    ? state.resources
        .filter((r) => r.pair_id === pair?.id)
        .reduce((n, r) => n + (r.size ?? 0), 0)
    : (liveStorageUsage[pair?.id ?? ""] ?? 0);
  const value: AppContextValue = {
    loading,
    error,
    profile,
    demo,
    isDemo: demo,
    role,
    pairs,
    pair,
    currentPair: pair,
    profiles: visibleProfiles,
    invitations: state.invitations.filter((i) =>
      pairs.some((p) => p.id === i.pair_id && p.supervisor_id === profile?.id),
    ),
    targets: state.targets.filter(
      (t) => t.pair_id === pair?.id && t.week_start === week,
    ),
    entries: state.entries.filter(
      (e) =>
        e.pair_id === pair?.id && e.date >= week && e.date < addDays(week, 7),
    ),
    meetings: state.meetings.filter((m) => m.pair_id === pair?.id),
    resources: state.resources.filter((r) => r.pair_id === pair?.id),
    accounts: profile?.is_admin ? state.profiles : [],
    week,
    message,
    storageUsageBytes,
    setWeek,
    setPairId,
    clearMessage: () => setMessage(""),
    notify,
    refresh,
    login,
    signup,
    logout,
    resetPassword,
    updatePassword,
    startDemo,
    switchDemoRole,
    setDemoRole: switchDemoRole,
    resetDemo,
    saveDay,
    saveTarget,
    respondTarget,
    saveMeeting,
    saveResource,
    withdrawResource,
    downloadResource,
    createPair,
    rotateInvite,
    revokeInvite,
    archivePair,
    acceptInvite,
    listProfileInvitations,
    acceptProfileInvitation,
    searchAccounts,
    setAccountEnabled,
    setAccountStatus: setAccountEnabled,
    updateProfile,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useApp(): AppContextValue {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider is required");
  return value;
}
