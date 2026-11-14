/**
 * curriculum.ts
 *
 * Master dataset of essential theoretical endgames across all standard categories:
 * - King & Pawn Endgames (Opposition, Key Squares, Outflanking, Trebuchet, Square Rule)
 * - Rook Endgames (Lucena Bridge, Philidor 3rd Rank, Vancura Defense, Short-Side)
 * - Minor Piece Endgames (Opposite-Colored Bishops, Domination, Knight Fortresses)
 * - Queen Endgames (Pawn on 7th rank c/f-pawn draws vs center-pawn wins)
 * - Fundamental Checkmates (K+Q, K+R, K+2B, K+B+N)
 */

import type { EndgamePosition } from "./types";

export const ENDGAME_CURRICULUM: EndgamePosition[] = [
  // ===========================================================================
  // 1. KING & PAWN ENDGAMES
  // ===========================================================================
  {
    id: "pawn-direct-opposition",
    title: "Direct Opposition (Pawn on 5th Rank)",
    category: "pawn",
    difficulty: "beginner",
    objective: "win",
    sideToMove: "white",
    fen: "8/8/4k3/8/4P3/8/4K3/8 w - - 0 1",
    keyConcept: "Direct Opposition & Outflanking",
    description:
      "When kings stand on the same file with an odd number of squares between them, whoever does NOT have the move holds the opposition.",
    solutionLine: ["Ke3", "Ke5", "Kd3", "Kd6", "Kd4"],
    explanation:
      "1. Ke3 takes vertical opposition! When Black mirrors with 1... Ke5, White outflanks with 2. Kd3. After Black steps back 2... Kd6, White seizes control with 3. Kd4 to shepherd the pawn forward."
  },
  {
    id: "pawn-key-squares",
    title: "Key Squares & Pawn Breakthrough",
    category: "pawn",
    difficulty: "intermediate",
    objective: "win",
    sideToMove: "white",
    fen: "8/8/8/3k4/8/4P3/4K3/8 w - - 0 1",
    keyConcept: "Occupying Key Squares in Front of the Pawn",
    description:
      "To win a king and pawn ending, your king must reach the key squares two ranks in front of the pawn.",
    solutionLine: ["Kd3", "Ke5", "e4", "Ke6", "Kd4"],
    explanation:
      "1. Kd3 occupies the key square, controlling Black's movement. White pushes e4 only when the king has secured the forward squares."
  },
  {
    id: "pawn-square-rule",
    title: "Rule of the Square (Pawn Race)",
    category: "pawn",
    difficulty: "beginner",
    objective: "win",
    sideToMove: "white",
    fen: "8/8/8/P7/8/8/1k6/4K3 w - - 0 1",
    keyConcept: "Square of the Pawn",
    description:
      "Draw a diagonal square from the pawn to the promotion rank. If the defending king cannot step inside the square on their turn, the pawn promotes without king support.",
    solutionLine: ["a6", "Kc3", "a7", "Kd4", "a8=Q"],
    explanation:
      "1. a6 immediately shrinks the square of the pawn. The Black king is too far to enter the box, allowing White to promote unimpeded."
  },
  {
    id: "pawn-rook-pawn-stalemate",
    title: "Rook Pawn Stalemate Fortress",
    category: "pawn",
    difficulty: "intermediate",
    objective: "draw",
    sideToMove: "black",
    fen: "8/8/8/8/8/k7/7P/7K b - - 0 1",
    keyConcept: "Corner Stalemate Trap with Rook Pawns",
    description:
      "An a-pawn or h-pawn cannot win if the defending king can reach the corner square (a1/a8/h1/h8).",
    solutionLine: ["Kb4", "Kg2", "Kc5", "Kg3", "Kd6"],
    explanation:
      "Black rushes the king toward the h8 promotion square. Even with White a full pawn ahead, reaching h8 guarantees a draw by stalemate or repetition."
  },
  {
    id: "pawn-trebuchet",
    title: "The Trebuchet (Mutual Zugzwang)",
    category: "pawn",
    difficulty: "advanced",
    objective: "win",
    sideToMove: "white",
    fen: "8/8/8/3k4/3p4/3K4/3P4/8 w - - 0 1",
    keyConcept: "Zugzwang in Pawn Warfare",
    description:
      "Whoever moves must relinquish defense of their pawn and lose the game.",
    solutionLine: ["Ke2", "Ke4", "d3+", "Kd5", "Kf3"],
    explanation:
      "1. Ke2! White avoids the losing blunder 1. Kc2? and forces Black into mutual zugzwang, winning Black's pawn on d4."
  },

  // ===========================================================================
  // 2. ROOK ENDGAMES (The Most Important Practical Endgames)
  // ===========================================================================
  {
    id: "rook-lucena-position",
    title: "The Lucena Position (Building the Bridge)",
    category: "rook",
    difficulty: "intermediate",
    objective: "win",
    sideToMove: "white",
    fen: "1K1k4/1P1r4/8/8/8/8/8/2R5 w - - 0 1",
    keyConcept: "Building a Bridge on the 4th Rank",
    description:
      "The definitive winning technique in rook endings: when your king is trapped on the promotion square, use the rook on the 4th rank as an umbrella shield.",
    solutionLine: ["Rc4", "Rd1", "Ra4", "Rc1", "Ka7"],
    explanation:
      "1. Rc4! sets up the bridge on the 4th rank. Once the king steps out, White's rook shields against perpetual vertical checks."
  },
  {
    id: "rook-philidor-position",
    title: "The Philidor Position (Third-Rank Defense)",
    category: "rook",
    difficulty: "intermediate",
    objective: "draw",
    sideToMove: "black",
    fen: "4k3/R7/1r6/4P3/4K3/8/8/8 b - - 0 1",
    keyConcept: "Third-Rank Passive Cutoff, then Rear Checks",
    description:
      "Francois-Andre Philidor's classic defense: hold the 6th rank (or 3rd rank) to prevent the enemy king from advancing; as soon as the pawn advances, drop the rook to the 1st rank for infinite rear checks.",
    solutionLine: ["Rh6", "Kd5", "Rg6", "e6", "Rg1", "Kd6", "Rd1+"],
    explanation:
      "1... Rh6! holds the 6th-rank cutoff! The White king cannot pass. When White pushes the pawn with e6, Black drops the rook to the 1st rank (Rg1) and delivers endless vertical checks from behind."
  },
  {
    id: "rook-vancura-defense",
    title: "The Vancura Defense (Rook Pawn Shield)",
    category: "rook",
    difficulty: "advanced",
    objective: "draw",
    sideToMove: "black",
    fen: "R7/8/7P/8/8/r7/8/4K2k b - - 0 1",
    keyConcept: "Side Checks on the 6th Rank",
    description:
      "When White has an a-pawn or h-pawn and Black's king is cut off, Black's rook attacks the pawn from the side along the 6th rank.",
    solutionLine: ["Rh3", "Ra6", "Kg2", "Ke2", "Kg3"],
    explanation:
      "1... Rh3! targets the pawn from the side. White's king has no shelter and cannot escape horizontal and vertical checks."
  },

  // ===========================================================================
  // 3. MINOR PIECE ENDGAMES
  // ===========================================================================
  {
    id: "minor-opposite-colored-bishops",
    title: "Opposite-Colored Bishops (Drawing Fortress)",
    category: "minor",
    difficulty: "intermediate",
    objective: "draw",
    sideToMove: "black",
    fen: "4b3/8/4k3/4P3/4B3/8/8/4K3 b - - 0 1",
    keyConcept: "Blockade on Opposing Colored Diagonals",
    description:
      "Opposite-colored bishops are notorious for high drawing margins. Setting up a blockade on your bishop's color cannot be broken by the opponent's bishop.",
    solutionLine: ["Kxe5", "Kd2", "Kd4", "Bf3", "Bg6"],
    explanation:
      "Black quickly eliminates or blockades the passed pawn. The opponent's bishop can never contest squares of the opposite color."
  },
  {
    id: "minor-knight-domination",
    title: "Bishop Dominating Knight",
    category: "minor",
    difficulty: "advanced",
    objective: "win",
    sideToMove: "white",
    fen: "8/8/2B5/8/8/1n6/8/2K1k3 w - - 0 1",
    keyConcept: "Restricting Knight Mobility with a Bishop",
    description:
      "A bishop positioned three squares away from a knight controls all of its forward squares, leaving it completely immobilized.",
    solutionLine: ["Kb2", "Nd2", "Kc3", "Nf1", "Kd3"],
    explanation:
      "1. Kb2 attacks the knight. White's bishop and king work in tandem to trap the knight on the edge of the board."
  },

  // ===========================================================================
  // 4. QUEEN ENDGAMES
  // ===========================================================================
  {
    id: "queen-vs-cpawn-7th-rank",
    title: "Queen vs c-Pawn on 7th Rank (Stalemate Defense)",
    category: "queen",
    difficulty: "advanced",
    objective: "draw",
    sideToMove: "black",
    fen: "8/8/1K6/8/8/8/2p5/k1Q5 b - - 0 1",
    keyConcept: "Corner Stalemate with Bishop/Rook Pawns",
    description:
      "A pawn on the 7th rank against a queen is normally a loss, but a c-pawn, f-pawn, a-pawn, or h-pawn can force a draw by hiding the king in the corner.",
    solutionLine: ["Ka2", "Qxc2"],
    explanation:
      "1... Ka2! steps into the corner. If White captures on c2, Black has no legal moves and draws immediately by stalemate."
  },
  {
    id: "queen-vs-center-pawn-win",
    title: "Queen vs Center Pawn on 7th Rank (Step in Front)",
    category: "queen",
    difficulty: "intermediate",
    objective: "win",
    sideToMove: "white",
    fen: "8/8/1K6/8/8/8/4p3/4k1Q1 w - - 0 1",
    keyConcept: "Forcing the Enemy King in Front of the Pawn",
    description:
      "Unlike bishop or rook pawns, a center pawn (d or e pawn) is a win because White can force the enemy king to step in front of the pawn, winning tempi to bring the white king.",
    solutionLine: ["Qe3+", "Kd1", "Qd3+", "Ke1", "Kc5"],
    explanation:
      "1. Qe3+ Kd1 2. Qd3+ Ke1! Forces the black king to block its own pawn, allowing White's king to march forward with 3. Kc5!"
  },

  // ===========================================================================
  // 5. FUNDAMENTAL CHECKMATES
  // ===========================================================================
  {
    id: "checkmate-king-queen",
    title: "King & Queen vs Lone King (The Shadow Box)",
    category: "checkmate",
    difficulty: "beginner",
    objective: "win",
    sideToMove: "white",
    fen: "8/8/8/4k3/8/8/8/4KQ2 w - - 0 1",
    keyConcept: "Shrinking the Box at a Knight's Distance",
    description:
      "Keep the queen at a knight's distance from the opposing king to continuously shrink its legal cage without causing stalemate.",
    solutionLine: ["Qe2+", "Kd4", "Kd2", "Kc5", "Qe4"],
    explanation:
      "White restricts the black king rank by rank, brings the white king into opposition, and delivers kiss-of-death checkmate on the edge."
  },
  {
    id: "checkmate-king-rook",
    title: "King & Rook vs Lone King (Rank-by-Rank Cutoff)",
    category: "checkmate",
    difficulty: "beginner",
    objective: "win",
    sideToMove: "white",
    fen: "8/8/8/4k3/8/8/8/R3K3 w - - 0 1",
    keyConcept: "Opposition & Barrier Driving",
    description:
      "Use the rook to create an impenetrable wall, use your king to confront the enemy king in opposition, and give rank checks to push the enemy to the edge.",
    solutionLine: ["Ra4", "Kd5", "Kd2", "Kc5", "Kd3"],
    explanation:
      "1. Ra4 cuts the enemy king off along the 4th rank! Once opposition is established, the rook drives the king to the board edge for checkmate."
  },
  {
    id: "checkmate-two-bishops",
    title: "King & Two Bishops vs Lone King (Corner Trapping)",
    category: "checkmate",
    difficulty: "intermediate",
    objective: "win",
    sideToMove: "white",
    fen: "8/8/8/4k3/8/8/3BB3/4K3 w - - 0 1",
    keyConcept: "Adjacent Bishop Wall Driving to the Corner",
    description:
      "Side-by-side bishops create an impassable diagonal barrier, driving the lone king toward any corner of the board.",
    solutionLine: ["Bc3+", "Ke6", "Bd3", "Kd5", "Kd2"],
    explanation:
      "The bishops weave a tight diagonal net, slowly corralling the enemy king toward the corner where checkmate is forced."
  }
];
