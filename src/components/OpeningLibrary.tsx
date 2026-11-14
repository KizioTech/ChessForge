import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { useOpeningBook } from "../lib/openings/use-opening-book";
import { useLineProgress } from "../lib/openings/use-line-progress";
import { buildFamilies, searchFamilies, type OpeningFamily, type OpeningSide } from "../lib/openings/learn-tree";
import { statusOf, summarizeProgress, type ProgressMap } from "../lib/openings/line-progress";
import { OpeningDetail } from "./OpeningDetail";
import type { BookOpening } from "../lib/openings/opening-book";

interface LibraryProps {
  userId?: string | null;
  onAddLine: (line: BookOpening, side: OpeningSide) => Promise<number>;
  onViewRepertoire: () => void;
  initialFamily?: string | null;
}

/** Loads the book, then shows either the browser or one opening. */
export function OpeningLibrary({ userId, onAddLine, onViewRepertoire, initialFamily }: LibraryProps) {
  const book = useOpeningBook();
  const families = useMemo(() => (book ? buildFamilies(book) : []), [book]);
  const { progress, record } = useLineProgress(userId);
  const [selected, setSelected] = useState<{ name: string; lineKey: string | null } | null>(
    initialFamily ? { name: initialFamily, lineKey: null } : null
  );

  useEffect(() => {
    if (initialFamily) {
      setSelected({ name: initialFamily, lineKey: null });
    }
  }, [initialFamily]);

  if (!book) {
    return (
      <div className="content ol-page">
        <p className="ol-sub">Loading the opening library…</p>
      </div>
    );
  }

  const family = selected ? families.find(f => f.name === selected.name) : undefined;
  if (family) {
    return (
      <OpeningDetail
        key={family.name}
        book={book}
        family={family}
        initialLineKey={selected?.lineKey ?? null}
        progress={progress}
        onRecord={record}
        onBack={() => setSelected(null)}
        onAddLine={onAddLine}
        onViewRepertoire={onViewRepertoire}
      />
    );
  }

  return (
    <LibraryBrowser
      families={families}
      progress={progress}
      onOpen={(name, lineKey) => setSelected({ name, lineKey: lineKey ?? null })}
    />
  );
}

/* ------------------------------------------------------------------ */

type SortKey = "lines" | "az" | "eco";
const PAGE = 36;

export function LibraryBrowser({
  families, progress, onOpen
}: {
  families: OpeningFamily[];
  progress: ProgressMap;
  onOpen: (familyName: string, lineKey?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<OpeningSide | "all" | "traps">("all");
  const [sort, setSort] = useState<SortKey>("lines");
  const [shown, setShown] = useState(PAGE);

  const filtered = useMemo(() => {
    const list = searchFamilies(families, query, side);
    const sorted = [...list];
    if (sort === "az") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "eco") sorted.sort((a, b) => a.ecoMin.localeCompare(b.ecoMin) || a.name.localeCompare(b.name));
    return sorted; // "lines" is the default order from buildFamilies
  }, [families, query, side, sort]);

  const allKeys = useMemo(() => families.flatMap(f => f.lineKeys), [families]);
  const overall = useMemo(() => summarizeProgress(allKeys, progress), [allKeys, progress]);
  const whiteCount = families.filter(f => f.side === "white").length;
  const trapsFamilyCount = families.filter(f => f.trapCount > 0).length;

  const lastPracticed = useMemo(() => {
    const entries = Object.values(progress).filter(p => p.lastPracticedAt);
    if (entries.length === 0) return null;
    entries.sort((a, b) => (b.lastPracticedAt ?? "").localeCompare(a.lastPracticedAt ?? ""));
    const key = entries[0].key;
    const fam = families.find(f => f.lineKeys.includes(key));
    return fam ? { family: fam.name, key, label: key.split("|")[1] } : null;
  }, [progress, families]);

  return (
    <div className="content ol-page">
      <header className="ol-head">
        <div>
          <div className="ol-eyebrow"><BookOpen size={13} /> LEARN</div>
          <h1>Opening library</h1>
          <p className="ol-sub">
            {allKeys.length.toLocaleString()} named lines across {families.length} openings. Open one, study its variations,
            then practise the lines from memory. Lines you master can go into <strong>My Repertoire</strong>.
          </p>
        </div>
        <div className="ol-overall" aria-label="Your progress">
          <strong>{overall.mastered}</strong> <span>mastered</span>
          <strong>{overall.learning}</strong> <span>in progress</span>
          {lastPracticed && (
            <button className="button button-secondary button-small" onClick={() => onOpen(lastPracticed.family, lastPracticed.key)}>
              Continue: {lastPracticed.label}
            </button>
          )}
        </div>
      </header>

      <div className="ol-toolbar">
        <label className="ol-search">
          <Search size={14} />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setShown(PAGE); }}
            placeholder="Search by name or ECO code, for example Sicilian or B12"
            aria-label="Search openings"
          />
        </label>
        <div className="ol-chips" role="group" aria-label="Filter by side">
          {([
            ["all", `All (${families.length})`],
            ["traps", `⚡ Traps (${trapsFamilyCount})`],
            ["white", `As White (${whiteCount})`],
            ["black", `As Black (${families.length - whiteCount})`]
          ] as const).map(([value, label]) => (
            <button key={value} className={`ol-chip${side === value ? " on" : ""}`} onClick={() => { setSide(value); setShown(PAGE); }}>
              {label}
            </button>
          ))}
        </div>
        <label className="ol-sort">
          Sort
          <select value={sort} onChange={e => setSort(e.target.value as SortKey)}>
            <option value="lines">Most lines</option>
            <option value="az">A to Z</option>
            <option value="eco">ECO code</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="ol-empty">
          <strong>No openings match “{query}”.</strong>
          <p>Try a shorter name, an ECO code like C50, or clear the filter.</p>
        </div>
      ) : (
        <>
          <div className="ol-grid">
            {filtered.slice(0, shown).map(f => {
              const s = summarizeProgress(f.lineKeys, progress);
              const pct = s.total ? Math.round((s.mastered / s.total) * 100) : 0;
              const started = f.lineKeys.some(k => statusOf(progress[k]) !== "new");
              return (
                <button key={f.name} className="ol-card" onClick={() => onOpen(f.name)}>
                  <div className="ol-card-top">
                    <span className={`ol-side ol-side-${f.side}`}>{f.side === "white" ? "White" : "Black"}</span>
                    <span className="ol-eco">{f.ecoMin === f.ecoMax ? f.ecoMin : `${f.ecoMin}–${f.ecoMax}`}</span>
                    {f.trapCount > 0 && (
                      <span className="ol-card-trap-badge" title={`${f.trapCount} known tactical traps in this opening`}>
                        ⚡ {f.trapCount} {f.trapCount === 1 ? "trap" : "traps"}
                      </span>
                    )}
                  </div>
                  <strong className="ol-card-title">{f.name}</strong>
                  <span className="ol-card-meta">
                    {f.lineCount} {f.lineCount === 1 ? "line" : "lines"} · starts {f.mainLine.pgn.split(" ").slice(0, 3).join(" ")}
                  </span>
                  <div className="ol-meter" aria-label={`${s.mastered} of ${s.total} lines mastered`}>
                    <div style={{ width: `${pct}%` }} />
                  </div>
                  <span className="ol-card-foot">
                    {started ? `${s.mastered} of ${s.total} mastered` : "Not started"}
                  </span>
                </button>
              );
            })}
          </div>
          {shown < filtered.length && (
            <div className="ol-more">
              <button className="button button-secondary" onClick={() => setShown(n => n + PAGE)}>
                Show more ({filtered.length - shown} left)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
