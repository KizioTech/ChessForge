import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { flattenVisible, lineKey, type VariationNode } from "../lib/openings/learn-tree";
import { statusOf, type ProgressMap } from "../lib/openings/line-progress";

interface Props {
  root: VariationNode;
  expanded: Set<string>;
  selectedId: string | null;
  progress: ProgressMap;
  onToggle: (id: string) => void;
  onSelect: (node: VariationNode) => void;
}

/** Collapsible list of an opening's named variations, indented by depth. */
export function VariationTree({ root, expanded, selectedId, progress, onToggle, onSelect }: Props) {
  const rows = flattenVisible(root, expanded);
  return (
    <div className="ol-tree" role="tree" aria-label="Variations">
      {rows.map(({ node, depth }) => {
        const hasKids = node.children.length > 0;
        const isOpen = expanded.has(node.id);
        const status = node.line ? statusOf(progress[lineKey(node.line)]) : null;
        return (
          <div
            key={node.id}
            className={`ol-tree-row${selectedId === node.id ? " is-selected" : ""}`}
            style={{ paddingLeft: 8 + depth * 16 }}
            role="treeitem"
            aria-expanded={hasKids ? isOpen : undefined}
            aria-selected={selectedId === node.id}
          >
            {hasKids ? (
              <button className="ol-tree-caret" onClick={() => onToggle(node.id)} aria-label={isOpen ? "Collapse" : "Expand"}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="ol-tree-caret-space" />
            )}
            <button
              className="ol-tree-label"
              onClick={() => (node.line ? onSelect(node) : onToggle(node.id))}
              title={node.line ? node.line.pgn : "Group of variations"}
            >
              <span className="ol-tree-text">{depth === 0 ? "Main line" : node.label}</span>
              {node.line && <span className="ol-eco">{node.line.eco}</span>}
            </button>
            {hasKids && <span className="ol-tree-count" title="Lines in this branch">{node.lineCount}</span>}
            {status === "mastered" && <Check size={13} className="ol-status-mastered" aria-label="Mastered" />}
            {status === "learning" && <span className="ol-status-learning" aria-label="In progress" />}
          </div>
        );
      })}
    </div>
  );
}
