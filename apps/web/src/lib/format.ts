/** Українська плюралізація для «думка». */
export function pluralThoughts(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word: string;
  if (mod10 === 1 && mod100 !== 11) {
    word = "думка";
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    word = "думки";
  } else {
    word = "думок";
  }
  return `${n} ${word}`;
}

const dateFmtWithYear = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateFmtNoYear = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
});

export function formatSessionDate(iso: string): string {
  const date = new Date(iso);
  // Поточний рік — без року, лише день і місяць.
  const fmt = date.getFullYear() === new Date().getFullYear() ? dateFmtNoYear : dateFmtWithYear;
  return fmt.format(date);
}

const clockFmt = new Intl.DateTimeFormat("uk-UA", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Точний час думки, напр. «14:19». */
export function formatClockTime(iso: string): string {
  return clockFmt.format(new Date(iso));
}

const fullDateTimeFmt = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Повний час для підказки, напр. «18 червня 2026 р., 23:10». */
export function formatFullDateTime(iso: string): string {
  return fullDateTimeFmt.format(new Date(iso));
}

/** Скільки повних хвилин минуло від запису (не менше 0). */
export function minutesAgo(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

/** Відмінювання: «N хвилину / хвилини / хвилин тому» (з винятком 11–14 → хвилин). */
function pluralMinutesAgo(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word: string;
  if (mod10 === 1 && mod100 !== 11) word = "хвилину";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = "хвилини";
  else word = "хвилин";
  return `${n} ${word} тому`;
}

/** Людський відносний підпис часу думки; понад 2 год — сам точний час. */
export function relativeThoughtTime(agoMin: number, exactTime: string): string {
  if (agoMin < 1) return "щойно";
  if (agoMin <= 3) return "кілька хвилин тому";
  if (agoMin <= 120) return pluralMinutesAgo(agoMin);
  return exactTime;
}
