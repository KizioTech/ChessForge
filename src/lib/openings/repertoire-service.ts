/**
 * Repertoire Service — Database CRUD with LocalStorage dual-layer fallback.
 */

import { supabase, isSupabaseConfigured } from "../supabase";
import type { RepertoireRecord, RepertoireLineNode, RepertoireSide } from "./types";
import { pgnToRepertoireNodes, normalizeFen } from "./repertoire-tree";

const LS_REPERTOIRES_KEY = "chessforge:repertoires_v1";
const LS_LINES_KEY = "chessforge:repertoire_lines_v1";

// ── LocalStorage Helpers ─────────────────────────────────────────────────────

function lsGetRepertoires(): RepertoireRecord[] {
  try {
    const raw = localStorage.getItem(LS_REPERTOIRES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function lsSaveRepertoires(items: RepertoireRecord[]): void {
  try {
    localStorage.setItem(LS_REPERTOIRES_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

function lsGetLines(): RepertoireLineNode[] {
  try {
    const raw = localStorage.getItem(LS_LINES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function lsSaveLines(items: RepertoireLineNode[]): void {
  try {
    localStorage.setItem(LS_LINES_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

// ── Repertoire Container Operations ──────────────────────────────────────────

export async function getRepertoires(userId?: string | null): Promise<RepertoireRecord[]> {
  if (isSupabaseConfigured && userId) {
    const { data, error } = await supabase
      .from("opening_repertoires")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data) return data as RepertoireRecord[];
    if (error) console.warn("Failed to fetch remote repertoires:", error.message);
  }

  const local = lsGetRepertoires().filter(r => !userId || r.user_id === userId);
  return local;
}

export async function createDefaultRepertoiresIfEmpty(
  userId: string
): Promise<RepertoireRecord[]> {
  let existing = await getRepertoires(userId);
  if (existing.length > 0) return existing;

  const now = new Date().toISOString();
  const whiteRep: RepertoireRecord = {
    id: crypto.randomUUID ? crypto.randomUUID() : `rep_white_${Date.now()}`,
    user_id: userId,
    side: "white",
    title: "White Repertoire",
    description: "My main opening repertoire as White",
    created_at: now,
    updated_at: now,
  };

  const blackRep: RepertoireRecord = {
    id: crypto.randomUUID ? crypto.randomUUID() : `rep_black_${Date.now()}`,
    user_id: userId,
    side: "black",
    title: "Black Repertoire",
    description: "My main opening repertoire as Black",
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured && userId) {
    await supabase.from("opening_repertoires").insert([whiteRep, blackRep]);
  }

  const all = [...lsGetRepertoires(), whiteRep, blackRep];
  lsSaveRepertoires(all);
  return [whiteRep, blackRep];
}

export async function upsertRepertoire(
  repertoire: Omit<RepertoireRecord, "created_at" | "updated_at">,
  userId: string
): Promise<RepertoireRecord> {
  const now = new Date().toISOString();
  const fullRecord: RepertoireRecord = {
    ...repertoire,
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured && userId) {
    const { data, error } = await supabase
      .from("opening_repertoires")
      .upsert(fullRecord)
      .select()
      .single();
    if (!error && data) return data as RepertoireRecord;
  }

  const existing = lsGetRepertoires();
  const idx = existing.findIndex(r => r.id === repertoire.id);
  if (idx >= 0) existing[idx] = fullRecord;
  else existing.push(fullRecord);
  lsSaveRepertoires(existing);
  return fullRecord;
}

export async function deleteRepertoire(id: string, userId: string): Promise<boolean> {
  if (isSupabaseConfigured && userId) {
    await supabase.from("opening_repertoires").delete().eq("id", id).eq("user_id", userId);
  }
  const remaining = lsGetRepertoires().filter(r => r.id !== id);
  lsSaveRepertoires(remaining);

  // Also remove lines
  const remainingLines = lsGetLines().filter(l => l.repertoire_id !== id);
  lsSaveLines(remainingLines);
  return true;
}

// ── Repertoire Lines Operations ──────────────────────────────────────────────

export async function getRepertoireLines(
  repertoireId: string,
  userId?: string | null
): Promise<RepertoireLineNode[]> {
  if (isSupabaseConfigured && userId) {
    const { data, error } = await supabase
      .from("opening_lines")
      .select("*")
      .eq("repertoire_id", repertoireId)
      .order("ply", { ascending: true });
    if (!error && data) return data as RepertoireLineNode[];
  }

  return lsGetLines().filter(l => l.repertoire_id === repertoireId);
}

export async function addRepertoireMove(
  repertoireId: string,
  userId: string,
  moveData: {
    parentId: string | null;
    ply: number;
    fen: string;
    san: string;
    uci: string;
    sideToMove: "white" | "black";
    isUserMove: boolean;
    comment?: string;
  }
): Promise<RepertoireLineNode> {
  const normFen = normalizeFen(moveData.fen);
  const now = new Date().toISOString();

  // Check if this move already exists under this parent
  const existing = await getRepertoireLines(repertoireId, userId);
  const duplicate = existing.find(
    l => l.parent_id === moveData.parentId && (l.san === moveData.san || l.uci === moveData.uci)
  );
  if (duplicate) {
    return duplicate;
  }

  const newNode: RepertoireLineNode = {
    id: crypto.randomUUID ? crypto.randomUUID() : `line_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    repertoire_id: repertoireId,
    user_id: userId,
    parent_id: moveData.parentId,
    ply: moveData.ply,
    fen: normFen,
    san: moveData.san,
    uci: moveData.uci,
    side_to_move: moveData.sideToMove,
    is_user_move: moveData.isUserMove,
    comment: moveData.comment || "",
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured && userId) {
    await supabase.from("opening_lines").insert(newNode);
  }

  const allLines = lsGetLines();
  allLines.push(newNode);
  lsSaveLines(allLines);
  return newNode;
}

export async function deleteRepertoireMove(
  lineId: string,
  userId: string
): Promise<boolean> {
  // Deleting a node recursively removes all its children
  const all = await getRepertoireLines("", userId);
  const toDelete = new Set<string>([lineId]);

  let addedMore = true;
  while (addedMore) {
    addedMore = false;
    for (const l of all) {
      if (l.parent_id && toDelete.has(l.parent_id) && !toDelete.has(l.id)) {
        toDelete.add(l.id);
        addedMore = true;
      }
    }
  }

  if (isSupabaseConfigured && userId) {
    await supabase.from("opening_lines").delete().in("id", Array.from(toDelete));
  }

  const remaining = lsGetLines().filter(l => !toDelete.has(l.id));
  lsSaveLines(remaining);
  return true;
}

export async function importPgnToRepertoire(
  repertoireId: string,
  userId: string,
  pgnText: string,
  side: RepertoireSide
): Promise<number> {
  const newNodes = pgnToRepertoireNodes(pgnText, repertoireId, userId, side);
  if (newNodes.length === 0) return 0;

  const existing = await getRepertoireLines(repertoireId, userId);
  const existingSet = new Set(existing.map(l => `${l.parent_id ?? "root"}:${l.san}`));

  const toInsert: RepertoireLineNode[] = [];
  let currentParentId: string | null = null;

  for (const n of newNodes) {
    const key = `${currentParentId ?? "root"}:${n.san}`;
    const match = existing.find(
      e => (e.parent_id ?? null) === currentParentId && e.san === n.san
    );

    if (match) {
      currentParentId = match.id;
    } else {
      const nodeToSave: RepertoireLineNode = {
        ...n,
        parent_id: currentParentId,
      };
      toInsert.push(nodeToSave);
      currentParentId = nodeToSave.id;
    }
  }

  if (toInsert.length > 0) {
    if (isSupabaseConfigured && userId) {
      await supabase.from("opening_lines").insert(toInsert);
    }
    const all = lsGetLines();
    all.push(...toInsert);
    lsSaveLines(all);
  }

  return toInsert.length;
}
