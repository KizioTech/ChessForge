import { describe, it, expect, beforeAll } from "vitest";
import { loadOpeningBook } from "../../src/lib/openings/opening-book";
import {
  buildFamilies, splitName, flattenVisible, filterTree, leafLines, searchFamilies, expandableIds, lineKey,
  type OpeningFamily
} from "../../src/lib/openings/learn-tree";

let families: OpeningFamily[];
beforeAll(async () => { families = buildFamilies(await loadOpeningBook()); });

const fam = (name: string) => families.find(f => f.name === name)!;

describe("splitName", () => {
  it("splits family, variation and sub-variation", () => {
    expect(splitName("Sicilian Defense: Najdorf Variation, English Attack"))
      .toEqual(["Sicilian Defense", "Najdorf Variation", "English Attack"]);
    expect(splitName("Italian Game")).toEqual(["Italian Game"]);
  });
});

describe("buildFamilies (real Lichess data)", () => {
  it("groups thousands of lines into hundreds of families, biggest first", () => {
    expect(families.length).toBeGreaterThan(100);
    const total = families.reduce((n, f) => n + f.lineCount, 0);
    expect(total).toBeGreaterThan(3000);
    expect(families[0].lineCount).toBeGreaterThanOrEqual(families[1].lineCount);
  });

  it("assigns the owning side by who plays the move that names the opening", () => {
    expect(fam("Sicilian Defense").side).toBe("black");
    expect(fam("French Defense").side).toBe("black");
    expect(fam("Caro-Kann Defense").side).toBe("black");
    expect(fam("King's Indian Defense").side).toBe("black"); // shortest line is a White-named variation
    expect(fam("King's Indian Attack").side).toBe("white");
    expect(fam("Italian Game").side).toBe("white");
    expect(fam("Ruy Lopez").side).toBe("white");
    expect(fam("English Opening").side).toBe("white");
  });

  it("builds a nested variation tree", () => {
    const sicilian = fam("Sicilian Defense");
    const najdorf = sicilian.root.children.find(c => c.label === "Najdorf Variation");
    expect(najdorf).toBeTruthy();
    expect(najdorf!.line?.eco).toBe("B90");
    expect(najdorf!.children.some(c => c.label === "English Attack")).toBe(true);
    expect(najdorf!.lineCount).toBeGreaterThan(5);
  });

  it("counts every line exactly once", () => {
    const sicilian = fam("Sicilian Defense");
    expect(leafLines(sicilian.root).length).toBe(sicilian.lineCount);
    expect(new Set(sicilian.lineKeys).size).toBe(sicilian.lineKeys.length);
  });

  it("gives every family a starting line and an ECO range", () => {
    for (const f of families) {
      expect(f.mainLine.moves!.length).toBeGreaterThan(0);
      expect(f.ecoMin <= f.ecoMax).toBe(true);
    }
  });

  it("ensures major variations reach master depth (8+ moves / 16+ plies)", () => {
    const sicilian = fam("Sicilian Defense");
    expect(sicilian.mainLine.moves!.length).toBeGreaterThanOrEqual(16); // >= 8 full moves
    const italian = fam("Italian Game");
    expect(italian.mainLine.moves!.length).toBeGreaterThanOrEqual(16);
    const ruy = fam("Ruy Lopez");
    expect(ruy.mainLine.moves!.length).toBeGreaterThanOrEqual(16);
  });
});

describe("tree helpers", () => {
  it("shows only expanded branches", () => {
    const sic = fam("Sicilian Defense");
    const collapsed = flattenVisible(sic.root, new Set());
    expect(collapsed.length).toBe(1);
    const open = flattenVisible(sic.root, new Set([sic.root.id]));
    expect(open.length).toBe(1 + sic.root.children.length);
    expect(open.every(r => r.depth <= 1)).toBe(true);
  });

  it("filters a tree to matches and keeps their ancestors", () => {
    const sic = fam("Sicilian Defense");
    const pruned = filterTree(sic.root, "najdorf")!;
    expect(pruned.children.length).toBeGreaterThan(0);
    expect(pruned.children.every(c => c.label.toLowerCase().includes("najdorf") || c.children.length > 0)).toBe(true);
    expect(filterTree(sic.root, "zzzzzz-nothing")).toBeNull();
    expect(filterTree(sic.root, "  ")).toBe(sic.root);
  });

  it("lists expandable ids", () => {
    const sic = fam("Sicilian Defense");
    expect(expandableIds(sic.root)).toContain(sic.root.id);
  });

  it("searches families by name, ECO code and side", () => {
    expect(searchFamilies(families, "sicilian").some(f => f.name === "Sicilian Defense")).toBe(true);
    expect(searchFamilies(families, "B90").some(f => f.name === "Sicilian Defense")).toBe(true);
    expect(searchFamilies(families, "", "white").every(f => f.side === "white")).toBe(true);
    expect(searchFamilies(families, "italian", "black").length).toBe(0);
    const trapFamilies = searchFamilies(families, "", "traps");
    expect(trapFamilies.length).toBeGreaterThan(10);
    expect(trapFamilies.some(f => f.name === "Italian Game")).toBe(true);
    expect(trapFamilies.some(f => f.name === "Sicilian Defense")).toBe(true);
  });

  it("populates and preserves deep trap lines in families", () => {
    const sic = fam("Sicilian Defense");
    expect(sic.trapCount).toBeGreaterThan(0);
    const siberian = leafLines(sic.root).find(l => l.name.includes("Siberian Trap"));
    expect(siberian).toBeTruthy();
    expect(siberian!.moves!.length).toBeGreaterThanOrEqual(18); // 9 or 10 full moves
    expect(siberian!.isTrap).toBe(true);

    const italian = fam("Italian Game");
    expect(italian.trapCount).toBeGreaterThan(0);
    const legal = leafLines(italian.root).find(l => l.name.includes("Légal"));
    expect(legal).toBeTruthy();
    expect(legal!.moves!.length).toBe(15); // 1.e4..8.Nd5#
  });

  it("makes stable line keys", () => {
    expect(lineKey({ eco: "B90", name: "x" })).toBe("B90|x");
  });
});
