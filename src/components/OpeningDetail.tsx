import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import {
  ArrowLeft, ArrowUpDown, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Lightbulb, RotateCcw
} from "lucide-react";
import { BoardView } from "./BoardView";
import { VariationTree } from "./VariationTree";
import { identifyOpening, nextBookMoves, type BookOpening, type OpeningBook } from "../lib/openings/opening-book";
import {
  expandableIds, filterTree, leafLines, lineKey, splitName, type OpeningFamily, type OpeningSide, type VariationNode
} from "../lib/openings/learn-tree";
import {
  advanceOpponent, attempt, expectedSan, isClean, isUserTurn, sameSan, startPractice, withHint, userMoveCount,
  type PracticeState
} from "../lib/openings/line-practice";
import { MASTER_STREAK, statusOf, summarizeProgress, type ProgressMap } from "../lib/openings/line-progress";

type Promotion = "q" | "r" | "b" | "n";

interface Props {
  book: OpeningBook;
  family: OpeningFamily;
  initialLineKey: string | null;
  progress: ProgressMap;
  onRecord: (line: BookOpening, clean: boolean) => void;
  onBack: () => void;
  onAddLine: (line: BookOpening, side: OpeningSide) => Promise<number>;
  onViewRepertoire: () => void;
}

/* ---------- chess helpers ---------- */

function chessAt(moves: string[], count: number): Chess {
  const c = new Chess();
  for (let i = 0; i < count; i++) {
    try { c.move(moves[i]); } catch { break; }
  }
  return c;
}

function lastMoveOf(chess: Chess): [string, string] | null {
  const h = chess.history({ verbose: true });
  const last = h[h.length - 1];
  return last ? [last.from, last.to] : null;
}

function squaresOfSan(fen: string, san: string): [string, string] | null {
  try {
    const m = new Chess(fen).move(san);
    return [m.from, m.to];
  } catch { return null; }
}

function sanFor(fen: string, from: Square, to: Square, promotion?: Promotion): string | null {
  try { return new Chess(fen).move({ from, to, promotion }).san; } catch { return null; }
}

const other = (s: OpeningSide): OpeningSide => (s === "white" ? "black" : "white");
const idPath = (name: string) => splitName(name).join(" › ");
const ancestorIds = (name: string): string[] => {
  const parts = splitName(name);
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join(" › "));
};

/* ---------- component ---------- */

export function OpeningDetail({ book, family, initialLineKey, progress, onRecord, onBack, onAddLine, onViewRepertoire }: Props) {
  const lines = useMemo(() => leafLines(family.root), [family]);
  const startLine = useMemo(
    () => lines.find(l => lineKey(l) === initialLineKey) ?? family.mainLine,
    [lines, family, initialLineKey]
  );

  const [line, setLine] = useState<BookOpening>(startLine);
  const [mode, setMode] = useState<"study" | "practise">("study");
  const [userSide, setUserSide] = useState<OpeningSide>(family.side);
  const [flipped, setFlipped] = useState(false);

  // study state
  const [moves, setMoves] = useState<string[]>(startLine.moves ?? []);
  const [cursor, setCursor] = useState((startLine.moves ?? []).length);

  // practise state
  const lineMoves = line.moves ?? [];
  const [practice, setPractice] = useState<PracticeState>(() => startPractice(startLine.moves ?? [], family.side));
  const [hintPly, setHintPly] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [nonce, setNonce] = useState(0); // bump to force the board to redraw after a rejected move
  const timer = useRef<number | undefined>(undefined);
  const recorded = useRef(false);

  // tree state
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([family.root.id, ...ancestorIds(startLine.name)]));
  const [treeQuery, setTreeQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function resetPractice(l: BookOpening, side: OpeningSide) {
    window.clearTimeout(timer.current);
    recorded.current = false;
    setHintPly(null);
    setFeedback("");
    setPractice(startPractice(l.moves ?? [], side));
    setNonce(n => n + 1);
  }

  function chooseLine(l: BookOpening) {
    const m = l.moves ?? [];
    setLine(l);
    setMoves(m);
    setCursor(m.length);
    setNotice(null);
    resetPractice(l, userSide);
  }

  function chooseSide(side: OpeningSide) {
    setUserSide(side);
    resetPractice(line, side);
  }

  function chooseMode(next: "study" | "practise") {
    setMode(next);
    if (next === "practise") resetPractice(line, userSide);
  }

  /* boards */
  const studyGame = useMemo(() => chessAt(moves, cursor), [moves, cursor]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const practiceGame = useMemo(() => chessAt(lineMoves, practice.ply), [lineMoves, practice.ply, nonce]);
  const game = mode === "study" ? studyGame : practiceGame;
  const lastMove = useMemo(() => lastMoveOf(game), [game]);
  const orientation = flipped ? other(userSide) : userSide;

  const canPractise = userMoveCount(lineMoves, userSide) > 0;
  const userToMove = mode === "practise" && !practice.finished && isUserTurn(practice.ply, userSide);

  const expected = expectedSan(lineMoves, practice);
  const hintSquares = hintPly === practice.ply && expected ? squaresOfSan(practiceGame.fen(), expected) : null;
  const shapes = useMemo(
    () => (hintSquares ? [{ orig: hintSquares[0], dest: hintSquares[1], brush: "green" }] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hintSquares?.[0], hintSquares?.[1]]
  );

  function onStudyMove(from: Square, to: Square, promotion?: Promotion) {
    const san = sanFor(studyGame.fen(), from, to, promotion);
    if (!san) return;
    setMoves(m => (cursor < m.length && sameSan(m[cursor], san) ? m : [...m.slice(0, cursor), san]));
    setCursor(cursor + 1);
  }

  function onPracticeMove(from: Square, to: Square, promotion?: Promotion) {
    const san = sanFor(practiceGame.fen(), from, to, promotion);
    if (!san || !userToMove) { setNonce(n => n + 1); return; }
    const r = attempt(lineMoves, practice, userSide, san);
    setPractice(r.state);
    if (!r.correct) {
      setFeedback("That is not the move in this line. Try again, or ask for a hint.");
      setNonce(n => n + 1);
      return;
    }
    setFeedback("");
    setHintPly(null);
    if (!r.state.finished) {
      timer.current = window.setTimeout(() => setPractice(s => advanceOpponent(lineMoves, s, userSide)), 450);
    }
  }

  function onHint() {
    if (!userToMove) return;
    setPractice(withHint);
    setHintPly(practice.ply);
  }

  // Record a finished run exactly once.
  useEffect(() => {
    if (mode === "practise" && canPractise && practice.finished && !recorded.current) {
      recorded.current = true;
      onRecord(line, isClean(practice));
    }
  }, [mode, canPractise, practice, line, onRecord]);

  // Arrow keys step through the line while studying.
  useEffect(() => {
    if (mode !== "study") return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "SELECT" || t?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") setCursor(c => Math.max(0, c - 1));
      else if (e.key === "ArrowRight") setCursor(c => Math.min(moves.length, c + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, moves.length]);

  /* study info */
  const here = useMemo(() => identifyOpening(book, moves.slice(0, cursor)).opening, [book, moves, cursor]);
  const nextMoves = useMemo(() => nextBookMoves(book, moves.slice(0, cursor), 6), [book, moves, cursor]);

  /* progress */
  const key = lineKey(line);
  const status = statusOf(progress[key]);
  const streak = progress[key]?.cleanStreak ?? 0;
  const summary = useMemo(() => summarizeProgress(family.lineKeys, progress), [family, progress]);
  const idx = lines.findIndex(l => lineKey(l) === key);
  const nextToLearn =
    [...lines.slice(idx + 1), ...lines.slice(0, Math.max(0, idx))].find(l => statusOf(progress[lineKey(l)]) !== "mastered") ?? null;

  /* tree */
  const visibleRoot = useMemo(() => filterTree(family.root, treeQuery), [family, treeQuery]);
  const effectiveExpanded = treeQuery.trim() ? new Set(expandableIds(visibleRoot ?? family.root)) : expanded;
  const toggle = (id: string) =>
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  async function addToRepertoire() {
    try {
      const n = await onAddLine(line, userSide);
      setNotice(n > 0
        ? `Added "${line.name}" (${n} moves) to your ${userSide} repertoire.`
        : "Nothing new to add. This line may already be in your repertoire.");
    } catch {
      setNotice("Could not add the line. Please try again.");
    }
  }

  const pairs: { n: number; w: string; b?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) pairs.push({ n: i / 2 + 1, w: moves[i], b: moves[i + 1] });

  return (
    <div className="content ol-page">
      <button className="ol-back" onClick={onBack}><ArrowLeft size={14} /> All openings</button>

      <header className="ol-head">
        <div>
          <div className="ol-eyebrow">
            <span className={`ol-side ol-side-${family.side}`}>{family.side === "white" ? "White" : "Black"} opening</span>
            <span className="ol-eco">{family.ecoMin === family.ecoMax ? family.ecoMin : `${family.ecoMin}–${family.ecoMax}`}</span>
          </div>
          <h1>{family.name}</h1>
          <p className="ol-sub">
            {family.lineCount} lines · {summary.mastered} mastered · {summary.learning} in progress
          </p>
        </div>
        <div className="ol-side-pick" role="group" aria-label="Which side you are learning">
          <span>You play</span>
          {(["white", "black"] as const).map(s => (
            <button key={s} className={`ol-chip${userSide === s ? " on" : ""}`} onClick={() => chooseSide(s)}>
              {s === "white" ? "White" : "Black"}
            </button>
          ))}
        </div>
      </header>

      <div className="ol-detail">
        <section className="ol-left">
          <div className="panel ol-board-card">
            <div className="ol-now">
              {mode === "study" ? (
                <>
                  <strong>{cursor === 0 ? "Starting position" : here ? here.name : "Beyond the named lines"}</strong>
                  {here && <span className="ol-eco">{here.eco}</span>}
                  {(line.isTrap || line.name.toLowerCase().includes("trap")) && (
                    <span className="ol-trap-tag">⚡ TRAP</span>
                  )}
                </>
              ) : (
                <>
                  <strong>{line.name}</strong>
                  <span className="ol-eco">{line.eco}</span>
                  {(line.isTrap || line.name.toLowerCase().includes("trap")) && (
                    <span className="ol-trap-tag">⚡ TRAP</span>
                  )}
                </>
              )}
            </div>

            <div className="ol-board">
              <BoardView
                game={game}
                orientation={orientation}
                interactive={mode === "study" || userToMove}
                onMove={mode === "study" ? onStudyMove : onPracticeMove}
                lastMove={lastMove}
                shapes={shapes}
                maxWidth="100%"
              />
            </div>

            <div className="ol-controls" role="toolbar" aria-label="Board controls">
              {mode === "study" ? (
                <>
                  <button className="icon-btn" onClick={() => setCursor(0)} aria-label="Start" title="Start"><ChevronsLeft size={16} /></button>
                  <button className="icon-btn" onClick={() => setCursor(c => Math.max(0, c - 1))} aria-label="Back" title="Back (←)"><ChevronLeft size={16} /></button>
                  <button className="icon-btn" onClick={() => setCursor(c => Math.min(moves.length, c + 1))} aria-label="Forward" title="Forward (→)"><ChevronRight size={16} /></button>
                  <button className="icon-btn" onClick={() => setCursor(moves.length)} aria-label="End" title="End"><ChevronsRight size={16} /></button>
                </>
              ) : (
                <>
                  <button className="button button-secondary button-small" onClick={() => resetPractice(line, userSide)}>
                    <RotateCcw size={13} /> Restart
                  </button>
                  <button className="button button-secondary button-small" onClick={onHint} disabled={!userToMove}>
                    <Lightbulb size={13} /> Hint
                  </button>
                </>
              )}
              <span className="ol-spacer" />
              <button className="icon-btn" onClick={() => setFlipped(f => !f)} aria-label="Flip board" title="Flip board"><ArrowUpDown size={15} /></button>
            </div>
          </div>

          {(line.trapMotif || line.trapDescription) && (
            <div className="panel ol-card-pad ol-trap-card">
              <div className="ol-trap-card-head" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span className="ol-trap-tag">⚡ TACTICAL MOTIF</span>
                <strong style={{ fontSize: "14px", color: "var(--text)" }}>{line.trapMotif}</strong>
              </div>
              {line.trapDescription && (
                <p className="ol-trap-card-desc" style={{ fontSize: "13px", color: "var(--soft)", margin: "8px 0 0", lineHeight: 1.5 }}>
                  {line.trapDescription}
                </p>
              )}
            </div>
          )}

          <div className="panel ol-card-pad">
            <div className="ol-tabs" role="tablist">
              <button role="tab" aria-selected={mode === "study"} className={mode === "study" ? "on" : ""} onClick={() => chooseMode("study")}>Study</button>
              <button role="tab" aria-selected={mode === "practise"} className={mode === "practise" ? "on" : ""} onClick={() => chooseMode("practise")}>Practise</button>
              <span className="ol-spacer" />
              <span className={`ol-status ol-status-${status}`}>
                {status === "mastered" ? "Mastered" : status === "learning" ? `Learning · ${streak}/${MASTER_STREAK} clean runs` : "Not practised yet"}
              </span>
            </div>

            {mode === "study" ? (
              <div className="ol-study">
                <div className="ol-moves" aria-label="Moves of this line">
                  {pairs.map((p, i) => (
                    <span key={p.n} className="ol-pair">
                      <span className="ol-num">{p.n}.</span>
                      <button className={cursor === i * 2 + 1 ? "on" : ""} onClick={() => setCursor(i * 2 + 1)}>{p.w}</button>
                      {p.b && <button className={cursor === i * 2 + 2 ? "on" : ""} onClick={() => setCursor(i * 2 + 2)}>{p.b}</button>}
                    </span>
                  ))}
                </div>
                <div className="ol-next">
                  <div className="ol-label">THEORY CONTINUES WITH</div>
                  {nextMoves.length === 0 ? (
                    <p className="ol-hint">No further named lines from here.</p>
                  ) : (
                    <div className="ol-next-list">
                      {nextMoves.map(n => (
                        <button key={n.san} onClick={() => onStudyMove(...(squaresOfSan(studyGame.fen(), n.san) ?? ["a1", "a1"]) as [Square, Square])}>
                          <strong>{n.san}</strong>
                          <span>{n.example.name.split(":").slice(-1)[0].trim()}</span>
                          <em>{n.lines}</em>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : !canPractise ? (
              <p className="ol-hint">
                This line has no moves for {userSide === "white" ? "White" : "Black"} to play. Switch sides above, or pick a longer line.
              </p>
            ) : practice.finished ? (
              <div className={`ol-result ${isClean(practice) ? "clean" : "messy"}`} role="status">
                <strong>{isClean(practice) ? "Clean run!" : "Finished, but not clean."}</strong>
                <span>
                  {isClean(practice)
                    ? status === "mastered"
                      ? "You have mastered this line."
                      : `${streak} of ${MASTER_STREAK} clean runs in a row.`
                    : `${practice.mistakes} mistake${practice.mistakes === 1 ? "" : "s"}, ${practice.hints} hint${practice.hints === 1 ? "" : "s"}. A clean run needs neither.`}
                </span>
                <div className="ol-result-actions">
                  <button className="button button-primary button-small" onClick={() => resetPractice(line, userSide)}>Practise again</button>
                  {nextToLearn && (
                    <button className="button button-secondary button-small" onClick={() => { chooseLine(nextToLearn); setExpanded(prev => new Set([...prev, ...ancestorIds(nextToLearn.name)])); }}>
                      Next line: {nextToLearn.name.split(":").slice(-1)[0].trim()}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="ol-practice" role="status" aria-live="polite">
                <strong>{userToMove ? `Your move as ${userSide === "white" ? "White" : "Black"}.` : "Opponent is replying…"}</strong>
                <span>Play the next move of {line.name} from memory.</span>
                {feedback && <span className="ol-feedback">{feedback}</span>}
                <span className="ol-counts">Mistakes {practice.mistakes} · Hints {practice.hints}</span>
              </div>
            )}
          </div>

          <div className="panel ol-card-pad ol-repertoire">
            <div className="ol-label">MY REPERTOIRE</div>
            {status === "mastered" ? (
              <button className="button button-primary" onClick={addToRepertoire}>Add this line to my {userSide} repertoire</button>
            ) : (
              <>
                <p className="ol-hint">
                  Repertoires are for lines you already know. Master this one first ({streak}/{MASTER_STREAK} clean runs).
                </p>
                <button className="ol-link" onClick={addToRepertoire}>Add it anyway</button>
              </>
            )}
            {notice && (
              <p className="ol-notice" role="status">
                <Check size={13} /> {notice}{" "}
                <button className="ol-link" onClick={onViewRepertoire}>Open my repertoire</button>
              </p>
            )}
          </div>
        </section>

        <aside className="panel ol-right">
          <div className="ol-right-head">
            <div>
              <div className="ol-label">VARIATIONS</div>
              <h2>{family.lineCount} lines</h2>
            </div>
            <div className="ol-right-tools">
              <button className="ol-link" onClick={() => setExpanded(new Set(expandableIds(family.root)))}>Expand all</button>
              <button className="ol-link" onClick={() => setExpanded(new Set([family.root.id]))}>Collapse</button>
            </div>
          </div>
          <input
            className="ol-tree-search"
            value={treeQuery}
            onChange={e => setTreeQuery(e.target.value)}
            placeholder={`Search within ${family.name}`}
            aria-label="Search variations"
          />
          {visibleRoot ? (
            <VariationTree
              root={visibleRoot}
              expanded={effectiveExpanded}
              selectedId={idPath(line.name)}
              progress={progress}
              onToggle={toggle}
              onSelect={(node: VariationNode) => node.line && chooseLine(node.line)}
            />
          ) : (
            <p className="ol-hint">No variation matches “{treeQuery}”.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
