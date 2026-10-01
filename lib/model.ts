export type Status = "completed" | "skipped";
export type RoutineVersion = { from: string; weekdays: number[]; duration: number; time: string; active: boolean };
export type Routine = { id: string; title: string; category: string; icon: string; versions: RoutineVersion[] };
export type Occurrence = { routineId: string; date: string; status: Status; completedAt?: string; notes?: string };
export type Lesson = { id: string; title: string; doneAt?: string };
export type Course = { id: string; title: string; kind: "makeup" | "project" | "custom"; lessons: Lesson[] };
export type Milestone = { id: string; title: string; doneAt?: string };
export type Goal = { id: string; title: string; targetDate: string; milestones: Milestone[] };
export type Focus = { taskId: string | null; length: number; elapsed: number; startedAt: number | null; status: "idle" | "running" | "paused" | "finished" };
export type Profile = { name: string; timezone: string; allowance: number; notificationsEnabled?: boolean; waterReminderInterval?: number };
export type BloomData = { schema: 1; seedRevision?: number; profile: Profile; routines: Routine[]; occurrences: Occurrence[]; courses: Course[]; goals: Goal[]; usage: Record<string, number>; water?: Record<string, number>; notes?: Record<string, string>; focus: Focus };
const v = (weekdays: number[], duration: number): RoutineVersion[] => [{ from: "0001-01-01", weekdays, duration, time: "", active: true }];
export const seed: BloomData = {
  schema: 1,
  seedRevision: 7,
  profile: { name: "", timezone: "Asia/Dubai", allowance: 45, notificationsEnabled: false, waterReminderInterval: 2 },
  routines: [
    { id: "reading", title: "Read for a little while", category: "Everyday", icon: "book", versions: v([0,1,2,3,4,5,6], 25) },
    { id: "scalp", title: "Scalp routine", category: "Everyday", icon: "sparkle", versions: v([0,1,2,3,4,5,6], 5) },
    { id: "water", title: "Drink water — stay hydrated", category: "Wellbeing", icon: "droplets", versions: v([0,1,2,3,4,5,6], 5) },
    { id: "social", title: "Social media check-in", category: "Everyday", icon: "phone", versions: v([0,1,2,3,4,5,6], 45) },
    { id: "workout", title: "Move your body", category: "Movement", icon: "heart", versions: v([1,3,5,6], 45) },
    { id: "sketch", title: "Sketch something", category: "Creative", icon: "pencil", versions: v([0,2], 45) },
    { id: "spanish", title: "Practice Spanish", category: "Learning", icon: "language", versions: v([1,3,5], 25) },
    { id: "arabic", title: "Practice Arabic", category: "Learning", icon: "language", versions: v([2,4,6], 25) },
    { id: "hair", title: "Hair treatment", category: "Wellbeing", icon: "drop", versions: v([0,1,4], 20) },
    { id: "pm", title: "Project management lesson", category: "Learning", icon: "layers", versions: v([2,6], 30) },
    { id: "makeup", title: "Makeup practice — tutorial or stream", category: "Creative", icon: "palette", versions: v([0,3,5], 45) },
    { id: "skills", title: "Explore an online skill", category: "Learning", icon: "sparkle", versions: [{ from: "0001-01-01", weekdays: [5], duration: 30, time: "", active: false }] }
  ],
  occurrences: [],
  courses: [
    { id: "makeup-course", title: "Makeup certification", kind: "makeup", lessons: [ { id: "m1", title: "Add your first course module" }, { id: "m2", title: "Practice and portfolio" }, { id: "m3", title: "Assessment and certificate" } ] },
    { id: "pm-course", title: "Project management", kind: "project", lessons: [ { id: "p1", title: "Add the first syllabus lesson" }, { id: "p2", title: "Next lesson" }, { id: "p3", title: "Apply what you learned" } ] }
  ],
  goals: [{ id: "driving", title: "Driving licence", targetDate: "2026-12-31", milestones: [
    { id: "d1", title: "Enrol at an Abu Dhabi-approved driving school (ADTC or Emirates Driving Institute)" },
    { id: "d2", title: "Open a traffic file via TAMM and complete the required eye exam" },
    { id: "d3", title: "Complete mandatory theory classes and pass the RTA knowledge test" },
    { id: "d4", title: "Complete the minimum required practical driving lessons" },
    { id: "d5", title: "Book and pass the final road test at the driving school" },
    { id: "d6", title: "Collect your Abu Dhabi driving licence" }
  ] }],
  usage: {},
  water: {},
  notes: {},
  focus: { taskId: null, length: 20 * 60, elapsed: 0, startedAt: null, status: "idle" }
};
export const cloneSeed = (): BloomData => JSON.parse(JSON.stringify(seed));
const originalDrivingTitles: Record<string,string> = {
  d1:"Confirm local requirements and choose a school", d2:"Register and prepare paperwork",
  d3:"Study for and take theory test", d4:"Take lessons and practice",
  d5:"Book and complete required tests", d6:"Finish paperwork and licence issuance"
};
const genericUaeDrivingTitles: Record<string,string> = {
  d1:"Confirm emirate and whether a current licence can be exchanged",
  d2:"Check required documents and choose an approved driving institute",
  d3:"Open the traffic file and complete an approved eye test",
  d4:"Complete required theory study and knowledge test, if needed",
  d5:"Complete required lessons and practical tests, if needed",
  d6:"Finish the exchange or test process and receive the UAE licence"
};
export function migrateLocalData(value: BloomData): BloomData {
  let d: BloomData = structuredClone(value);
  const rev = d.seedRevision || 1;
  // v1/v2 → timezone rename
  if (rev < 3 && d.profile.timezone === "Africa/Addis_Ababa") d.profile.timezone = "Asia/Dubai";
  // v3 → v4: water routine, 4-day workout, new-driver milestones
  if (rev < 4) {
    // Add water routine if missing
    if (!d.routines.find(r => r.id === "water")) {
      const idx = Math.max(0, d.routines.findIndex(r => r.id === "scalp"));
      const ins = seed.routines.find(r => r.id === "water");
      if (ins) d.routines.splice(idx + 1, 0, JSON.parse(JSON.stringify(ins)));
    }
    // Update workout from 3-day to 4-day schedule if not manually customised
    const workout = d.routines.find(r => r.id === "workout");
    if (workout) for (const ver of workout.versions) {
      if ([...ver.weekdays].sort().join(",") === "1,3,6") ver.weekdays = [1, 3, 5, 6];
    }
    // Patch driving milestones to new-driver wording if not yet completed
    const v3Titles: Record<string,string> = {
      d1:"Check TAMM route: new licence or eligible foreign-licence exchange",
      d2:"Prepare documents and open an Abu Dhabi traffic file",
      d3:"Complete an approved eye exam",
      d4:"Complete theory and practical training, if required",
      d5:"Book and pass the required driving tests, if required",
      d6:"Receive the Abu Dhabi driving licence",
    };
    const allLegacy = (id: string, title: string) =>
      [originalDrivingTitles[id], genericUaeDrivingTitles[id], v3Titles[id]].includes(title);
    const driving = d.goals.find(g => g.id === "driving");
    const seedDriving = seed.goals.find(g => g.id === "driving");
    if (driving && seedDriving) for (const m of driving.milestones) {
      if (!m.doneAt && allLegacy(m.id, m.title)) {
        const sm = seedDriving.milestones.find(x => x.id === m.id);
        if (sm) m.title = sm.title;
      }
    }
    d.seedRevision = 4;
  }
  // v4 → v5: makeup 3×/week (Sun, Wed, Fri) with tutorial focus
  if ((d.seedRevision || 1) < 5) {
    const makeup = d.routines.find(r => r.id === "makeup");
    if (makeup) {
      for (const ver of makeup.versions) {
        if ([...ver.weekdays].sort().join(",") === "0,3") ver.weekdays = [0, 3, 5];
      }
      if (makeup.title === "Makeup lesson or practice") makeup.title = "Makeup practice — tutorial or stream";
    }
    d.seedRevision = 5;
  }
  if ((d.seedRevision || 1) < 6) {
    if (!d.water) d.water = {};
    d.seedRevision = 6;
  }
  if ((d.seedRevision || 1) < 7) {
    if (!d.water) d.water = {};
    if (!d.notes) d.notes = {};
    if (d.profile.notificationsEnabled === undefined) d.profile.notificationsEnabled = false;
    if (!d.profile.waterReminderInterval) d.profile.waterReminderInterval = 2;
    d.seedRevision = 7;
  }
  if (!d.water) d.water = {};
  if (!d.notes) d.notes = {};
  return d;
}
export const isDateKey = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export function dateKey(date: Date, timezone: string): string { const p = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date); const get = (k: string) => p.find(x => x.type === k)?.value || ""; return `${get("year")}-${get("month")}-${get("day")}`; }
export function addDays(key: string, n: number): string { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); }
export function weekday(key: string): number { return new Date(`${key}T12:00:00Z`).getUTCDay(); }
export function monday(key: string): string { return addDays(key, -(weekday(key) + 6) % 7); }
export const currentVersion = (r: Routine, key: string) => [...r.versions].sort((a,b) => a.from.localeCompare(b.from)).filter(x => x.from <= key).at(-1);
export const scheduled = (r: Routine, key: string) => { const x = currentVersion(r,key); return !!x?.active && x.weekdays.includes(weekday(key)); };
export const getOccurrence = (d: BloomData, id: string, key: string) => d.occurrences.find(x => x.routineId === id && x.date === key);
export function countWeek(d: BloomData, start: string) { let total=0, done=0, skipped=0; for(let i=0;i<7;i++){ const key=addDays(start,i); for(const r of d.routines) if(scheduled(r,key)){total++; const o=getOccurrence(d,r.id,key); if(o?.status==="completed")done++; if(o?.status==="skipped")skipped++;} } return {total,done,skipped}; }
export function scheduledStreak(d: BloomData, id: string, today: string): number { const r=d.routines.find(x=>x.id===id); if(!r)return 0; let key=today, count=0, started=false; for(let i=0;i<366;i++,key=addDays(key,-1)){if(!scheduled(r,key))continue;const status=getOccurrence(d,id,key)?.status;if(!started&&key===today&&status!=="completed")continue;started=true;if(status!=="completed")break;count++;}return count; }
export function validateImport(value: unknown): BloomData {
  if(!value || typeof value!=="object") throw Error("This file does not contain Bloom data.");
  const d=value as BloomData;
  if(d.schema!==1 || !d.profile || !Array.isArray(d.routines) || !Array.isArray(d.occurrences) || !Array.isArray(d.courses) || !Array.isArray(d.goals) || typeof d.usage!=="object" || !d.focus) throw Error("This backup has an unsupported or incomplete format.");
  try { new Intl.DateTimeFormat("en",{timeZone:d.profile.timezone}); } catch { throw Error("The backup has an invalid timezone."); }
  if(typeof d.profile.name!=="string" || !Number.isFinite(d.profile.allowance) || d.profile.allowance<0 || d.profile.allowance>1440) throw Error("The backup has invalid profile settings.");
  const ids=new Set<string>();
  for(const r of d.routines){ if(!r || typeof r.id!=="string" || ids.has(r.id) || typeof r.title!=="string" || !Array.isArray(r.versions) || !r.versions.length) throw Error("The backup has invalid routines."); ids.add(r.id); for(const v of r.versions) if(!isDateKey(v.from) || !Array.isArray(v.weekdays) || v.weekdays.some(n=>!Number.isInteger(n)||n<0||n>6) || !Number.isFinite(v.duration) || v.duration<0 || v.duration>1440 || typeof v.time!=="string" || typeof v.active!=="boolean") throw Error("The backup has invalid schedule data."); }
  const seen=new Set<string>(); for(const o of d.occurrences){ const k=`${o.routineId}|${o.date}`; if(!ids.has(o.routineId)||!isDateKey(o.date)||!(["completed","skipped"] as string[]).includes(o.status)||seen.has(k)) throw Error("The backup has invalid or duplicate completion records."); seen.add(k); }
  for(const c of d.courses) if(!c || typeof c.id!=="string" || typeof c.title!=="string" || !Array.isArray(c.lessons) || c.lessons.some(l=>!l || typeof l.id!=="string" || typeof l.title!=="string")) throw Error("The backup has invalid course data.");
  for(const g of d.goals) if(!g || typeof g.id!=="string" || typeof g.title!=="string" || !isDateKey(g.targetDate) || !Array.isArray(g.milestones) || g.milestones.some(m=>!m || typeof m.id!=="string" || typeof m.title!=="string")) throw Error("The backup has invalid goals.");
  if(!["idle","running","paused","finished"].includes(d.focus.status) || !Number.isFinite(d.focus.length) || !Number.isFinite(d.focus.elapsed)) throw Error("The backup has invalid focus data.");
  return d;
}
