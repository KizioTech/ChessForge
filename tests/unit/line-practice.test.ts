import { describe, it, expect } from "vitest";
import {
  startPractice, attempt, advanceOpponent, withHint, isClean, isUserTurn, expectedSan, sameSan, userMoveCount
} from "../../src/lib/openings/line-practice";

const line = ["e4", "c5", "Nf3", "d6", "d4", "cxd4"];

describe("practice as White", () => {
  it("starts on the user's first move", () => {
    const s = startPractice(line, "white");
    expect(s.ply).toBe(0);
    expect(expectedSan(line, s)).toBe("e4");
  });

  it("accepts the right move, then the opponent replies", () => {
    let s = startPractice(line, "white");
    const r = attempt(line, s, "white", "e4");
    expect(r.correct).toBe(true);
    expect(r.state.ply).toBe(1);
    s = advanceOpponent(line, r.state, "white");
    expect(s.ply).toBe(2);
    expect(expectedSan(line, s)).toBe("Nf3");
  });

  it("counts a wrong move without moving on", () => {
    const s = startPractice(line, "white");
    const r = attempt(line, s, "white", "d4");
    expect(r.correct).toBe(false);
    expect(r.state.ply).toBe(0);
    expect(r.state.mistakes).toBe(1);
  });

  it("ignores check marks when comparing moves", () => {
    expect(sameSan("Qh5+", "Qh5")).toBe(true);
    expect(sameSan("Nf3", "Nc3")).toBe(false);
  });
});

describe("practice as Black", () => {
  it("plays White's first move for you", () => {
    const s = startPractice(line, "black");
    expect(s.ply).toBe(1);
    expect(expectedSan(line, s)).toBe("c5");
    expect(isUserTurn(s.ply, "black")).toBe(true);
  });

  it("does not accept a move out of turn", () => {
    const s = { ply: 0, mistakes: 0, hints: 0, finished: false };
    expect(attempt(line, s, "black", "e4").correct).toBe(false);
  });
});

describe("finishing and mastery", () => {
  function playThrough(side: "white" | "black", wrongFirst: boolean, hint: boolean) {
    let s = startPractice(line, side);
    if (wrongFirst) s = attempt(line, s, side, "a3").state;
    if (hint) s = withHint(s);
    while (!s.finished) {
      const want = expectedSan(line, s)!;
      const r = attempt(line, s, side, want);
      s = advanceOpponent(line, r.state, side);
    }
    return s;
  }

  it("a perfect run is clean", () => {
    expect(isClean(playThrough("white", false, false))).toBe(true);
    expect(isClean(playThrough("black", false, false))).toBe(true);
  });

  it("a mistake or a hint makes the run unclean", () => {
    expect(isClean(playThrough("white", true, false))).toBe(false);
    expect(isClean(playThrough("white", false, true))).toBe(false);
  });

  it("is finished when the last move is played, even if it is the opponent's", () => {
    const s = playThrough("black", false, false);
    expect(s.finished).toBe(true);
    expect(s.ply).toBe(line.length);
  });

  it("counts the user's moves", () => {
    expect(userMoveCount(line, "white")).toBe(3);
    expect(userMoveCount(line, "black")).toBe(3);
    expect(userMoveCount(["e4"], "black")).toBe(0);
  });
});
