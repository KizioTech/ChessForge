/**
 * calculation-data.ts
 *
 * Curated dataset of calculation and visualization drills for Phase 8.
 * Each drill features:
 * - A starting FEN position
 * - A sequence of unseen intermediate moves the player must calculate mentally
 * - A clear tactical or positional problem to solve in the resulting visualized position
 * - A canonical solution move with full pedagogical explanation
 */

import type { CalculationDrill } from "./types";

export const CALCULATION_DRILLS: CalculationDrill[] = [
  {
    id: "reti-study-1921",
    title: "Réti's Geometric Diagonal Study",
    category: "pawn-race",
    difficulty: "intermediate",
    initialFen: "7K/8/k1P5/7p/8/8/8/8 w - - 0 1",
    sideToMove: "white",
    unseenMoves: ["Kg7", "h4", "Kf6", "Kb6", "Ke5", "Kxc6"],
    prompt:
      "Visualize White's diagonal king march: 1. Kg7 h4 2. Kf6 Kb6 3. Ke5 Kxc6. In the visualized position, where does the White King step to enter the square of Black's h-pawn?",
    solutionMove: "Kf4",
    alternativeSolutions: ["Kd4", "Kd5", "Kd6"],
    tacticalTheme: "Double threat & entering the square",
    explanation:
      "By marching diagonally towards both pawns, White forced Black to lose two tempi capturing on c6. From e5, White's King directly enters the square of the h-pawn with 4. Kf4! followed by Kg3, ensuring the draw."
  },
  {
    id: "lucena-bridge-prep",
    title: "Lucena Position: Stepping Up for the Bridge",
    category: "rook-cutoff",
    difficulty: "advanced",
    initialFen: "1K1k4/1P6/8/8/8/8/7r/2R5 w - - 0 1",
    sideToMove: "white",
    unseenMoves: [
      "Rc4",
      "Rh1",
      "Rd4+",
      "Ke7",
      "Kc7",
      "Rc1+",
      "Kb6",
      "Rb1+",
      "Kc6",
      "Rc1+"
    ],
    prompt:
      "Visualize White building the Lucena shelter: 1. Rc4 Rh1 2. Rd4+ Ke7 3. Kc7 Rc1+ 4. Kb6 Rb1+ 5. Kc6 Rc1+. Where does the White King step next to prepare the decisive rook shield on b4?",
    solutionMove: "Kb5",
    tacticalTheme: "Bridge building & tempo shields",
    explanation:
      "After 6. Kb5!, Black's checks run out: 6... Rb1+ is met by 7. Rb4!, shielding the White King while the pawn on b7 promotes safely to a Queen."
  },
  {
    id: "pawn-breakthrough-square",
    title: "King Opposition: Locking the Promotion Square",
    category: "breakthrough",
    difficulty: "beginner",
    initialFen: "8/8/8/8/p7/8/P7/k1K5 w - - 0 1",
    sideToMove: "white",
    unseenMoves: ["Kc2", "a3"],
    prompt:
      "Visualize 1. Kc2 a3. Black's king is cornered on a1 and the pawns are blocked. What is White's only move to prevent stalemate and maintain control?",
    solutionMove: "Kc1",
    tacticalTheme: "Stalemate avoidance & zugzwang",
    explanation:
      "1. Kc1! forces Black into total zugzwang. The king cannot move, but the pawn push is blocked, keeping the opposition."
  },
  {
    id: "triangulation-opposition",
    title: "Direct Opposition & Reserve Squares",
    category: "triangulation",
    difficulty: "intermediate",
    initialFen: "8/8/4k3/8/4P3/8/4K3/8 w - - 0 1",
    sideToMove: "white",
    unseenMoves: ["Ke3", "Ke5"],
    prompt:
      "Visualize 1. Ke3 Ke5. Black takes the direct opposition against White's King. What square does White step to in order to keep the pawn protected and outflank Black?",
    solutionMove: "Kd3",
    tacticalTheme: "Key squares & outflanking",
    explanation:
      "1. Kd3! defends the e4-pawn without yielding ground. If Black steps 2... Ke6 White plays 3. Kd4 taking the opposition; if 2... Kd6 White penetrates with 3. Kd4 or Ke3 followed by f-file invasion."
  },
  {
    id: "philidor-cut-passer",
    title: "Philidor Rook Defense: Lateral Cutoff",
    category: "rook-cutoff",
    difficulty: "advanced",
    initialFen: "8/4kp2/8/4P3/8/8/r7/3R2K1 w - - 0 1",
    sideToMove: "white",
    unseenMoves: ["Rd6", "Re2", "Kf1", "Rxe5"],
    prompt:
      "Visualize: 1. Rd6 Re2 2. Kf1 Rxe5. Black has equalized the material by snapping the e5 pawn. How does White's rook immediately cut off the Black King along the 6th rank?",
    solutionMove: "Ra6",
    tacticalTheme: "Lateral rook cutoff",
    explanation:
      "1. Ra6! severs Black's King from crossing the 6th rank. Restricting the defending monarch to the back ranks is fundamental for drawing or winning endgame technique."
  },
  {
    id: "knight-fork-tactic",
    title: "Knight Endgame: Trapping the Enemy King",
    category: "deflection",
    difficulty: "intermediate",
    initialFen: "8/8/8/8/4n3/5N2/3K1k2/8 w - - 0 1",
    sideToMove: "white",
    unseenMoves: ["Kd3", "Kxf3"],
    prompt:
      "Visualize 1. Kd3 Kxf3. Black eliminates White's knight. What is White's decisive king response attacking Black's knight on e4?",
    solutionMove: "Kd4",
    tacticalTheme: "King fork & simplification",
    explanation:
      "1. Kd4! immediately attacks Black's knight. Wherever the knight moves, Black cannot hold the position, leading to an immediate draw by insufficient material."
  },
  {
    id: "outside-passer-race",
    title: "Outside Passed Pawn Decoy",
    category: "pawn-race",
    difficulty: "beginner",
    initialFen: "8/8/4k3/8/8/1P6/6K1/8 w - - 0 1",
    sideToMove: "white",
    unseenMoves: ["Kf3", "Kd5", "Ke3", "Kc5"],
    prompt:
      "Visualize: 1. Kf3 Kd5 2. Ke3 Kc5. Black's King arrives to hunt down White's b3 pawn. How does White's King maintain total defense of the b-pawn?",
    solutionMove: "Kd3",
    tacticalTheme: "Shouldering & defensive shielding",
    explanation:
      "2. Kd3! defends b3 directly. Black's king cannot make progress, and White's king comfortably shepherds the b-pawn forward or holds the draw."
  },
  {
    id: "queen-vs-c-pawn-stalemate-avoidance",
    title: "Queen vs Bishop/Knight Pawn: Avoiding the Trap",
    category: "tactical-skewer",
    difficulty: "intermediate",
    initialFen: "8/8/8/8/8/8/2p1K3/k1Q5 w - - 0 1",
    sideToMove: "white",
    unseenMoves: ["Kd3", "Ka2"],
    prompt:
      "Visualize 1. Kd3 Ka2. Black's king stepped to a2 leaving the pawn on c2 undefended. How does White capture without allowing a stalemate trap?",
    solutionMove: "Qxc2",
    tacticalTheme: "Stalemate awareness",
    explanation:
      "1. Qxc2! is completely safe because Black's King is on a2 (with the b1 and a3 squares available), cleanly winning the game."
  },
  {
    id: "rook-cutoff-lateral",
    title: "Rook Endgame: Distance Checking and Cutoff",
    category: "rook-cutoff",
    difficulty: "beginner",
    initialFen: "8/R7/4k3/8/8/4K3/8/8 w - - 0 1",
    sideToMove: "white",
    unseenMoves: ["Ra6+", "Ke5"],
    prompt:
      "Visualize 1. Ra6+ Ke5. Where does White check or position the Rook to keep Black's king restricted along the 5th rank?",
    solutionMove: "Ra5+",
    alternativeSolutions: ["Ra5"],
    tacticalTheme: "Checking distance & barrier confinement",
    explanation:
      "1. Ra5+! drives Black's king further backward towards the 6th or 4th rank, denying it active central freedom."
  },
  {
    id: "bishop-opposition-lockout",
    title: "Opposite Color Dominance: Central Stride",
    category: "triangulation",
    difficulty: "advanced",
    initialFen: "8/8/8/3b4/8/2B5/4K3/3k4 w - - 0 1",
    sideToMove: "white",
    unseenMoves: ["Ke3", "Bc4"],
    prompt:
      "Visualize 1. Ke3 Bc4. Black's bishop tries to anchor on c4. Where does White's king stride into the center to dominate the board?",
    solutionMove: "Kd4",
    tacticalTheme: "King central dominance",
    explanation:
      "1. Kd4! immediately attacks the undefended bishop on c4, forcing it to retreat and ceding central control to White."
  },
  {
    id: "rook-and-pawn-skewer",
    title: "Cross-Board Skewer Threat",
    category: "tactical-skewer",
    difficulty: "intermediate",
    initialFen: "8/8/8/R7/4k3/7r/1K6/8 w - - 0 1",
    sideToMove: "white",
    unseenMoves: ["Ra4+", "Kd5"],
    prompt:
      "Visualize 1. Ra4+ Kd5. Black's king steps away from the 4th rank. How does White transfer the rook along the rank to eye Black's rook on h3?",
    solutionMove: "Ra3",
    alternativeSolutions: ["Ra5+"],
    tacticalTheme: "Horizontal skewering & deflection",
    explanation:
      "1. Ra3! skewers Black's rook on h3 through the third rank, forcing a rook trade or a passive retreat."
  },
  {
    id: "king-flank-break",
    title: "Flank Pawn Breakthrough: Shouldering the Defender",
    category: "breakthrough",
    difficulty: "intermediate",
    initialFen: "8/8/8/pk6/8/PK6/8/8 w - - 0 1",
    sideToMove: "white",
    unseenMoves: ["a4+", "Kc6"],
    prompt:
      "Visualize 1. a4+ Kc6. Black's king is pushed to c6. What king move solidifies White's space advantage and controls the key c4 square?",
    solutionMove: "Kc4",
    tacticalTheme: "Shouldering out the defender",
    explanation:
      "1. Kc4! takes the opposition on the 4th rank and denies Black's King access to b5 or d5."
  },
  {
    id: "deflection-overloaded-king",
    title: "Endgame Deflection: Bishop Check Harassment",
    category: "deflection",
    difficulty: "advanced",
    initialFen: "8/8/8/3k4/1p6/1P6/3K4/2B5 w - - 0 1",
    sideToMove: "white",
    unseenMoves: ["Kd3", "Kc5"],
    prompt:
      "Visualize 1. Kd3 Kc5. Black's king defends the b4-pawn. How does White's bishop deliver a check to disrupt the defensive setup?",
    solutionMove: "Be3+",
    tacticalTheme: "Diagonal deflection & zugzwang",
    explanation:
      "1. Be3+! forces Black's king away from the ideal blockading square, allowing White's King to infiltrate."
  },
  {
    id: "underpromotion-stalemate-trick",
    title: "Promotion Tactics: Queen Check on a8",
    category: "breakthrough",
    difficulty: "intermediate",
    initialFen: "8/P7/8/8/8/8/6k1/4K2r w - - 0 1",
    sideToMove: "white",
    unseenMoves: ["Ke2", "Ra1"],
    prompt:
      "Visualize 1. Ke2 Ra1. Black's rook got behind the passed pawn on a1. How does White promote the a7-pawn decisively?",
    solutionMove: "a8=Q+",
    alternativeSolutions: ["a8=R+"],
    tacticalTheme: "Pawn promotion with tempo",
    explanation:
      "1. a8=Q+! promotes with check! Black must deal with the check (e.g. 2... Rxa8 3. Rxa8) rather than capturing the newly created piece for free."
  },
  {
    id: "knight-vs-pawn-barrier",
    title: "Knight Fortress: Eliminating the Last Pawn",
    category: "pawn-race",
    difficulty: "beginner",
    initialFen: "8/8/8/8/6p1/5N2/4K3/7k w - - 0 1",
    sideToMove: "white",
    unseenMoves: ["Kf2", "g3+"],
    prompt:
      "Visualize 1. Kf2 g3+. Black desperately advances the g-pawn with check. What is White's cleanest capture to neutralize Black's only weapon?",
    solutionMove: "Kxg3",
    tacticalTheme: "Eliminating the last pawn",
    explanation:
      "1. Kxg3! leaves Black with a lone king cornered on h1, resulting in an immediate technical draw."
  },
  {
    id: "three-pawn-breakthrough",
    title: "The Classical 3-vs-3 Pawn Breakthrough",
    category: "breakthrough",
    difficulty: "intermediate",
    initialFen: "8/ppp5/8/PPP5/8/8/8/k1K5 w - - 0 1",
    sideToMove: "white",
    unseenMoves: ["b6", "axb6", "c6", "bxc6"],
    prompt:
      "Visualize the legendary breakthrough: 1. b6 axb6 2. c6 bxc6. Both flank pawns have traded off their neighbors. What is White's decisive breakthrough sprint?",
    solutionMove: "a6",
    tacticalTheme: "Pawn sacrifice for a queen",
    explanation:
      "1. a6! creates an unstoppable passer on the a-file. Neither Black pawn nor the cornered king can catch the pawn before it promotes to a Queen on a8."
  }
];
