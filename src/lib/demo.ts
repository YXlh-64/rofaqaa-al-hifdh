import type {
  DailyEntry,
  Invitation,
  Meeting,
  Pair,
  Profile,
  Resource,
  Role,
  Target,
} from "./types";
import { addDays, today, weekStart } from "./dates";
export type DataState = {
  profiles: Profile[];
  pairs: Pair[];
  targets: Target[];
  entries: DailyEntry[];
  meetings: Meeting[];
  resources: Resource[];
  invitations: Invitation[];
};
export const DEMO_KEY = "rofaqa-demo-v1";
export const DEMO_SESSION = "rofaqa-demo-role";
export const demoIds: Record<Role, string> = {
  member: "demo-aya",
  supervisor: "demo-supervisor",
  admin: "demo-admin",
};
export function makeDemo(): DataState {
  const date = today(),
    week = weekStart(date),
    stamp = new Date().toISOString();
  const profiles: Profile[] = [
    {
      id: "demo-aya",
      email: "aya@example.test",
      display_name: "آية بن علي خوجة",
      is_supervisor: false,
      is_admin: false,
      enabled: true,
      created_at: stamp,
    },
    {
      id: "demo-maryam",
      email: "maryam@example.test",
      display_name: "مريم عبد الرحمن",
      is_supervisor: false,
      is_admin: false,
      enabled: true,
      created_at: stamp,
    },
    {
      id: "demo-supervisor",
      email: "soumaya@example.test",
      display_name: "سمية أمين",
      is_supervisor: true,
      is_admin: false,
      enabled: true,
      created_at: stamp,
    },
    {
      id: "demo-admin",
      email: "admin@example.test",
      display_name: "مسؤول التجربة",
      is_supervisor: false,
      is_admin: true,
      enabled: true,
      created_at: stamp,
    },
  ];
  const pair: Pair = {
    id: "demo-pair",
    name: "رفقة النور",
    supervisor_id: "demo-supervisor",
    status: "active",
    time_zone: "Africa/Algiers",
    created_at: stamp,
    members: profiles.slice(0, 2),
    supervisor: profiles[2],
  };
  const targets: Target[] = profiles
    .slice(0, 2)
    .map((p) => ({
      id: `target-${p.id}`,
      pair_id: pair.id,
      week_start: week,
      owner_id: p.id,
      mode: "individual",
      status: "confirmed",
      hifdh: [{ surah: 24, from: 1, to: 10 }],
      revision: [{ surah: 23, from: 1, to: 20 }],
      note: "خطوات صغيرة، وثبات كل يوم.",
      proposed_by: p.id,
      version: 1,
    }));
  const entries: DailyEntry[] = profiles
    .slice(0, 2)
    .map((p, i) => ({
      id: `entry-${p.id}`,
      pair_id: pair.id,
      owner_id: p.id,
      date,
      plan_hifdh: {
        state: "planned",
        ranges: [{ surah: 24, from: 1, to: 10 }],
      },
      plan_revision: {
        state: "planned",
        ranges: [{ surah: 23, from: 1, to: 20 }],
      },
      actual_hifdh: {
        state: "partial",
        ranges: [{ surah: 24, from: 1, to: i ? 4 : 7 }],
      },
      actual_revision: {
        state: i ? "partial" : "completed",
        ranges: [{ surah: 23, from: 1, to: i ? 10 : 20 }],
      },
      note: i ? "أكمل ما تبقّى غدًا بإذن الله." : "بداية هادئة، والحمد لله.",
      version: 1,
      created_at: stamp,
      updated_at: stamp,
    }));
  return {
    profiles,
    pairs: [pair],
    targets,
    entries,
    invitations: [],
    meetings: [
      {
        id: "meeting-daily",
        pair_id: pair.id,
        type: "daily",
        date,
        scheduled_at: `${date}T19:00:00.000Z`,
        link: null,
        status: "planned",
        note: "تسميع ما حفظناه، وتشجيع بعضنا.",
        updated_by: profiles[0].id,
        updated_at: stamp,
        version: 1,
      },
      {
        id: "meeting-weekly",
        pair_id: pair.id,
        type: "weekly",
        date: addDays(week, 6),
        scheduled_at: `${addDays(week, 6)}T17:00:00.000Z`,
        link: null,
        status: "planned",
        note: "نراجع المسار ونضع نية الأسبوع القادم.",
        updated_by: profiles[2].id,
        updated_at: stamp,
        version: 1,
      },
    ],
    resources: [
      {
        id: "resource-tafsir",
        pair_id: pair.id,
        title: "تفسير سورة النور",
        description: "اقرآ المعاني قبل الحفظ لتكون الآيات أقرب إلى القلب.",
        type: "link",
        url: "https://quran.com/24",
        object_key: null,
        size: null,
        mime_type: null,
        status: "published",
        week_start: week,
        surah: 24,
        surah_label: "سورة النور",
        version: 1,
        created_at: stamp,
      },
      {
        id: "resource-habits",
        pair_id: pair.id,
        title: "وقفات مع سورة المؤمنون",
        description: "تدبّر المعاني التي نراجعها في هذا الأسبوع.",
        type: "link",
        url: "https://quran.com/23",
        object_key: null,
        size: null,
        mime_type: null,
        status: "published",
        week_start: week,
        surah: 23,
        surah_label: "سورة المؤمنون",
        version: 1,
        created_at: stamp,
      },
    ],
  };
}
export function loadDemo(): DataState {
  try {
    const text = localStorage.getItem(DEMO_KEY);
    if (text) {
      const value = JSON.parse(text);
      if (value.profiles && value.pairs && value.entries) return value;
    }
  } catch {
    /* Start clean if saved fixtures are unavailable. */
  }
  return makeDemo();
}
export function emptyData(): DataState {
  return {
    profiles: [],
    pairs: [],
    targets: [],
    entries: [],
    meetings: [],
    resources: [],
    invitations: [],
  };
}
