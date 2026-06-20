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

const dateFmt = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatSessionDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}
