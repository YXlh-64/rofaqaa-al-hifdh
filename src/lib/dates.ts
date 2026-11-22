export function today(
  timeZone = "Africa/Algiers",
  value: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const p = (key: string) => parts.find((x) => x.type === key)?.value;
  return `${p("year")}-${p("month")}-${p("day")}`;
}
export function addDays(date: string, amount: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function weekStart(date = today()): string {
  return addDays(date, -new Date(`${date}T12:00:00Z`).getUTCDay());
}
export function weekDays(week = weekStart()): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(week, i));
}
export function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat("ar-DZ", {
    numberingSystem: "arab",
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  }).format(new Date(date.length === 10 ? `${date}T12:00:00Z` : date));
}
