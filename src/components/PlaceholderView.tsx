import {
  FolderOpen,
  Crosshair,
  CalendarClock,
  BookOpen,
  Crown,
  BarChart3,
  Play,
  Upload,
  ShieldCheck
} from "lucide-react";
import type { Page } from "../types";

interface PlaceholderViewProps {
  page: Page;
  onImport: () => void;
  onNavigate: (p: Page) => void;
}

export function PlaceholderView({ page, onImport, onNavigate }: PlaceholderViewProps) {
  const config: Record<string, { icon: any; title: string; desc: string; action: string }> = {
    "My Games": {
      icon: FolderOpen,
      title: "Your games, in one place.",
      desc: "Import your Chess.com and Lichess games or upload PGN files. ChessForge will build a searchable library for review.",
      action: "Import games"
    },
    "Train": {
      icon: Crosshair,
      title: "Training built around your chess.",
      desc: "Your exercises will come from patterns found in your own games, alongside carefully selected foundational practice.",
      action: "Explore analysis"
    },
    "Review Queue": {
      icon: CalendarClock,
      title: "Nothing due. Yet.",
      desc: "Positions you struggle with will return at carefully spaced intervals, helping you retain what you learn.",
      action: "View training"
    },
    "Openings": {
      icon: BookOpen,
      title: "Understand your opening choices.",
      desc: "Build White and Black repertoires, review your lines and identify where your games leave familiar territory.",
      action: "Import a PGN"
    },
    "Endgames": {
      icon: Crown,
      title: "Make the technical positions count.",
      desc: "Practise king and pawn endings, rook endings, basic mates and practical conversion technique.",
      action: "Start training"
    },
    "Analytics": {
      icon: BarChart3,
      title: "Evidence before assumptions.",
      desc: "ChessForge will track your results, recurring mistakes, tactical opportunities and training progress over time.",
      action: "Import games"
    }
  };

  const c = config[page] || config.Train;
  const Icon = c.icon;

  return (
    <div className="content placeholder-page">
      <div className="placeholder-hero">
        <div className="placeholder-icon">
          <Icon size={24} />
        </div>
        <div className="eyebrow">CHESSFORGE / {page.toUpperCase()}</div>
        <h1>{c.title}</h1>
        <p>{c.desc}</p>
        <div className="placeholder-actions">
          <button
            className="button button-primary"
            onClick={
              page === "Train" || page === "Endgames"
                ? () => onNavigate("Analysis")
                : onImport
            }
          >
            {page === "Train" || page === "Endgames" ? <Play size={14} /> : <Upload size={14} />}{" "}
            {c.action}
          </button>
          <button
            className="button button-secondary"
            onClick={() => onNavigate("Dashboard")}
          >
            Back to dashboard
          </button>
        </div>
      </div>
      <div className="placeholder-note">
        <ShieldCheck size={16} />
        <div>
          <strong>Built around your own games</strong>
          <p>
            We won't label a weakness until there is enough evidence from your
            imported games and training attempts.
          </p>
        </div>
      </div>
    </div>
  );
}
