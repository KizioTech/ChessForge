/**
 * learn-tree.ts: turns the flat opening book into something you can browse like a course:
 * opening families, each with a tree of named variations.
 *
 *   "Sicilian Defense: Najdorf Variation, English Attack"
 *     -> family "Sicilian Defense" > "Najdorf Variation" > "English Attack"
 *
 * Pure TypeScript: no React, no network.
 */
import type { BookOpening, OpeningBook } from "./opening-book";

export type OpeningSide = "white" | "black";

export interface VariationNode {
  /** Unique within a family: the path labels joined with " › ". */
  id: string;
  label: string;
  path: string[];
  /** A real named line at this node (some nodes only group children). */
  line: BookOpening | null;
  children: VariationNode[];
  /** Number of real lines in this subtree, including this node's own. */
  lineCount: number;
}

export interface OpeningFamily {
  name: string;
  /** The side that "owns" the opening, judged by who plays the move that names it. */
  side: OpeningSide;
  ecoMin: string;
  ecoMax: string;
  lineCount: number;
  trapCount: number;
  root: VariationNode;
  /** The shortest line in the family: the natural starting point for study. */
  mainLine: BookOpening;
  /** Stable keys of every real line, in tree order. */
  lineKeys: string[];
}

/** "Sicilian Defense: Najdorf Variation, English Attack" -> [family, "Najdorf Variation", "English Attack"] */
export function splitName(name: string): string[] {
  const colon = name.indexOf(":");
  if (colon === -1) return [name.trim()];
  const family = name.slice(0, colon).trim();
  const rest = name.slice(colon + 1).split(",").map(s => s.trim()).filter(Boolean);
  return [family, ...rest];
}

export function lineKey(line: { eco: string; name: string }): string {
  return `${line.eco}|${line.name}`;
}

/**
 * Who "owns" an opening. A family called a Defense belongs to Black. Otherwise whoever plays the
 * last move of the shortest line names it: 1.e4 c5 (Sicilian) ends on Black's move, while
 * 1.e4 e5 2.Nf3 Nc6 3.Bc4 (Italian Game) ends on White's.
 */
export function sideOfFamily(familyName: string, shortestLinePlies: number): OpeningSide {
  if (/\bDefen[cs]e\b/i.test(familyName)) return "black";
  return shortestLinePlies % 2 === 1 ? "white" : "black";
}

function makeNode(path: string[]): VariationNode {
  return { id: path.join(" › "), label: path[path.length - 1], path, line: null, children: [], lineCount: 0 };
}

function finishNode(node: VariationNode): string {
  // returns the smallest ECO code in the subtree, used for ordering
  let minEco = node.line?.eco ?? "Z99";
  for (const child of node.children) {
    const e = finishNode(child);
    if (e < minEco) minEco = e;
  }
  (node as VariationNode & { _eco?: string })._eco = minEco;
  node.children.sort((a, b) => {
    const ea = (a as VariationNode & { _eco?: string })._eco ?? "Z99";
    const eb = (b as VariationNode & { _eco?: string })._eco ?? "Z99";
    return ea.localeCompare(eb) || a.label.localeCompare(b.label);
  });
  node.lineCount = (node.line ? 1 : 0) + node.children.reduce((n, c) => n + c.lineCount, 0);
  return minEco;
}

export function buildFamilies(book: OpeningBook): OpeningFamily[] {
  const groups = new Map<string, BookOpening[]>();
  for (const line of book.all) {
    const family = splitName(line.name)[0];
    const arr = groups.get(family);
    if (arr) arr.push(line);
    else groups.set(family, [line]);
  }

  const families: OpeningFamily[] = [];
  for (const [name, lines] of groups) {
    const root = makeNode([name]);
    for (const line of lines) {
      const parts = splitName(line.name);
      let node = root;
      for (let i = 1; i < parts.length; i++) {
        const path = parts.slice(0, i + 1);
        let child = node.children.find(c => c.label === parts[i]);
        if (!child) {
          child = makeNode(path);
          node.children.push(child);
        }
        node = child;
      }
      // For traps, we preserve the full deep tactical sequence. For regular lines, keep the canonical/shorter one.
      const isIncomingTrap = Boolean(line.isTrap || line.name.toLowerCase().includes("trap"));
      const isExistingTrap = Boolean(node.line?.isTrap || node.line?.name.toLowerCase().includes("trap"));

      if (!node.line) {
        node.line = line;
      } else if (isIncomingTrap && !isExistingTrap) {
        node.line = line;
      } else if (isIncomingTrap && isExistingTrap) {
        if ((line.moves?.length ?? 0) > (node.line.moves?.length ?? 0)) {
          node.line = line;
        }
      } else if (!isExistingTrap && (line.moves?.length ?? 99) < (node.line.moves?.length ?? 99)) {
        node.line = line;
      }
    }
    finishNode(root);

    const mainLine = lines.reduce((best, l) => ((l.moves?.length ?? 99) < (best.moves?.length ?? 99) ? l : best), lines[0]);
    const ecos = lines.map(l => l.eco).sort();
    const realLines = leafLines(root);
    const trapCount = realLines.filter(l => l.isTrap || l.name.toLowerCase().includes("trap")).length;
    families.push({
      name,
      side: sideOfFamily(name, mainLine.moves?.length ?? 1),
      ecoMin: ecos[0],
      ecoMax: ecos[ecos.length - 1],
      lineCount: root.lineCount,
      trapCount,
      root,
      mainLine,
      lineKeys: realLines.map(lineKey)
    });
  }
  return families.sort((a, b) => b.lineCount - a.lineCount || a.name.localeCompare(b.name));
}

/** Every real line in a subtree, in tree order (a node's own line first, then its children). */
export function leafLines(node: VariationNode): BookOpening[] {
  const out: BookOpening[] = [];
  const walk = (n: VariationNode) => {
    if (n.line) out.push(n.line);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

export interface VisibleRow {
  node: VariationNode;
  depth: number;
}

/** Rows to render, honouring which nodes are expanded. The root itself is not a row. */
export function flattenVisible(root: VariationNode, expanded: Set<string>): VisibleRow[] {
  const rows: VisibleRow[] = [];
  const walk = (n: VariationNode, depth: number) => {
    rows.push({ node: n, depth });
    if (expanded.has(n.id)) n.children.forEach(c => walk(c, depth + 1));
  };
  // the root's own line (e.g. plain "Sicilian Defense") is shown as the first row
  walk(root, 0);
  return rows;
}

/** Keep only nodes whose label matches, plus their ancestors and descendants-with-matches. */
export function filterTree(root: VariationNode, query: string): VariationNode | null {
  const q = query.trim().toLowerCase();
  if (!q) return root;
  const prune = (n: VariationNode): VariationNode | null => {
    const kids = n.children.map(prune).filter((c): c is VariationNode => c !== null);
    const selfMatch = n.label.toLowerCase().includes(q) || (n.line?.eco.toLowerCase() === q);
    if (!selfMatch && kids.length === 0) return null;
    const children = selfMatch ? n.children : kids;
    return { ...n, children, lineCount: (n.line ? 1 : 0) + children.reduce((s, c) => s + c.lineCount, 0) };
  };
  return prune(root);
}

/** Ids of every node that has children, for "expand all". */
export function expandableIds(root: VariationNode): string[] {
  const ids: string[] = [];
  const walk = (n: VariationNode) => {
    if (n.children.length) ids.push(n.id);
    n.children.forEach(walk);
  };
  walk(root);
  return ids;
}

export function searchFamilies(
  families: OpeningFamily[],
  query: string,
  side: OpeningSide | "all" | "traps" = "all"
): OpeningFamily[] {
  const q = query.trim().toLowerCase();
  return families.filter(f => {
    if (side === "traps") {
      if (f.trapCount === 0) return false;
    } else if (side !== "all" && f.side !== side) {
      return false;
    }
    return (
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.ecoMin.toLowerCase() === q ||
      (q.length === 3 && f.ecoMin <= q.toUpperCase() && q.toUpperCase() <= f.ecoMax && /^[a-e]\d\d$/.test(q))
    );
  });
}
