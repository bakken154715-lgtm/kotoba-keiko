export function dateKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** 今日か昨日まで続いている連続日数。端末のタイムゾーンの日付で数える */
export function streakDays(isoDates: string[], today: Date = new Date()): number {
  const days = new Set(isoDates.map((iso) => dateKey(new Date(iso))));
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!days.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** 日付から決まる番号。同じ日は同じお題を出すために使う */
export function dayIndex(date: Date, length: number): number {
  const days = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return days % length;
}
