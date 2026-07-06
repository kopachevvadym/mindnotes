import { describe, expect, test } from "bun:test";
import {
  formatDurationMin,
  formatTimerClock,
  minutesAgo,
  pluralThoughts,
  relativeThoughtTime,
} from "./format";

describe("pluralThoughts", () => {
  test.each([
    [1, "1 думка"],
    [2, "2 думки"],
    [4, "4 думки"],
    [5, "5 думок"],
    [11, "11 думок"],
    [12, "12 думок"],
    [21, "21 думка"],
    [22, "22 думки"],
    [111, "111 думок"],
  ])("%i → %s", (n, expected) => {
    expect(pluralThoughts(n)).toBe(expected);
  });
});

describe("relativeThoughtTime", () => {
  test.each([
    [0, "щойно"],
    [1, "кілька хвилин тому"],
    [3, "кілька хвилин тому"],
    [4, "4 хвилини тому"],
    [11, "11 хвилин тому"],
    [21, "21 хвилину тому"],
    [22, "22 хвилини тому"],
    [45, "45 хвилин тому"],
    [120, "120 хвилин тому"],
  ])("%i хв → %s", (agoMin, expected) => {
    expect(relativeThoughtTime(agoMin, "14:19")).toBe(expected);
  });

  test("понад 2 години → точний час", () => {
    expect(relativeThoughtTime(121, "14:19")).toBe("14:19");
  });
});

describe("formatDurationMin", () => {
  test.each([
    [0, "1 хв"],
    [1, "1 хв"],
    [43, "43 хв"],
    [60, "1 год"],
    [65, "1 год 5 хв"],
    [125, "2 год 5 хв"],
  ])("%i хв → %s", (min, expected) => {
    expect(formatDurationMin(min)).toBe(expected);
  });
});

describe("formatTimerClock", () => {
  test.each([
    [0, "00:00"],
    [5_000, "00:05"],
    [65_000, "01:05"],
    [59 * 60_000 + 59_000, "59:59"],
    [60 * 60_000, "1:00"],
    [125 * 60_000, "2:05"],
  ])("%i мс → %s", (ms, expected) => {
    expect(formatTimerClock(ms)).toBe(expected);
  });
});

describe("minutesAgo", () => {
  test("5 хв тому → 5", () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(minutesAgo(iso)).toBe(5);
  });

  test("майбутнє не дає відʼємного", () => {
    const iso = new Date(Date.now() + 60_000).toISOString();
    expect(minutesAgo(iso)).toBe(0);
  });
});
