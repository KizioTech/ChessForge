import React, { useState, useRef } from "react";
import {
  CloudDownload,
  FileText,
  X,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ArrowRight,
  Loader2,
  Database,
  ShieldAlert
} from "lucide-react";
import { parsePgn, type ParseReport } from "../lib/pgn-parser";
import { saveParsedGames, type SaveGamesResult } from "../lib/games";
import { useAuth } from "../lib/auth";

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
  onNavigateToGames?: () => void;
}

export function ImportDialog({
  isOpen,
  onClose,
  onImportComplete,
  onNavigateToGames
}: ImportDialogProps) {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "parsing" | "complete" | "error">("idle");
  const [parseReport, setParseReport] = useState<ParseReport | null>(null);
  const [saveResult, setSaveResult] = useState<SaveGamesResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  function resetState() {
    setFile(null);
    setPasteText("");
    setStatus("idle");
    setParseReport(null);
    setSaveResult(null);
    setErrorMessage("");
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (droppedFile.size > 5 * 1024 * 1024) {
        setErrorMessage("File exceeds maximum allowed size of 5 MB");
        setStatus("error");
        return;
      }
      setFile(droppedFile);
      setErrorMessage("");
    }
  }

  async function handleImport() {
    setStatus("parsing");
    setErrorMessage("");

    try {
      let rawText = "";
      if (tab === "file") {
        if (!file) return;
        rawText = await file.text();
      } else {
        rawText = pasteText.trim();
        if (!rawText) return;
      }

      const username = profile?.display_name || user?.email?.split("@")[0] || undefined;
      const report = await parsePgn(rawText, username);
      setParseReport(report);

      if (report.games.length === 0 && report.errors.length > 0) {
        setStatus("error");
        setErrorMessage(`Found no valid games. ${report.errors.length} game(s) could not be parsed.`);
        return;
      }

      const saveRes = await saveParsedGames(
        report.games,
        tab === "file" ? "upload" : "paste",
        user?.id
      );

      setSaveResult(saveRes);
      setStatus("complete");
      onImportComplete?.();
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err?.message || "Failed to parse and import games");
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={e => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <section
        className="import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        style={{ maxWidth: "620px" }}
      >
        <div className="modal-head">
          <div>
            <div className="eyebrow">
              <Database size={13} /> GAME LIBRARY
            </div>
            <h2 id="import-title">Bring your games into ChessForge</h2>
            <p>Import your personal games via PGN file or paste. Duplicate games will be detected automatically.</p>
          </div>
          <button className="icon-btn" onClick={handleClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        {status === "complete" && saveResult && parseReport ? (
          <div style={{ marginTop: "20px" }}>
            <div
              style={{
                background: "var(--raised)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <CheckCircle2 size={24} style={{ color: "var(--lime)" }} />
                <div>
                  <strong style={{ fontSize: "14px", display: "block" }}>Import Complete</strong>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                    {saveResult.saved.length} game{saveResult.saved.length === 1 ? "" : "s"} added to your library
                  </span>
                </div>
              </div>

              {/* Stats breakdown chips */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginTop: "4px" }}>
                <div style={{ background: "var(--panel)", padding: "10px", borderRadius: "6px", textAlign: "center" }}>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--lime)", display: "block" }}>
                    {saveResult.saved.length}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--muted)" }}>Imported</span>
                </div>
                <div style={{ background: "var(--panel)", padding: "10px", borderRadius: "6px", textAlign: "center" }}>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: "var(--copper)", display: "block" }}>
                    {saveResult.duplicates.length}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--muted)" }}>Duplicates Skipped</span>
                </div>
                <div style={{ background: "var(--panel)", padding: "10px", borderRadius: "6px", textAlign: "center" }}>
                  <span style={{ fontSize: "18px", fontWeight: 700, color: parseReport.errors.length > 0 ? "var(--red)" : "var(--muted)", display: "block" }}>
                    {parseReport.errors.length}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--muted)" }}>Errors</span>
                </div>
              </div>

              {/* Error list if any */}
              {parseReport.errors.length > 0 && (
                <div
                  style={{
                    maxHeight: "120px",
                    overflow: "auto",
                    background: "rgba(216, 117, 112, 0.1)",
                    border: "1px solid rgba(216, 117, 112, 0.3)",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "11px"
                  }}
                >
                  <strong style={{ color: "var(--red)", display: "block", marginBottom: "4px" }}>
                    Skipped malformed games:
                  </strong>
                  {parseReport.errors.map(err => (
                    <div key={err.gameIndex} style={{ marginBottom: "6px", color: "var(--text)" }}>
                      Game #{err.gameIndex}: <i>{err.error}</i>
                      <div style={{ fontSize: "9px", color: "var(--muted)", fontFamily: "var(--mono)" }}>
                        {err.rawSnippet}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: "none", marginTop: "16px", padding: 0 }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={resetState}
              >
                Import more
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => {
                  handleClose();
                  onNavigateToGames?.();
                }}
              >
                View in My Games <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="import-tabs">
              <button
                className={tab === "file" ? "selected" : ""}
                onClick={() => setTab("file")}
              >
                PGN file upload
              </button>
              <button
                className={tab === "paste" ? "selected" : ""}
                onClick={() => setTab("paste")}
              >
                Paste PGN text
              </button>
            </div>

            {tab === "file" ? (
              <label
                className="upload-zone"
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                style={{
                  borderColor: isDragging ? "var(--lime)" : undefined,
                  background: isDragging ? "var(--raised)" : undefined
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pgn,.txt"
                  onChange={e => {
                    const selected = e.target.files?.[0];
                    if (selected) {
                      if (selected.size > 5 * 1024 * 1024) {
                        setErrorMessage("File exceeds maximum allowed size of 5 MB");
                        setStatus("error");
                        return;
                      }
                      setFile(selected);
                      setErrorMessage("");
                    }
                  }}
                />
                <div className="upload-icon">
                  <CloudDownload size={21} />
                </div>
                <strong>{file ? file.name : "Choose a PGN file or drag here"}</strong>
                <span>
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB · Ready to import`
                    : "Supports single and multi-game PGN archives up to 5 MB"}
                </span>
                <small>Format: Standard .pgn or .txt</small>
              </label>
            ) : (
              <div style={{ marginTop: "16px" }}>
                <textarea
                  className="pgn-textarea"
                  style={{ height: "180px", fontFamily: "var(--mono)" }}
                  placeholder={`[Event "FIDE World Championship 2024"]\n[White "Ding Liren"]\n[Black "Gukesh D"]\n[Result "0-1"]\n\n1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 ...`}
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                />
                <span className="helper-text" style={{ display: "block", marginTop: "6px" }}>
                  Paste one or more complete games including headers and moves.
                </span>
              </div>
            )}

            {status === "error" && errorMessage && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--red)",
                  fontSize: "11px",
                  marginTop: "12px"
                }}
              >
                <AlertTriangle size={15} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="modal-footer">
              <span>
                <ShieldAlert size={13} />
                Fingerprint deduplication active. Duplicate games are safely skipped.
              </span>
              <button
                type="button"
                className="button button-secondary"
                onClick={handleClose}
                disabled={status === "parsing"}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={handleImport}
                disabled={
                  status === "parsing" ||
                  (tab === "file" && !file) ||
                  (tab === "paste" && !pasteText.trim())
                }
              >
                {status === "parsing" ? (
                  <>
                    <Loader2 size={14} className="spin" />
                    Parsing games...
                  </>
                ) : (
                  <>
                    Import games <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

