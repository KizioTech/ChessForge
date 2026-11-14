// Render smoke tests for the Learn section (server-side render: no DOM, no board, no network).
import { describe, it, expect, beforeAll } from "vitest";
import { renderToString } from "react-dom/server";
import { loadOpeningBook, type OpeningBook } from "../../src/lib/openings/opening-book";
import { buildFamilies, leafLines, lineKey, type OpeningFamily } from "../../src/lib/openings/learn-tree";
import { LibraryBrowser } from "../../src/components/OpeningLibrary";
import { OpeningDetail } from "../../src/components/OpeningDetail";
import { recordRun } from "../../src/lib/openings/line-progress";

let book: OpeningBook;
let families: OpeningFamily[];
beforeAll(async () => { book = await loadOpeningBook(); families = buildFamilies(book); });
const noop = () => {};

describe("LibraryBrowser", () => {
  it("lists openings with line counts and sides", () => {
    const html = renderToString(<LibraryBrowser families={families} progress={{}} onOpen={noop} />);
    expect(html).toContain("Opening library");
    expect(html).toContain("Sicilian Defense");
    expect(html).toContain("As White");
    expect(html).toContain("Not started");
  });

  it("shows progress and a continue button once something was practised", () => {
    const sic = families.find(f => f.name === "Sicilian Defense")!;
    const key = sic.lineKeys[0];
    const progress = { [key]: recordRun(undefined, key, true, "2026-11-14T10:00:00Z") };
    const html = renderToString(<LibraryBrowser families={families} progress={progress} onOpen={noop} />);
    expect(html).toContain("Continue:");
    expect(html).toContain("in progress");
  });
});

describe("OpeningDetail", () => {
  const props = () => ({
    book, progress: {}, initialLineKey: null, onRecord: noop, onBack: noop,
    onAddLine: async () => 0, onViewRepertoire: noop
  });

  it("shows the variation tree, study and practise tabs, and the repertoire gate", () => {
    const sic = families.find(f => f.name === "Sicilian Defense")!;
    const html = renderToString(<OpeningDetail {...props()} family={sic} />);
    expect(html).toContain("Sicilian Defense");
    expect(html).toContain("Najdorf Variation");
    expect(html).toContain("Study");
    expect(html).toContain("Practise");
    expect(html).toContain("Master this one first");
    expect(html).toContain("THEORY CONTINUES WITH");
  });

  it("offers adding to the repertoire once a line is mastered", () => {
    const ital = families.find(f => f.name === "Italian Game")!;
    const key = lineKey(ital.mainLine);
    let p = undefined as ReturnType<typeof recordRun> | undefined;
    for (let i = 0; i < 3; i++) p = recordRun(p, key, true, "2026-11-14T10:00:00Z");
    // React's server renderer separates adjacent text with comment markers; strip them before matching.
    const html = renderToString(<OpeningDetail {...props()} family={ital} progress={{ [key]: p! }} initialLineKey={key} />)
      .replace(/<!-- -->/g, "");
    expect(html).toContain("Add this line to my white repertoire");
    expect(html).toContain("Mastered");
  });

  it("defaults to the winning side when a trap is selected (e.g. Blackburne Shilling as Black)", () => {
    const ital = families.find(f => f.name === "Italian Game")!;
    const blackburne = leafLines(ital.root).find((l: any) => l.name.includes("Blackburne Shilling Gambit Trap"))!;
    const key = lineKey(blackburne);
    const html = renderToString(<OpeningDetail {...props()} family={ital} initialLineKey={key} />);
    expect(html).toContain("Blackburne Shilling Gambit Trap");
    expect(html).toContain("⚡ TRAP");
    expect(html).toContain("Smothered mate");
  });
});
