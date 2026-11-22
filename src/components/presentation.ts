export const number = (value: number) =>
  new Intl.NumberFormat("ar-DZ", { numberingSystem: "arab" }).format(value);
export function localToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
}
export function shiftDate(date: string, amount: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function startOfWeek(date = localToday()) {
  return shiftDate(date, -new Date(`${date}T12:00:00Z`).getUTCDay());
}
export function dateText(
  date: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) {
  return new Intl.DateTimeFormat("ar-DZ", {
    numberingSystem: "arab",
    timeZone: "Africa/Algiers",
    ...options,
  }).format(new Date(date.length === 10 ? `${date}T12:00:00Z` : date));
}
export const dayName = (date: string) => dateText(date, { weekday: "long" });
export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join(" ");
