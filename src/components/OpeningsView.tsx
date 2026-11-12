/**
 * OpeningsView — Opening Repertoires, Practice Drilling, and Game Deviation Alerts
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Chess, type Square } from "chess.js";
import {
  BookOpen,
  Plus,
  Play,
  RotateCcw,
  AlertTriangle,
  Check,
  ChevronRight,
  Download,
  Upload,
  Trash2,
  Sparkles,
  ArrowRight,
  Layers,
  Activity,
  Edit2,
  Compass,
  Search,
  BookMarked,
  List,
  Eye,
  BookOpenCheck
} from "lucide-react";
import { BoardView } from "./BoardView";
import type { GameRecord } from "../lib/games";
import {
  type RepertoireRecord,
  type RepertoireLineNode,
  type RepertoireTreeNode,
  type RepertoireSide,
  type GameDeviation,
  createDefaultRepertoiresIfEmpty,
  getRepertoires,
  getRepertoireLines,
  addRepertoireMove,
  deleteRepertoireMove,
  importPgnToRepertoire,
  buildRepertoireTree,
  exportTreeToPgn,
  startDrillSession,
  submitDrillMove,
  detectAllDeviations,
  ECO_CATEGORIES,
  useOpeningBook,
  identifyOpening,
  nextBookMoves,
  listOpenings,
  pgnToSan,
  START_FEN,
  normalizeFen
} from "../lib/openings";

export interface EcoOpeningInfo {
  name: string;
  eco: string;
  moves: string;
  isEcoRoot?: boolean;
}

export interface TheoreticalMoveOption {
  name: string;
  eco: string;
  moves: string;
  san?: string;
  lines?: number;
}

interface OpeningsViewProps {
  userId?: string | null;
  games: GameRecord[];
  onOpenAnalysis?: (game: GameRecord) => void;
}

// ── Lichess Opening Explorer hook ────────────────────────────────────────────

interface ExplorerMove {
  uci: string;
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating?: number;
}

interface ExplorerData {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
}

function useExplorer(fen: string | null): { data: ExplorerData | null; loading: boolean } {
  const [data, setData] = useState<ExplorerData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fen) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    const url = `https://explorer.lichess.org/lichess?fen=${encodeURIComponent(fen)}&speeds=blitz,rapid&ratings=1200,1400,1600,1800`;
    fetch(url)
      .then(r => r.json())
      .then((d: ExplorerData) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) { setData(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [fen]);

  return { data, loading };
}

// ── Win percentage bar components ─────────────────────────────────────────────

function WinBar({ white, draws, black }: { white: number; draws: number; black: number }) {
  const total = white + draws + black;
  if (total === 0) return null;
  const wp = Math.round((white / total) * 100);
  const dp = Math.round((draws / total) * 100);
  const bp = 100 - wp - dp;
  return (
    <div style={{ display: "flex", height: "6px", borderRadius: "3px", overflow: "hidden", width: "100%", minWidth: "80px" }}>
      <div style={{ width: `${wp}%`, background: "#e8e8e8", transition: "width 0.3s" }} title={`White: ${wp}%`} />
      <div style={{ width: `${dp}%`, background: "#888", transition: "width 0.3s" }} title={`Draw: ${dp}%`} />
      <div style={{ width: `${bp}%`, background: "#222", transition: "width 0.3s" }} title={`Black: ${bp}%`} />
    </div>
  );
}

function WinBarLabels({ white, draws, black }: { white: number; draws: number; black: number }) {
  const total = white + draws + black;
  if (total === 0) return null;
  const wp = Math.round((white / total) * 100);
  const dp = Math.round((draws / total) * 100);
  const bp = 100 - wp - dp;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted)", marginTop: "2px" }}>
      <span style={{ color: "#ccc" }}>{wp}%</span>
      <span>{dp}%</span>
      <span style={{ color: "var(--muted)" }}>{bp}%</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function OpeningsView({ userId, games, onOpenAnalysis }: OpeningsViewProps) {
  const [repertoires, setRepertoires] = useState<RepertoireRecord[]>([]);
  const [activeSide, setActiveSide] = useState<RepertoireSide>("white");
  const [activeTab, setActiveTab] = useState<"build" | "drill" | "deviations" | "list">("build");
  const [lines, setLines] = useState<RepertoireLineNode[]>([]);
  const [loading, setLoading] = useState(true);

  // Board navigation state
  const [currentHistory, setCurrentHistory] = useState<Array<{ san: string; uci: string; node?: RepertoireLineNode }>>([]);
  const [moveComment, setMoveComment] = useState("");
  const [importPgnModal, setImportPgnModal] = useState(false);
  const [pgnInput, setPgnInput] = useState("");
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Drilling state
  const [drillActive, setDrillActive] = useState(false);
  const [drillChess, setDrillChess] = useState<Chess>(new Chess());
  const [drillEval, setDrillEval] = useState<{
    status: "correct" | "incorrect" | "out_of_book" | "idle";
    message: string;
  }>({ status: "idle", message: "" });
  const [drillSession, setDrillSession] = useState<{
    currentFen: string;
    currentNode: RepertoireTreeNode | null;
    total: number;
    correct: number;
    completed: boolean;
  }>({ currentFen: START_FEN, currentNode: null, total: 0, correct: 0, completed: false });

  // ── ECO Opening Data integration state ──────────────────────────────────────
  const [currentEco, setCurrentEco] = useState<EcoOpeningInfo | null>(null);
  const [theoreticalTransitions, setTheoreticalTransitions] = useState<TheoreticalMoveOption[]>([]);
  const [ecoSearchModal, setEcoSearchModal] = useState(false);
  const [ecoSearchQuery, setEcoSearchQuery] = useState("");
  const [ecoSearchResults, setEcoSearchResults] = useState<EcoOpeningInfo[]>([]);
  const [ecoSearching, setEcoSearching] = useState(false);

  // ── Openings Directory / Encyclopedia state ─────────────────────────────────
  const [listCategory, setListCategory] = useState<"all" | "A" | "B" | "C" | "D" | "E">("all");
  const [listRootsOnly, setListRootsOnly] = useState(true);
  const [listSearch, setListSearch] = useState("");
  const [listPage, setListPage] = useState(0);
  const [openingsList, setOpeningsList] = useState<{ items: EcoOpeningInfo[]; total: number }>({ items: [], total: 0 });
  const [listLoading, setListLoading] = useState(false);

  // Notation scroll ref
  const notationEndRef = useRef<HTMLDivElement>(null);

  // Board orientation flip & drill hint state
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [drillHint, setDrillHint] = useState<string | null>(null);

  const displayOrientation = useMemo(() => {
    if (boardFlipped) return activeSide === "white" ? "black" : "white";
    return activeSide;
  }, [activeSide, boardFlipped]);

  // Load repertoires on mount / user change
  const loadData = useCallback(async () => {
    setLoading(true);
    const uId = userId || "local-user";
    const reps = await createDefaultRepertoiresIfEmpty(uId);
    setRepertoires(reps);

    const activeRep = reps.find(r => r.side === activeSide) || reps[0];
    if (activeRep) {
      const repLines = await getRepertoireLines(activeRep.id, uId);
      setLines(repLines);
    }
    setLoading(false);
  }, [userId, activeSide]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Current active repertoire
  const currentRepertoire = useMemo(() => {
    return repertoires.find(r => r.side === activeSide) || repertoires[0];
  }, [repertoires, activeSide]);

  // Build tree from flat lines
  const repertoireTree = useMemo(() => {
    return buildRepertoireTree(lines);
  }, [lines]);

  // Build interactive chess instance from current move history
  const explorerChess = useMemo(() => {
    const c = new Chess();
    for (const m of currentHistory) {
      try {
        c.move(m.san);
      } catch {
        // ignore
      }
    }
    return c;
  }, [currentHistory]);

  // Current parent node ID (the last move in current history, or null if starting pos)
  const currentParentNode = useMemo(() => {
    if (currentHistory.length === 0) return null;
    return currentHistory[currentHistory.length - 1].node || null;
  }, [currentHistory]);

  // Available candidate repertoire moves from the current position
  const candidateMoves = useMemo(() => {
    const parentId = currentParentNode ? currentParentNode.id : null;
    return lines.filter(l => (l.parent_id ?? null) === parentId);
  }, [lines, currentParentNode]);

  // ── Offline Opening Book (Lichess CC0) ─────────────────────────────────────
  const book = useOpeningBook();

  // ── Lichess Explorer (live stats) ──────────────────────────────────────────
  const explorer = useExplorer(book ? explorerChess.fen() : null);
  const drillExplorer = useExplorer(activeTab === "drill" ? drillChess.fen() : null);

  // Identify opening & theoretical transitions from local opening book
  useEffect(() => {
    if (!book) return;
    const sans = explorerChess.history();
    const { opening } = identifyOpening(book, sans);
    setCurrentEco(opening ? { name: opening.name, eco: opening.eco, moves: opening.pgn } : null);

    const nexts = nextBookMoves(book, sans, 8);
    setTheoreticalTransitions(
      nexts.map(n => ({
        name: n.example.name,
        eco: n.example.eco,
        moves: n.example.pgn,
        san: n.san,
        lines: n.lines,
      }))
    );
  }, [book, explorerChess]);

  // Recognized opening during drill mode
  const drillEco = useMemo(() => {
    if (!book) return null;
    const { opening } = identifyOpening(book, drillChess.history());
    return opening ? { name: opening.name, eco: opening.eco, moves: opening.pgn } : null;
  }, [book, drillChess]);

  // Auto-scroll notation to bottom when history grows
  useEffect(() => {
    notationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentHistory.length]);

  // Search ECO Database handler (instant local search)
  const handleSearchEco = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!book || !ecoSearchQuery.trim()) return;
    setEcoSearching(true);
    const res = listOpenings(book, { query: ecoSearchQuery.trim(), limit: 20 });
    setEcoSearchResults(res.items.map(o => ({ name: o.name, eco: o.eco, moves: o.pgn })));
    setEcoSearching(false);
  };

  // Import line directly from ECO search result
  const handleImportEcoLine = async (moves: string, name: string) => {
    const uId = userId || "local-user";
    const imported = await importPgnToRepertoire(currentRepertoire.id, uId, moves, activeSide);
    setImportNotice(`Imported "${name}" (${imported} moves) into your ${activeSide} repertoire!`);
    setEcoSearchModal(false);
    const repLines = await getRepertoireLines(currentRepertoire.id, uId);
    setLines(repLines);
    setTimeout(() => setImportNotice(null), 4000);
  };

  // ── Openings Directory query effect (instant local filtering) ───────────────
  useEffect(() => {
    if (activeTab !== "list" || !book) return;
    setListLoading(true);

    if (listRootsOnly) {
      // Root openings: entries where the opening name has no ":" variation delimiter
      const allMatching = listOpenings(book, {
        category: listCategory,
        query: listSearch.trim(),
        limit: 9999,
        offset: 0,
      }).items.filter(item => !item.name.includes(":"));

      const total = allMatching.length;
      const paginated = allMatching.slice(listPage * 24, (listPage + 1) * 24);
      setOpeningsList({
        items: paginated.map(o => ({
          name: o.name,
          eco: o.eco,
          moves: o.pgn,
          isEcoRoot: true,
        })),
        total,
      });
    } else {
      const res = listOpenings(book, {
        category: listCategory,
        query: listSearch.trim(),
        offset: listPage * 24,
        limit: 24,
      });
      setOpeningsList({
        items: res.items.map(o => ({
          name: o.name,
          eco: o.eco,
          moves: o.pgn,
          isEcoRoot: !o.name.includes(":"),
        })),
        total: res.total,
      });
    }

    setListLoading(false);
  }, [activeTab, book, listCategory, listRootsOnly, listSearch, listPage]);

  // Preview opening from Directory on interactive board
  const handlePreviewOpening = (movesStr: string) => {
    const c = new Chess();
    const hist: Array<{ san: string; uci: string; node?: RepertoireLineNode }> = [];
    const sans = pgnToSan(movesStr);

    for (const s of sans) {
      try {
        const m = c.move(s);
        if (m) {
          hist.push({
            san: m.san,
            uci: `${m.from}${m.to}${m.promotion || ""}`
          });
        }
      } catch {
        break;
      }
    }
    setCurrentHistory(hist);
    setActiveTab("build");
  };

  // Add line to White or Black repertoire directly from Openings Directory
  const handleAddFromList = async (moves: string, name: string, targetSide: RepertoireSide) => {
    const uId = userId || "local-user";
    const targetRep = repertoires.find(r => r.side === targetSide) || currentRepertoire;
    const imported = await importPgnToRepertoire(targetRep.id, uId, moves, targetSide);
    setImportNotice(`Imported "${name}" (${imported} moves) into your ${targetSide.toUpperCase()} repertoire!`);
    if (targetSide === activeSide) {
      const repLines = await getRepertoireLines(targetRep.id, uId);
      setLines(repLines);
    }
    setTimeout(() => setImportNotice(null), 4000);
  };

  // Handle board move in Explorer mode
  const handleExplorerMove = (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
    try {
      const temp = new Chess(explorerChess.fen());
      const move = temp.move({ from, to, promotion: promotion || "q" });
      if (!move) return;

      const ply = currentHistory.length + 1;
      const isUserMove = activeSide === "white" ? move.color === "w" : move.color === "b";
      const uci = `${from}${to}${promotion || ""}`;

      // Check if move is already recorded
      const existing = candidateMoves.find(c => c.san === move.san || c.uci === uci);

      if (existing) {
        // Step into existing line
        setCurrentHistory(prev => [...prev, { san: move.san, uci, node: existing }]);
        setMoveComment(existing.comment || "");
      } else {
        // Add new move to repertoire automatically
        const uId = userId || "local-user";
        addRepertoireMove(currentRepertoire.id, uId, {
          parentId: currentParentNode ? currentParentNode.id : null,
          ply,
          fen: temp.fen(),
          san: move.san,
          uci,
          sideToMove: move.color === "w" ? "white" : "black",
          isUserMove,
          comment: "",
        }).then(newNode => {
          setLines(prev => [...prev, newNode]);
          setCurrentHistory(prev => [...prev, { san: move.san, uci, node: newNode }]);
          setMoveComment("");
        });
      }
    } catch {
      // invalid move
    }
  };

  // Navigate by clicking a theory move SAN
  const handleExplorerMoveFromSan = (san: string) => {
    try {
      const temp = new Chess(explorerChess.fen());
      const move = temp.move(san);
      if (!move) return;
      const uci = `${move.from}${move.to}${move.promotion || ""}`;
      // Check if already in repertoire
      const existing = candidateMoves.find(c => c.san === move.san || c.uci === uci);
      if (existing) {
        setCurrentHistory(prev => [...prev, { san: move.san, uci, node: existing }]);
        setMoveComment(existing.comment || "");
      } else {
        // Just navigate (don't add to repertoire automatically for theory moves)
        setCurrentHistory(prev => [...prev, { san: move.san, uci }]);
        setMoveComment("");
      }
    } catch { /* invalid */ }
  };

  // Add a specific move directly to repertoire tree from explorer or common moves
  const handleAddSanToRepertoire = async (san: string) => {
    try {
      const temp = new Chess(explorerChess.fen());
      const move = temp.move(san);
      if (!move) return;

      const ply = currentHistory.length + 1;
      const isUserMove = activeSide === "white" ? move.color === "w" : move.color === "b";
      const uci = `${move.from}${move.to}${move.promotion || ""}`;

      const existing = candidateMoves.find(c => c.san === move.san || c.uci === uci);
      if (existing) {
        setCurrentHistory(prev => [...prev, { san: move.san, uci, node: existing }]);
        setMoveComment(existing.comment || "");
        return;
      }

      const uId = userId || "local-user";
      const newNode = await addRepertoireMove(currentRepertoire.id, uId, {
        parentId: currentParentNode ? currentParentNode.id : null,
        ply,
        fen: temp.fen(),
        san: move.san,
        uci,
        sideToMove: move.color === "w" ? "white" : "black",
        isUserMove,
        comment: "",
      });

      setLines(prev => [...prev, newNode]);
      setCurrentHistory(prev => [...prev, { san: move.san, uci, node: newNode }]);
      setMoveComment("");
      setImportNotice(`Added "${move.san}" to your ${activeSide.toUpperCase()} repertoire!`);
      setTimeout(() => setImportNotice(null), 3500);
    } catch {
      // invalid move
    }
  };

  // Jump to specific point in explorer history
  const handleJumpToHistory = (index: number) => {
    if (index === -1) {
      setCurrentHistory([]);
      setMoveComment("");
      return;
    }
    const sliced = currentHistory.slice(0, index + 1);
    setCurrentHistory(sliced);
    const lastNode = sliced[sliced.length - 1]?.node;
    setMoveComment(lastNode?.comment || "");
  };

  // Delete current move and variations
  const handleDeleteCurrentMove = async () => {
    if (!currentParentNode) return;
    const uId = userId || "local-user";
    await deleteRepertoireMove(currentParentNode.id, uId);
    handleJumpToHistory(currentHistory.length - 2);
    const updated = await getRepertoireLines(currentRepertoire.id, uId);
    setLines(updated);
  };

  // Save comment on current node
  const handleSaveComment = async () => {
    if (!currentParentNode) return;
    const uId = userId || "local-user";
    const updatedNode = { ...currentParentNode, comment: moveComment };
    setLines(prev => prev.map(l => (l.id === updatedNode.id ? updatedNode : l)));
    // Add/update via addRepertoireMove duplicate handler
    await addRepertoireMove(currentRepertoire.id, uId, {
      parentId: updatedNode.parent_id,
      ply: updatedNode.ply,
      fen: updatedNode.fen,
      san: updatedNode.san,
      uci: updatedNode.uci,
      sideToMove: updatedNode.side_to_move,
      isUserMove: updatedNode.is_user_move,
      comment: moveComment,
    });
  };

  // PGN Import handler
  const handleImportPgn = async () => {
    if (!pgnInput.trim()) return;
    const uId = userId || "local-user";
    const importedCount = await importPgnToRepertoire(
      currentRepertoire.id,
      uId,
      pgnInput,
      activeSide
    );
    setImportNotice(`Successfully imported ${importedCount} move nodes into your ${activeSide} repertoire!`);
    setPgnInput("");
    setImportPgnModal(false);
    const repLines = await getRepertoireLines(currentRepertoire.id, uId);
    setLines(repLines);
    setTimeout(() => setImportNotice(null), 4000);
  };

  // PGN Export handler
  const handleExportPgn = () => {
    const pgn = exportTreeToPgn(repertoireTree, activeSide, currentRepertoire.title);
    const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSide}-repertoire.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Practice / Drilling Logic ──────────────────────────────────────────────

  const handleStartDrill = () => {
    setDrillHint(null);
    const { state, initialOpponentMove } = startDrillSession(repertoireTree, activeSide);
    const ch = new Chess(state.currentFen);
    setDrillChess(ch);
    setDrillSession({
      currentFen: state.currentFen,
      currentNode: state.currentNode,
      total: 0,
      correct: 0,
      completed: state.isCompleted,
    });
    setDrillEval({
      status: "idle",
      message: initialOpponentMove
        ? `Opponent opened with ${initialOpponentMove}. Your turn!`
        : "Your turn: Play your repertoire opening move.",
    });
    setDrillActive(true);
  };

  const handleShowDrillHint = () => {
    const availableCandidates = drillSession.currentNode === null
      ? repertoireTree
      : drillSession.currentNode.children;

    if (availableCandidates.length > 0) {
      const target = availableCandidates[0].node;
      const targetSan = target.san;
      const pieceName = targetSan.startsWith("N")
        ? "Knight"
        : targetSan.startsWith("B")
        ? "Bishop"
        : targetSan.startsWith("R")
        ? "Rook"
        : targetSan.startsWith("Q")
        ? "Queen"
        : targetSan.startsWith("K") || targetSan.startsWith("O")
        ? "King / Castling"
        : "Pawn";
      setDrillHint(`Expected: ${targetSan} (${pieceName})${target.comment ? ` — Note: ${target.comment}` : ""}`);
    } else {
      setDrillHint("No planned repertoire move recorded for this position.");
    }
  };

  const handleDrillMove = (from: Square, to: Square, promotion?: "q" | "r" | "b" | "n") => {
    try {
      setDrillHint(null);
      const temp = new Chess(drillChess.fen());
      const move = temp.move({ from, to, promotion: promotion || "q" });
      if (!move) return;

      const playedSan = move.san;
      const { evaluation, nextState } = submitDrillMove(
        {
          currentFen: drillSession.currentFen,
          historyMoves: [],
          currentNode: drillSession.currentNode,
          side: activeSide,
          totalSteps: drillSession.total,
          correctSteps: drillSession.correct,
          failedSteps: 0,
          isCompleted: false,
        },
        repertoireTree,
        playedSan
      );

      if (evaluation.status === "correct") {
        const updatedChess = new Chess(nextState.currentFen);
        setDrillChess(updatedChess);
        setDrillSession({
          currentFen: nextState.currentFen,
          currentNode: nextState.currentNode,
          total: nextState.totalSteps,
          correct: nextState.correctSteps,
          completed: nextState.isCompleted,
        });

        if (nextState.isCompleted) {
          setDrillEval({
            status: "correct",
            message: `✓ Correct (${playedSan})! Repertoire line completed!`,
          });
        } else {
          setDrillEval({
            status: "correct",
            message: `✓ Correct! Opponent replied ${evaluation.opponentReplySan}. Your turn!`,
          });
        }
      } else {
        // Incorrect
        setDrillEval({
          status: "incorrect",
          message: `✗ ${playedSan} is not in your repertoire. Expected: ${evaluation.expectedSan}${evaluation.comment ? ` (${evaluation.comment})` : ""}`,
        });
      }
    } catch {
      // invalid move
    }
  };

  // ── Deviations Detection ───────────────────────────────────────────────────

  const deviations = useMemo(() => {
    // Collect both white and black repertoire trees
    return detectAllDeviations(games, repertoireTree, repertoireTree);
  }, [games, repertoireTree]);

  // ── Notation panel: build paired move rows ─────────────────────────────────
  // Pairs moves into [white, black?] tuples for display
  const notationRows = useMemo(() => {
    const rows: Array<{
      moveNum: number;
      white: { san: string; idx: number };
      black: { san: string; idx: number } | null;
    }> = [];
    for (let i = 0; i < currentHistory.length; i += 2) {
      rows.push({
        moveNum: Math.floor(i / 2) + 1,
        white: { san: currentHistory[i].san, idx: i },
        black: i + 1 < currentHistory.length ? { san: currentHistory[i + 1].san, idx: i + 1 } : null,
      });
    }
    return rows;
  }, [currentHistory]);

  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="content" style={{ maxWidth: "1400px" }}>
      {/* Top Header */}
      <div className="welcome-row" style={{ marginBottom: "16px" }}>
        <div>
          <div className="eyebrow">
            <BookOpen size={13} /> OPENING REPERTOIRES (PHASE 7)
          </div>
          <h1>Repertoire Studio</h1>
          <p className="subheading">
            Build White and Black repertoire trees, practice active recall, and identify game deviations.
          </p>
        </div>

        {/* Repertoire Side Selector */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div className="tab-group" style={{ display: "flex", gap: "4px", background: "var(--sunken)", padding: "3px", borderRadius: "8px" }}>
            <button
              className={`button button-small ${activeSide === "white" ? "button-primary" : "button-ghost"}`}
              onClick={() => { setActiveSide("white"); setCurrentHistory([]); setDrillActive(false); }}
            >
              ♔ White Repertoire
            </button>
            <button
              className={`button button-small ${activeSide === "black" ? "button-primary" : "button-ghost"}`}
              onClick={() => { setActiveSide("black"); setCurrentHistory([]); setDrillActive(false); }}
            >
              ♚ Black Repertoire
            </button>
          </div>
        </div>
      </div>

      {importNotice && (
        <div style={{ padding: "10px 14px", background: "rgba(183,227,106,0.12)", border: "1px solid var(--lime)", borderRadius: "6px", color: "var(--lime)", marginBottom: "16px", fontSize: "13px" }}>
          <Check size={14} style={{ display: "inline", marginRight: "6px" }}/>
          {importNotice}
        </div>
      )}

      {/* Mode Navigation Tabs */}
      <div style={{ display: "flex", gap: "10px", borderBottom: "1px solid var(--border)", marginBottom: "18px", paddingBottom: "8px" }}>
        <button
          className={`tab-btn ${activeTab === "build" ? "active" : ""}`}
          onClick={() => { setActiveTab("build"); setDrillActive(false); }}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", border: "none", background: "none", cursor: "pointer", color: activeTab === "build" ? "var(--lime)" : "var(--muted)", fontWeight: activeTab === "build" ? 600 : 400 }}
        >
          <Layers size={14}/> Repertoire Tree ({lines.length} moves)
        </button>
        <button
          className={`tab-btn ${activeTab === "drill" ? "active" : ""}`}
          onClick={() => { setActiveTab("drill"); handleStartDrill(); }}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", border: "none", background: "none", cursor: "pointer", color: activeTab === "drill" ? "var(--lime)" : "var(--muted)", fontWeight: activeTab === "drill" ? 600 : 400 }}
        >
          <Play size={14}/> Practice &amp; Drill
        </button>
        <button
          className={`tab-btn ${activeTab === "deviations" ? "active" : ""}`}
          onClick={() => { setActiveTab("deviations"); setDrillActive(false); }}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", border: "none", background: "none", cursor: "pointer", color: activeTab === "deviations" ? "var(--lime)" : "var(--muted)", fontWeight: activeTab === "deviations" ? 600 : 400 }}
        >
          <Compass size={14}/> Game Deviations ({deviations.length})
        </button>
        <button
          className={`tab-btn ${activeTab === "list" ? "active" : ""}`}
          onClick={() => { setActiveTab("list"); setDrillActive(false); }}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", border: "none", background: "none", cursor: "pointer", color: activeTab === "list" ? "var(--lime)" : "var(--muted)", fontWeight: activeTab === "list" ? 600 : 400 }}
        >
          <List size={14}/> Openings Directory
        </button>
      </div>

      {/* ── Mode 1: Repertoire Tree Builder ──────────────────────────────── */}
      {activeTab === "build" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) minmax(180px, 260px) 1fr", gap: "20px", alignItems: "start" }}>

          {/* ── Column 1: Board + controls ─────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="panel" style={{ padding: "16px" }}>
              <BoardView
                game={explorerChess}
                orientation={displayOrientation}
                onMove={handleExplorerMove}
                interactive={true}
              />
              {/* Navigation & Flip Toolbar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", paddingTop: "8px", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    className="button button-ghost button-small"
                    disabled={currentHistory.length === 0}
                    onClick={() => handleJumpToHistory(-1)}
                    title="Jump to Start"
                    style={{ padding: "3px 8px", fontSize: "11px" }}
                  >
                    ⏮ Start
                  </button>
                  <button
                    className="button button-ghost button-small"
                    disabled={currentHistory.length === 0}
                    onClick={() => handleJumpToHistory(currentHistory.length - 2)}
                    title="Step Back 1 Move"
                    style={{ padding: "3px 8px", fontSize: "11px" }}
                  >
                    ◀ Back
                  </button>
                  <button
                    className="button button-ghost button-small"
                    onClick={() => setBoardFlipped(f => !f)}
                    title="Flip Board Orientation"
                    style={{ padding: "3px 8px", fontSize: "11px" }}
                  >
                    🔄 Flip
                  </button>
                </div>
                <div style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 500 }}>
                  {explorerChess.turn() === "w" ? "⚪ White to move" : "⚫ Black to move"}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="panel" style={{ padding: "12px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
              <button
                className="button button-secondary button-small"
                onClick={() => { setEcoSearchModal(true); setEcoSearchResults([]); setEcoSearchQuery(""); }}
                title="Search canonical openings in offline book"
                style={{ flex: 1, minWidth: "105px", fontSize: "11px" }}
              >
                <Search size={12}/> Search ECO
              </button>
              <button className="button button-secondary button-small" onClick={() => setImportPgnModal(true)} title="Import PGN into repertoire" style={{ flex: 1, minWidth: "105px", fontSize: "11px" }}>
                <Upload size={12}/> Import PGN
              </button>
              <button className="button button-secondary button-small" onClick={handleExportPgn} title="Export repertoire to PGN" style={{ flex: 1, minWidth: "105px", fontSize: "11px" }}>
                <Download size={12}/> Export PGN
              </button>
            </div>
          </div>

          {/* ── Column 2: Move Notation + ECO info + Notes ─────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="panel" style={{ padding: "14px" }}>
              <div className="eyebrow" style={{ marginBottom: "8px" }}>MOVE LIST</div>

              {/* Scrollable notation list */}
              <div style={{ maxHeight: "280px", overflowY: "auto", fontFamily: "monospace", fontSize: "13px" }}>
                {/* Start row */}
                <div
                  style={{
                    padding: "3px 6px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    color: currentHistory.length === 0 ? "var(--lime)" : "var(--muted)",
                    fontWeight: currentHistory.length === 0 ? 700 : 400,
                    marginBottom: "2px",
                  }}
                  onClick={() => handleJumpToHistory(-1)}
                >
                  Start
                </div>

                {/* Numbered move rows */}
                {notationRows.map(row => (
                  <div key={row.moveNum} style={{ display: "flex", alignItems: "center", marginBottom: "1px" }}>
                    <span style={{ color: "var(--muted)", minWidth: "28px", fontSize: "11px", paddingRight: "4px", textAlign: "right" }}>
                      {row.moveNum}.
                    </span>
                    {/* White move */}
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "3px",
                        cursor: "pointer",
                        minWidth: "52px",
                        color: row.white.idx === currentHistory.length - 1 ? "var(--lime)" : "var(--fg)",
                        fontWeight: row.white.idx === currentHistory.length - 1 ? 700 : 400,
                        background: row.white.idx === currentHistory.length - 1 ? "rgba(183,227,106,0.1)" : "transparent",
                      }}
                      onClick={() => handleJumpToHistory(row.white.idx)}
                    >
                      {row.white.san}
                    </span>
                    {/* Black move */}
                    {row.black && (
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: "3px",
                          cursor: "pointer",
                          minWidth: "52px",
                          color: row.black.idx === currentHistory.length - 1 ? "var(--lime)" : "var(--fg)",
                          fontWeight: row.black.idx === currentHistory.length - 1 ? 700 : 400,
                          background: row.black.idx === currentHistory.length - 1 ? "rgba(183,227,106,0.1)" : "transparent",
                        }}
                        onClick={() => handleJumpToHistory(row.black!.idx)}
                      >
                        {row.black.san}
                      </span>
                    )}
                  </div>
                ))}
                <div ref={notationEndRef} />
              </div>

              {/* ECO badge below move list */}
              {currentEco && (
                <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <span
                      style={{
                        background: "rgba(183,227,106,0.18)",
                        color: "var(--lime)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontWeight: 700,
                        fontSize: "11px",
                        fontFamily: "monospace",
                        border: "1px solid rgba(183,227,106,0.3)"
                      }}
                    >
                      {currentEco.eco}
                    </span>
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>{currentEco.name}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Notes editor — only when a node is selected */}
            {currentParentNode && (
              <div className="panel" style={{ padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div className="eyebrow" style={{ fontSize: "10px" }}>NOTES FOR {currentParentNode.san}</div>
                  <button
                    className="button button-ghost button-small"
                    onClick={handleDeleteCurrentMove}
                    style={{ color: "var(--red, #f87171)", fontSize: "10px" }}
                    title="Delete this move and all sub-variations"
                  >
                    <Trash2 size={11}/> Delete
                  </button>
                </div>
                <textarea
                  className="input"
                  rows={3}
                  value={moveComment}
                  onChange={e => setMoveComment(e.target.value)}
                  placeholder="Explain the plan, ideas, or tactical motifs behind this move..."
                  style={{ width: "100%", fontSize: "12px", marginBottom: "8px" }}
                />
                <button className="button button-primary button-small" onClick={handleSaveComment}>
                  Save Notes
                </button>
              </div>
            )}
          </div>

          {/* ── Column 3: Candidate moves + Theory continuations ───────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

            {/* YOUR MOVES panel */}
            <div className="panel" style={{ padding: "14px" }}>
              <div className="eyebrow" style={{ marginBottom: "10px" }}>
                {explorerChess.turn() === (activeSide === "white" ? "w" : "b")
                  ? "YOUR MOVES"
                  : "OPPONENT REPLIES"}
              </div>

              {candidateMoves.length === 0 ? (
                <div style={{ padding: "14px", textAlign: "center", background: "var(--sunken)", borderRadius: "6px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: "12px", color: "var(--muted)" }}>
                    No planned moves from this position yet.
                  </p>
                  <span style={{ fontSize: "11px", color: "var(--lime)" }}>
                    Play a move on the board to record it!
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {candidateMoves.map(candidate => {
                    const expMove = explorer.data?.moves.find(m => m.san === candidate.san);
                    return (
                      <div
                        key={candidate.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 12px",
                          background: "var(--raised)",
                          borderRadius: "6px",
                          cursor: "pointer",
                          border: "1px solid var(--border)",
                        }}
                        onClick={() => {
                          setCurrentHistory(prev => [...prev, { san: candidate.san, uci: candidate.uci, node: candidate }]);
                          setMoveComment(candidate.comment || "");
                        }}
                      >
                        <span style={{ fontSize: "16px", fontFamily: "monospace", fontWeight: 700, color: "var(--lime)", minWidth: "40px" }}>
                          {candidate.san}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "12px", color: "var(--muted)", fontStyle: candidate.comment ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {candidate.comment || "No notes"}
                          </div>
                          {expMove && (
                            <div style={{ marginTop: "4px" }}>
                              <WinBar white={expMove.white} draws={expMove.draws} black={expMove.black} />
                              <WinBarLabels white={expMove.white} draws={expMove.draws} black={expMove.black} />
                            </div>
                          )}
                        </div>
                        <button
                          className="button button-ghost button-small"
                          style={{ fontSize: "12px", flexShrink: 0 }}
                          onClick={e => {
                            e.stopPropagation();
                            setCurrentHistory(prev => [...prev, { san: candidate.san, uci: candidate.uci, node: candidate }]);
                            setMoveComment(candidate.comment || "");
                          }}
                        >
                          →
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* POPULAR DATABASE MOVES & WIN RATES (LICHESS) */}
            {explorer.data && explorer.data.moves && explorer.data.moves.length > 0 && (
              <div className="panel" style={{ padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>POPULAR MOVES &amp; WIN RATES</span>
                    <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "none" }}>(Lichess Database)</span>
                  </div>
                  {explorer.loading && (
                    <Activity size={12} style={{ color: "var(--muted)", animation: "spin 1s linear infinite" }} />
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {explorer.data.moves.slice(0, 6).map((m, idx) => {
                    const total = m.white + m.draws + m.black;
                    const inRepertoire = candidateMoves.some(c => c.san === m.san);
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: "8px 12px",
                          background: inRepertoire ? "rgba(183,227,106,0.06)" : "var(--sunken)",
                          border: inRepertoire ? "1px solid rgba(183,227,106,0.3)" : "1px solid transparent",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                        onClick={() => handleExplorerMoveFromSan(m.san)}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <strong style={{ fontSize: "15px", fontFamily: "monospace", color: inRepertoire ? "var(--lime)" : "var(--fg)", minWidth: "36px" }}>
                              {m.san}
                            </strong>
                            {inRepertoire && (
                              <span style={{ fontSize: "9px", background: "rgba(183,227,106,0.18)", color: "var(--lime)", padding: "1px 5px", borderRadius: "3px", fontWeight: 700 }}>
                                IN REPERTOIRE
                              </span>
                            )}
                            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                              {(total / 1000).toFixed(total >= 1000000 ? 0 : 1)}k games
                              {m.averageRating ? ` · ~${m.averageRating}` : ""}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            {!inRepertoire && (
                              <button
                                className="button button-ghost button-small"
                                style={{ fontSize: "10px", padding: "2px 8px", color: "var(--lime)" }}
                                onClick={e => {
                                  e.stopPropagation();
                                  handleAddSanToRepertoire(m.san);
                                }}
                                title="Add this move directly to your repertoire tree"
                              >
                                + Repertoire
                              </button>
                            )}
                          </div>
                        </div>
                        <WinBar white={m.white} draws={m.draws} black={m.black} />
                        <WinBarLabels white={m.white} draws={m.draws} black={m.black} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* THEORY CONTINUATIONS panel */}
            {theoreticalTransitions.length > 0 && (
              <div className="panel" style={{ padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div className="eyebrow">THEORY CONTINUATIONS (OFFLINE BOOK)</div>
                  {explorer.loading && (
                    <Activity size={12} style={{ color: "var(--muted)", animation: "spin 1s linear infinite" }} />
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {theoreticalTransitions.map((t, idx) => {
                    const expMove = explorer.data?.moves.find(m => m.san === t.san);
                    const total = expMove ? expMove.white + expMove.draws + expMove.black : 0;
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: "8px 12px",
                          background: "var(--sunken)",
                          borderRadius: "6px",
                          marginBottom: "0",
                          cursor: "pointer",
                        }}
                        onClick={() => t.san && handleExplorerMoveFromSan(t.san)}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: expMove ? "4px" : "0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                            {t.san && (
                              <strong style={{ fontSize: "15px", fontFamily: "monospace", color: "var(--lime)", minWidth: "36px", flexShrink: 0 }}>
                                {t.san}
                              </strong>
                            )}
                            <span style={{ fontSize: "10px", background: "rgba(183,227,106,0.15)", color: "var(--lime)", padding: "1px 5px", borderRadius: "3px", fontWeight: 700, flexShrink: 0 }}>
                              {t.eco}
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {t.name}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                            {total > 0 && (
                              <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                                {(total / 1000).toFixed(1)}k
                              </span>
                            )}
                            <button
                              className="button button-ghost button-small"
                              style={{ fontSize: "10px", padding: "2px 6px" }}
                              onClick={e => { e.stopPropagation(); handleImportEcoLine(t.moves, t.name); }}
                              title="Import this theoretical line into your repertoire"
                            >
                              + Add Line
                            </button>
                          </div>
                        </div>
                        {expMove && (
                          <>
                            <WinBar white={expMove.white} draws={expMove.draws} black={expMove.black} />
                            <WinBarLabels white={expMove.white} draws={expMove.draws} black={expMove.black} />
                          </>
                        )}
                        {!expMove && explorer.loading && (
                          <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px" }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Explorer aggregate stats (position total) */}
            {explorer.data && (explorer.data.white + explorer.data.draws + explorer.data.black) > 0 && (
              <div className="panel" style={{ padding: "12px 14px" }}>
                <div className="eyebrow" style={{ marginBottom: "6px" }}>POSITION STATS (LICHESS)</div>
                <WinBar white={explorer.data.white} draws={explorer.data.draws} black={explorer.data.black} />
                <WinBarLabels white={explorer.data.white} draws={explorer.data.draws} black={explorer.data.black} />
                <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "4px", textAlign: "right" }}>
                  {((explorer.data.white + explorer.data.draws + explorer.data.black) / 1000).toFixed(1)}k games
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Mode 2: Interactive Practice & Drill ────────────────────────── */}
      {activeTab === "drill" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 480px) 1fr", gap: "24px" }}>
          <div>
            <div className="panel" style={{ padding: "16px" }}>
              <BoardView
                game={drillChess}
                orientation={activeSide}
                onMove={handleDrillMove}
                interactive={!drillSession.completed}
              />
              {/* Show current opening name on drill board */}
              {drillEco && (
                <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{
                    background: "rgba(183,227,106,0.18)",
                    color: "var(--lime)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontWeight: 700,
                    fontSize: "10px",
                    fontFamily: "monospace",
                  }}>
                    {drillEco.eco}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>{drillEco.name}</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="panel" style={{ padding: "18px" }}>
              <div className="eyebrow">ACTIVE RECALL PRACTICE</div>
              <h2 style={{ fontSize: "16px", margin: "4px 0 10px" }}>
                Drill {activeSide === "white" ? "White" : "Black"} Repertoire
              </h2>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 16px" }}>
                Play your prepared repertoire moves on the board. ChessForge responds automatically with candidate opponent moves.
              </p>

              {/* Status Banner */}
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  fontSize: "13px",
                  background:
                    drillEval.status === "correct"
                      ? "rgba(183,227,106,0.12)"
                      : drillEval.status === "incorrect"
                      ? "rgba(248,113,113,0.12)"
                      : "var(--raised)",
                  color:
                    drillEval.status === "correct"
                      ? "var(--lime)"
                      : drillEval.status === "incorrect"
                      ? "#f87171"
                      : "var(--fg)",
                  border: `1px solid ${
                    drillEval.status === "correct"
                      ? "var(--lime)"
                      : drillEval.status === "incorrect"
                      ? "#f87171"
                      : "var(--border)"
                  }`,
                }}
              >
                {drillEval.message || "Ready to drill."}
              </div>

              {/* Hint Box if requested */}
              {drillHint && (
                <div style={{ padding: "10px 14px", background: "rgba(183,227,106,0.1)", border: "1px dashed var(--lime)", borderRadius: "6px", marginBottom: "14px", fontSize: "12px", color: "var(--lime)" }}>
                  💡 {drillHint}
                </div>
              )}

              {/* Drill Score Card */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div className="panel" style={{ padding: "12px", textAlign: "center", background: "var(--sunken)" }}>
                  <div className="eyebrow">MOVES TESTED</div>
                  <div style={{ fontSize: "20px", fontWeight: 700 }}>{drillSession.total}</div>
                </div>
                <div className="panel" style={{ padding: "12px", textAlign: "center", background: "var(--sunken)" }}>
                  <div className="eyebrow">ACCURACY</div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--lime)" }}>
                    {drillSession.total > 0 ? `${Math.round((drillSession.correct / drillSession.total) * 100)}%` : "—"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button className="button button-primary" onClick={handleStartDrill} style={{ flex: 1 }}>
                  <RotateCcw size={14}/> Restart Drill
                </button>
                {!drillSession.completed && (
                  <button className="button button-secondary" onClick={handleShowDrillHint} title="Show hint for expected repertoire move">
                    💡 Hint
                  </button>
                )}
              </div>
            </div>

            {/* Practice Move Suggestions & Win Percentages */}
            {drillExplorer.data && drillExplorer.data.moves && drillExplorer.data.moves.length > 0 && (
              <div className="panel" style={{ padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>COMMON MOVES &amp; WIN RATES</span>
                    <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "none" }}>(Position Context)</span>
                  </div>
                  {drillExplorer.loading && (
                    <Activity size={12} style={{ color: "var(--muted)", animation: "spin 1s linear infinite" }} />
                  )}
                </div>
                <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 10px" }}>
                  Most common continuations played from this position across online games:
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {drillExplorer.data.moves.slice(0, 4).map((m, idx) => {
                    const total = m.white + m.draws + m.black;
                    return (
                      <div key={idx} style={{ padding: "8px 12px", background: "var(--sunken)", borderRadius: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                          <strong style={{ fontSize: "14px", fontFamily: "monospace", color: "var(--lime)" }}>{m.san}</strong>
                          <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                            {(total / 1000).toFixed(total >= 1000000 ? 0 : 1)}k games
                          </span>
                        </div>
                        <WinBar white={m.white} draws={m.draws} black={m.black} />
                        <WinBarLabels white={m.white} draws={m.draws} black={m.black} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Mode 3: Game Deviations Report ──────────────────────────────── */}
      {activeTab === "deviations" && (
        <div className="panel" style={{ padding: "20px" }}>
          <div style={{ marginBottom: "16px" }}>
            <div className="eyebrow">REPERTOIRE DEVIATION ALERTS</div>
            <h2 style={{ fontSize: "16px", margin: "4px 0" }}>Games Leaving Your Preparation</h2>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
              Scans your library games played on Chess.com and Lichess to identify the exact move where you departed from your opening repertoire.
            </p>
          </div>

          {deviations.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
              ✓ No opening deviations detected in your recorded games! You played according to your repertoire in all book positions.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {deviations.map((dev, idx) => {
                const gameMatch = games.find(g => g.id === dev.gameId);
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "var(--raised)",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      fontSize: "12px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                        {dev.gameWhite} vs {dev.gameBlack} ({dev.userColour === "white" ? "Played as White" : "Played as Black"})
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: "11px" }}>
                        Deviated on move <strong>{dev.moveNumber}</strong> (ply {dev.ply}): played{" "}
                        <span style={{ color: "#f87171", fontWeight: 600 }}>{dev.playedSan}</span> instead of planned{" "}
                        <span style={{ color: "var(--lime)", fontWeight: 600 }}>{dev.expectedSan}</span>.
                      </div>
                    </div>
                    {gameMatch && onOpenAnalysis && (
                      <button
                        className="button button-secondary button-small"
                        onClick={() => onOpenAnalysis(gameMatch)}
                      >
                        Inspect in Analysis <ArrowRight size={12}/>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Mode 4: Openings Directory / Encyclopedia ─────────────────── */}
      {activeTab === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header & Category Filter Bar */}
          <div className="panel" style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <BookOpenCheck size={18} style={{ color: "var(--lime)" }}/> ECO Openings Directory
                </h3>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Browse, preview, and build repertoires from over 16,000 canonical openings and variations.
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                {/* Search Box */}
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type="text"
                    value={listSearch}
                    onChange={e => { setListSearch(e.target.value); setListPage(0); }}
                    placeholder="Search name, ECO, moves…"
                    style={{ fontSize: "12px", paddingLeft: "28px", width: "220px", height: "32px" }}
                  />
                  <Search size={13} style={{ position: "absolute", left: "9px", top: "10px", color: "var(--muted)" }}/>
                  {listSearch && (
                    <button
                      onClick={() => { setListSearch(""); setListPage(0); }}
                      style={{ position: "absolute", right: "8px", top: "7px", background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "12px" }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Roots vs All Toggle */}
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={listRootsOnly}
                    onChange={e => { setListRootsOnly(e.target.checked); setListPage(0); }}
                  />
                  <span>Root openings only</span>
                </label>
              </div>
            </div>

            {/* ECO Category Filter Tabs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              <button
                className={`button button-small ${listCategory === "all" ? "button-primary" : "button-ghost"}`}
                onClick={() => { setListCategory("all"); setListPage(0); }}
                style={{ fontSize: "11px" }}
              >
                All Volumes
              </button>
              {ECO_CATEGORIES.map(cat => (
                <button
                  key={cat.code}
                  className={`button button-small ${listCategory === cat.code ? "button-primary" : "button-ghost"}`}
                  onClick={() => { setListCategory(cat.code); setListPage(0); }}
                  title={`${cat.description} (e.g. ${cat.examples})`}
                  style={{ fontSize: "11px" }}
                >
                  <strong>{cat.code}:</strong> {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Openings Grid / Card List */}
          <div className="panel" style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div className="eyebrow">
                {listLoading
                  ? "LOADING OPENINGS…"
                  : `FOUND ${openingsList.total.toLocaleString()} OPENING${openingsList.total === 1 ? "" : "S"}`}
              </div>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                Showing page {listPage + 1} of {Math.max(1, Math.ceil(openingsList.total / 24))}
              </span>
            </div>

            {listLoading ? (
              <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                <Activity size={20} className="spin" style={{ display: "inline-block", marginRight: "8px", verticalAlign: "middle" }}/>
                Loading openings from offline book…
              </div>
            ) : openingsList.items.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                No openings found matching your criteria. Try adjusting the search term or category filter.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "12px" }}>
                {openingsList.items.map((op, idx) => (
                  <div
                    key={`${op.eco}-${idx}`}
                    style={{
                      background: "var(--raised)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "10px"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span
                            style={{
                              background: "rgba(183,227,106,0.18)",
                              color: "var(--lime)",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontWeight: 700,
                              fontSize: "11px",
                              fontFamily: "monospace",
                              border: "1px solid rgba(183,227,106,0.3)"
                            }}
                          >
                            {op.eco}
                          </span>
                          {op.isEcoRoot && (
                            <span style={{ fontSize: "10px", background: "var(--sunken)", color: "var(--muted)", padding: "1px 5px", borderRadius: "3px" }}>
                              Root
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                          Vol. {op.eco.charAt(0)}
                        </span>
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "4px", lineHeight: "1.3" }}>
                        {op.name}
                      </div>
                      <div style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--muted)", wordBreak: "break-word" }}>
                        {op.moves}
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div style={{ display: "flex", gap: "6px", borderTop: "1px solid var(--border)", paddingTop: "8px", justifyContent: "flex-end" }}>
                      <button
                        className="button button-ghost button-small"
                        onClick={() => handlePreviewOpening(op.moves)}
                        title="Preview move sequence on the interactive explorer board"
                        style={{ fontSize: "11px", padding: "4px 8px" }}
                      >
                        <Eye size={12}/> Preview
                      </button>
                      <button
                        className="button button-secondary button-small"
                        onClick={() => handleAddFromList(op.moves, op.name, "white")}
                        title="Add this opening to your White Repertoire"
                        style={{ fontSize: "11px", padding: "4px 8px" }}
                      >
                        <Plus size={12}/> White
                      </button>
                      <button
                        className="button button-secondary button-small"
                        onClick={() => handleAddFromList(op.moves, op.name, "black")}
                        title="Add this opening to your Black Repertoire"
                        style={{ fontSize: "11px", padding: "4px 8px" }}
                      >
                        <Plus size={12}/> Black
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {!listLoading && openingsList.total > 24 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "18px", paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
                <button
                  className="button button-secondary button-small"
                  disabled={listPage === 0}
                  onClick={() => setListPage(p => Math.max(0, p - 1))}
                >
                  ← Previous Page
                </button>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Page {listPage + 1} of {Math.max(1, Math.ceil(openingsList.total / 24))} ({openingsList.total.toLocaleString()} total)
                </span>
                <button
                  className="button button-secondary button-small"
                  disabled={(listPage + 1) * 24 >= openingsList.total}
                  onClick={() => setListPage(p => p + 1)}
                >
                  Next Page →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Search Canonical Openings ─────────────────────────────── */}
      {ecoSearchModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: "600px", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <h3 style={{ margin: "0 0 8px" }}>Search Canonical Openings (Offline Book)</h3>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 12px" }}>
              Search across 3,800+ official chess openings from Lichess (CC0). Select any line to import it directly into your {activeSide.toUpperCase()} repertoire.
            </p>

            <form onSubmit={handleSearchEco} style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              <input
                className="input"
                type="text"
                value={ecoSearchQuery}
                onChange={e => setEcoSearchQuery(e.target.value)}
                placeholder='e.g. "Sicilian", "Caro-Kann", "B12", "Ruy Lopez"'
                style={{ flex: 1, fontSize: "13px" }}
                autoFocus
              />
              <button className="button button-primary" type="submit" disabled={ecoSearching}>
                <Search size={14}/> {ecoSearching ? "Searching…" : "Search"}
              </button>
            </form>

            {/* Results List */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "360px", paddingRight: "4px" }}>
              {ecoSearchResults.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
                  {ecoSearchQuery ? "No openings found. Try a broader search term or ECO code." : "Type an opening name or code above to search."}
                </div>
              ) : (
                ecoSearchResults.map((op, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: "var(--raised)",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                      fontSize: "12px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ background: "rgba(183,227,106,0.18)", color: "var(--lime)", padding: "1px 5px", borderRadius: "3px", fontWeight: 700, fontSize: "11px" }}>
                          {op.eco}
                        </span>
                        <strong style={{ fontSize: "13px" }}>{op.name}</strong>
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: "11px", fontFamily: "monospace" }}>
                        {op.moves}
                      </div>
                    </div>
                    <button
                      className="button button-secondary button-small"
                      onClick={() => handleImportEcoLine(op.moves, op.name)}
                    >
                      Import Line <ArrowRight size={12}/>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
              <button className="button button-ghost" onClick={() => setEcoSearchModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Import PGN into Repertoire ────────────────────────────── */}
      {importPgnModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: "500px" }}>
            <h3 style={{ margin: "0 0 10px" }}>Import Lines into {activeSide.toUpperCase()} Repertoire</h3>
            <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 14px" }}>
              Paste a PGN game, study, or line. All moves will be merged into your repertoire tree.
            </p>
            <textarea
              className="input"
              rows={6}
              value={pgnInput}
              onChange={e => setPgnInput(e.target.value)}
              placeholder='1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6...'
              style={{ width: "100%", fontSize: "12px", marginBottom: "14px" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button className="button button-ghost" onClick={() => setImportPgnModal(false)}>
                Cancel
              </button>
              <button className="button button-primary" onClick={handleImportPgn}>
                Import Lines
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
