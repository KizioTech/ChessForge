import { describe, it, expect } from "vitest";
import {
  recordRun, statusOf, summarizeProgress, loadProgress, saveProgress, storageKey, MASTER_STREAK,
  type KeyValueStorage, type LineProgress
} from "../../src/lib/openings/line-progress";

const T = "2026-11-14T10:00:00Z";
const memory = (): KeyValueStorage & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
};

describe("mastery", () => {
  it("starts new, becomes learning, then mastered after the required clean streak", () => {
    expect(statusOf(undefined)).toBe("new");
    let p: LineProgress | undefined;
    p = recordRun(p, "k", true, T);
    expect(statusOf(p)).toBe("learning");
    for (let i = 1; i < MASTER_STREAK; i++) p = recordRun(p, "k", true, T);
    expect(statusOf(p)).toBe("mastered");
    expect(p!.cleanRuns).toBe(MASTER_STREAK);
  });

  it("an unclean run resets the streak and removes mastery", () => {
    let p: LineProgress | undefined;
    for (let i = 0; i < MASTER_STREAK; i++) p = recordRun(p, "k", true, T);
    p = recordRun(p, "k", false, T);
    expect(statusOf(p)).toBe("learning");
    expect(p.cleanStreak).toBe(0);
    expect(p.attempts).toBe(MASTER_STREAK + 1);
  });

  it("an unclean first run is still learning, not new", () => {
    expect(statusOf(recordRun(undefined, "k", false, T))).toBe("learning");
  });

  it("summarizes a set of lines", () => {
    let a: LineProgress | undefined;
    for (let i = 0; i < MASTER_STREAK; i++) a = recordRun(a, "a", true, T);
    const b = recordRun(undefined, "b", true, T);
    const s = summarizeProgress(["a", "b", "c", "d"], { a: a!, b });
    expect(s).toEqual({ total: 4, mastered: 1, learning: 1, fresh: 2 });
  });
});

describe("storage", () => {
  it("round-trips per user", () => {
    const st = memory();
    saveProgress("u1", { k: recordRun(undefined, "k", true, T) }, st);
    expect(loadProgress("u1", st).k.attempts).toBe(1);
    expect(loadProgress("u2", st)).toEqual({});
    expect(storageKey(null)).toContain("local-user");
  });

  it("survives corrupt data", () => {
    const st = memory();
    st.setItem(storageKey("u"), "{not json");
    expect(loadProgress("u", st)).toEqual({});
    st.setItem(storageKey("u"), JSON.stringify({ k: { attempts: "x" }, ok: { attempts: 2, cleanStreak: 1 } }));
    const p = loadProgress("u", st);
    expect(p.k).toBeUndefined();
    expect(p.ok.attempts).toBe(2);
  });

  it("does not throw when storage fails", () => {
    const broken: KeyValueStorage = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(loadProgress("u", broken)).toEqual({});
    expect(() => saveProgress("u", {}, broken)).not.toThrow();
  });
});
