import React from "react";
import { BookOpenCheck, Search, Activity, Eye, Plus } from "lucide-react";
import { ECO_CATEGORIES } from "../../lib/openings";

interface OpeningsDirectoryTabProps {
  listSearch: string;
  setListSearch: (s: string) => void;
  listCategory: "all" | "A" | "B" | "C" | "D" | "E" | string;
  setListCategory: React.Dispatch<React.SetStateAction<any>>;
  listRootsOnly: boolean;
  setListRootsOnly: (r: boolean) => void;
  listPage: number;
  setListPage: React.Dispatch<React.SetStateAction<number>>;
  listLoading: boolean;
  openingsList: {
    items: Array<{
      eco: string;
      name: string;
      moves: string;
      isEcoRoot?: boolean;
    }>;
    total: number;
  };
  onPreviewOpening: (movesStr: string) => void;
  onAddFromList: (movesStr: string, openingName: string, side: "white" | "black") => void;
}

export function OpeningsDirectoryTab({
  listSearch,
  setListSearch,
  listCategory,
  setListCategory,
  listRootsOnly,
  setListRootsOnly,
  listPage,
  setListPage,
  listLoading,
  openingsList,
  onPreviewOpening,
  onAddFromList
}: OpeningsDirectoryTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header & Category Filter Bar */}
      <div className="panel" style={{ padding: "16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "14px"
          }}
        >
          <div>
            <h3
              style={{
                margin: "0 0 4px",
                fontSize: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <BookOpenCheck size={18} style={{ color: "var(--lime)" }} /> ECO Openings Directory
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
                onChange={e => {
                  setListSearch(e.target.value);
                  setListPage(0);
                }}
                placeholder="Search name, ECO, moves…"
                style={{ fontSize: "12px", paddingLeft: "28px", width: "220px", height: "32px" }}
              />
              <Search
                size={13}
                style={{ position: "absolute", left: "9px", top: "10px", color: "var(--muted)" }}
              />
              {listSearch && (
                <button
                  onClick={() => {
                    setListSearch("");
                    setListPage(0);
                  }}
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "7px",
                    background: "none",
                    border: "none",
                    color: "var(--muted)",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Roots vs All Toggle */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                cursor: "pointer",
                userSelect: "none"
              }}
            >
              <input
                type="checkbox"
                checked={listRootsOnly}
                onChange={e => {
                  setListRootsOnly(e.target.checked);
                  setListPage(0);
                }}
              />
              <span>Root openings only</span>
            </label>
          </div>
        </div>

        {/* ECO Category Filter Tabs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          <button
            className={`button button-small ${listCategory === "all" ? "button-primary" : "button-ghost"}`}
            onClick={() => {
              setListCategory("all");
              setListPage(0);
            }}
            style={{ fontSize: "11px" }}
          >
            All Volumes
          </button>
          {ECO_CATEGORIES.map(cat => (
            <button
              key={cat.code}
              className={`button button-small ${listCategory === cat.code ? "button-primary" : "button-ghost"}`}
              onClick={() => {
                setListCategory(cat.code);
                setListPage(0);
              }}
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "14px"
          }}
        >
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
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: "13px"
            }}
          >
            <Activity
              size={20}
              className="spin"
              style={{ display: "inline-block", marginRight: "8px", verticalAlign: "middle" }}
            />
            Loading openings from offline book…
          </div>
        ) : openingsList.items.length === 0 ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: "13px"
            }}
          >
            No openings found matching your criteria. Try adjusting the search term or category filter.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "12px"
            }}
          >
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      marginBottom: "6px"
                    }}
                  >
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
                        <span
                          style={{
                            fontSize: "10px",
                            background: "var(--sunken)",
                            color: "var(--muted)",
                            padding: "1px 5px",
                            borderRadius: "3px"
                          }}
                        >
                          Root
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                      Vol. {op.eco.charAt(0)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      marginBottom: "4px",
                      lineHeight: "1.3"
                    }}
                  >
                    {op.name}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontFamily: "monospace",
                      color: "var(--muted)",
                      wordBreak: "break-word"
                    }}
                  >
                    {op.moves}
                  </div>
                </div>

                {/* Card Actions */}
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    borderTop: "1px solid var(--border)",
                    paddingTop: "8px",
                    justifyContent: "flex-end"
                  }}
                >
                  <button
                    className="button button-ghost button-small"
                    onClick={() => onPreviewOpening(op.moves)}
                    title="Preview move sequence on the interactive explorer board"
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    <Eye size={12} /> Preview
                  </button>
                  <button
                    className="button button-secondary button-small"
                    onClick={() => onAddFromList(op.moves, op.name, "white")}
                    title="Add this opening to your White Repertoire"
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    <Plus size={12} /> White
                  </button>
                  <button
                    className="button button-secondary button-small"
                    onClick={() => onAddFromList(op.moves, op.name, "black")}
                    title="Add this opening to your Black Repertoire"
                    style={{ fontSize: "11px", padding: "4px 8px" }}
                  >
                    <Plus size={12} /> Black
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {!listLoading && openingsList.total > 24 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "18px",
              paddingTop: "14px",
              borderTop: "1px solid var(--border)"
            }}
          >
            <button
              className="button button-secondary button-small"
              disabled={listPage === 0}
              onClick={() => setListPage(p => Math.max(0, p - 1))}
            >
              ← Previous Page
            </button>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>
              Page {listPage + 1} of {Math.max(1, Math.ceil(openingsList.total / 24))} (
              {openingsList.total.toLocaleString()} total)
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
  );
}
