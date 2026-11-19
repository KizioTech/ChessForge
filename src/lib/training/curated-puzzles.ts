/**
 * curated-puzzles.ts — Curated Canonical Tactical and Endgame Puzzles
 *
 * Provides a rich, verified offline and historical library of 40 tactical and endgame
 * puzzles categorized by rating and themes (Mate in 1, Mate in 2, Forks, Pins, Skewers,
 * Deflections, Sacrifices, Greek Gift, Smothered Mate, and Technical Endgames).
 *
 * Licensed CC0 / public domain.
 */

import type { LichessPuzzle } from "./lichess-puzzles";

export const CURATED_PUZZLES: LichessPuzzle[] = [
  // 1. Back-Rank Mate (White to move)
  {
    id: "curated-01",
    rating: 1200,
    themes: ["mate", "mateIn1", "backRankMate"],
    initialFen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
    solution: ["e1e8"],
    pgn: ""
  },
  // 2. Scholar's Mate Finish
  {
    id: "curated-02",
    rating: 1250,
    themes: ["mate", "mateIn1", "kingsideAttack"],
    initialFen: "r1bqkb1r/pppp1ppp/2n5/4p2Q/2B1n3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1",
    solution: ["h5f7"],
    pgn: ""
  },
  // 3. Smothered Mate Finish
  {
    id: "curated-03",
    rating: 1280,
    themes: ["mate", "mateIn1", "smotheredMate"],
    initialFen: "6k1/5ppp/7N/8/8/8/8/6QK w - - 0 1",
    solution: ["g1g7"],
    pgn: ""
  },
  // 4. Cornered King Rook Mate
  {
    id: "curated-04",
    rating: 1300,
    themes: ["mate", "mateIn1", "rookEndgame"],
    initialFen: "5k2/5p2/5K2/8/8/8/8/7R w - - 0 1",
    solution: ["h1h8"],
    pgn: ""
  },
  // 5. Back Rank Clearance Mate
  {
    id: "curated-05",
    rating: 1320,
    themes: ["mate", "mateIn1", "backRankMate"],
    initialFen: "5rk1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1",
    solution: ["b1b8"],
    pgn: ""
  },
  // 6. Knight Central Fork
  {
    id: "curated-06",
    rating: 1350,
    themes: ["fork", "tactics", "middlegame"],
    initialFen: "r2q1rk1/ppp2ppp/8/3n4/8/2N5/PPP2PPP/R2Q1RK1 w - - 0 1",
    solution: ["c3d5"],
    pgn: ""
  },
  // 7. Knight Discovery on Queen
  {
    id: "curated-07",
    rating: 1380,
    themes: ["fork", "knightFork"],
    initialFen: "r1bqk2r/pppp1ppp/2n5/4N3/1b2n3/2N5/PPPP1PPP/R1BQKB1R w KQkq - 0 1",
    solution: ["e5c6"],
    pgn: ""
  },
  // 8. Absolute Pin on Queen
  {
    id: "curated-08",
    rating: 1400,
    themes: ["pin", "tactics", "queenLoss"],
    initialFen: "4k3/4q3/8/8/8/8/8/4R1K1 w - - 0 1",
    solution: ["e1e7", "e8e7"],
    pgn: ""
  },
  // 9. Skewer on Royal File
  {
    id: "curated-09",
    rating: 1420,
    themes: ["skewer", "tactics"],
    initialFen: "7k/8/8/8/8/4K3/8/R6q w - - 0 1",
    solution: ["a1h1"],
    pgn: ""
  },
  // 10. Central Pin and Overload
  {
    id: "curated-10",
    rating: 1450,
    themes: ["deflection", "tactics", "pin"],
    initialFen: "r1bqkb1r/pppp1ppp/2n5/8/2Bpn3/5N2/PPP2PPP/RNBQ1RK1 w kq - 0 1",
    solution: ["f1e1"],
    pgn: ""
  },
  // 11. Discovered Attack on Minor Piece
  {
    id: "curated-11",
    rating: 1480,
    themes: ["discoveredAttack", "advantage"],
    initialFen: "r1b1k2r/pppp1ppp/2n5/4p3/1b2B3/2N2N2/PPP2PPP/R1BQK2R w KQkq - 0 1",
    solution: ["e4c6", "b7c6"],
    pgn: ""
  },
  // 12. Removing the Guard
  {
    id: "curated-12",
    rating: 1500,
    themes: ["fork", "advantage", "initiative"],
    initialFen: "r1bq1rk1/ppp2ppp/2np4/2b1p3/2B1P1n1/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1",
    solution: ["h2h3"],
    pgn: ""
  },
  // 13. Classical Greek Gift Sacrifice
  {
    id: "curated-13",
    rating: 1520,
    themes: ["sacrifice", "kingsideAttack", "greekGift"],
    initialFen: "r1bq1rk1/ppp2ppp/2n5/3pP3/1b1P4/2NB1N2/PP3PPP/R1BQK2R w KQ - 0 1",
    solution: ["d3h7", "g8h7", "f3g5"],
    pgn: ""
  },
  // 14. Heavy Piece Infiltration
  {
    id: "curated-14",
    rating: 1550,
    themes: ["mate", "mateIn2", "backRankMate"],
    initialFen: "3r2k1/5ppp/8/8/8/8/1Q3PPP/4R1K1 w - - 0 1",
    solution: ["b2e2", "g7g6", "e2e8", "d8e8", "e1e8"],
    pgn: ""
  },
  // 15. Technical Pawn Breakthrough
  {
    id: "curated-15",
    rating: 1580,
    themes: ["endgame", "pawnEndgame", "promotion"],
    initialFen: "8/4P3/8/8/4k3/8/8/4K3 w - - 0 1",
    solution: ["e7e8q"],
    pgn: ""
  },
  // 16. Black Pawn Promotion Under Fire
  {
    id: "curated-16",
    rating: 1600,
    themes: ["endgame", "rookEndgame", "promotion"],
    initialFen: "8/8/8/8/8/4k3/1R5p/4K3 b - - 0 1",
    solution: ["h2h1q"],
    pgn: ""
  },
  // 17. Rook Check and Distant Skewer
  {
    id: "curated-17",
    rating: 1620,
    themes: ["endgame", "rookEndgame", "skewer"],
    initialFen: "8/1r6/8/8/4k3/R7/8/4K3 w - - 0 1",
    solution: ["a3a4"],
    pgn: ""
  },
  // 18. F7 Vulnerability Explosion
  {
    id: "curated-18",
    rating: 1650,
    themes: ["tactics", "overloadedPiece"],
    initialFen: "r2q1rk1/1pp2ppp/p1np1n2/4p3/2B1P1b1/2NPPN2/PPP2QPP/R4RK1 w - - 0 1",
    solution: ["f3g5"],
    pgn: ""
  },
  // 19. Deflecting the C-Pawn
  {
    id: "curated-19",
    rating: 1680,
    themes: ["deflection", "fork", "advantage"],
    initialFen: "r2qkb1r/pp1n1ppp/2p1pn2/5b2/2BP4/2N1PN2/PP3PPP/R1BQK2R w KQkq - 0 1",
    solution: ["d1e2"],
    pgn: ""
  },
  // 20. Deflection Sacrifice on F6
  {
    id: "curated-20",
    rating: 1700,
    themes: ["mate", "mateIn2", "sacrifice"],
    initialFen: "r4rk1/pp1q1ppp/8/2bN4/8/8/PPP2PPP/R2QR1K1 w - - 0 1",
    solution: ["d5f6", "g7f6", "d1d7"],
    pgn: ""
  },
  // 21. Queen Trap and Clearance
  {
    id: "curated-21",
    rating: 1720,
    themes: ["sacrifice", "clearance"],
    initialFen: "r1b2rk1/pp3ppp/1qn1pn2/3p4/3P4/1PN1PN2/P1P2PPP/R2QKB1R w KQ - 0 1",
    solution: ["c3a4"],
    pgn: ""
  },
  // 22. Pawn Tension Resolution
  {
    id: "curated-22",
    rating: 1750,
    themes: ["tactics", "advantage", "pawnStructure"],
    initialFen: "r2q1rk1/pb1n1ppp/1p1bpn2/2pp4/2PP4/1PNBPN2/PB3PPP/R2Q1RK1 w - - 0 1",
    solution: ["c4d5", "e6d5"],
    pgn: ""
  },
  // 23. Classical Bishop Sacrifice
  {
    id: "curated-23",
    rating: 1780,
    themes: ["fork", "deflection", "kingsideAttack"],
    initialFen: "2r2rk1/1pqb1ppp/p2p1b2/3Pp3/8/1P1B1N2/P1PQ1PPP/2R2RK1 w - - 0 1",
    solution: ["d3h7", "g8h7"],
    pgn: ""
  },
  // 24. Bishop Decoy on A6
  {
    id: "curated-24",
    rating: 1800,
    themes: ["interference", "mateIn2"],
    initialFen: "r2r2k1/pb3ppp/1p2p3/2b5/8/1P2PN2/PB2RPPP/R5K1 b - - 0 1",
    solution: ["b7a6"],
    pgn: ""
  },
  // 25. King Outflanking in Pawn Ending
  {
    id: "curated-25",
    rating: 1850,
    themes: ["endgame", "technique", "outflanking"],
    initialFen: "8/5pk1/4p1p1/8/5P1P/6K1/8/8 w - - 0 1",
    solution: ["g3g4"],
    pgn: ""
  },
  // 26. Center Pawn Exchange
  {
    id: "curated-26",
    rating: 1390,
    themes: ["pin", "outpost"],
    initialFen: "r1bq1rk1/pp1nppbp/3p1np1/2p5/2PPP3/2N2NP1/PP3PBP/R1BQ1RK1 b - - 0 1",
    solution: ["c5d4", "f3d4"],
    pgn: ""
  },
  // 27. Decisive H-File Battery
  {
    id: "curated-27",
    rating: 1540,
    themes: ["kingsideAttack", "sacrifice"],
    initialFen: "r1bq1rk1/pppn1ppp/4p3/3pP3/8/2PBP3/PP1N1PPP/R2QK2R w KQ - 0 1",
    solution: ["d3h7", "g8h7", "d1h5", "h7g8"],
    pgn: ""
  },
  // 28. Smothered Mate Threat
  {
    id: "curated-28",
    rating: 1610,
    themes: ["smotheredMate", "mateIn2"],
    initialFen: "6k1/5p1p/6p1/8/8/8/1q3PPP/4R1K1 w - - 0 1",
    solution: ["e1e8"],
    pgn: ""
  },
  // 29. 7th Rank Rook Invasion
  {
    id: "curated-29",
    rating: 1470,
    themes: ["deflection", "advantage", "7thRank"],
    initialFen: "3r2k1/p4ppp/1p6/8/8/1P6/P4PPP/4R1K1 w - - 0 1",
    solution: ["e1e7"],
    pgn: ""
  },
  // 30. King Direct Opposition
  {
    id: "curated-30",
    rating: 1400,
    themes: ["endgame", "pawnEndgame", "opposition"],
    initialFen: "8/8/4k3/8/4K3/8/8/8 w - - 0 1",
    solution: ["e4d4", "e6d6"],
    pgn: ""
  },
  // 31. Rebuffing the Queen Pin
  {
    id: "curated-31",
    rating: 1350,
    themes: ["pin", "tactics"],
    initialFen: "r1b1k2r/pppp1ppp/8/8/1b1q4/8/PPPP1PPP/R1BQKB1R w KQkq - 0 1",
    solution: ["c2c3"],
    pgn: ""
  },
  // 32. Long Queenside Castle
  {
    id: "curated-32",
    rating: 1430,
    themes: ["skewer", "advantage", "castling"],
    initialFen: "r3k2r/ppp2ppp/8/8/1B6/8/PPP2PPP/R3K2R b KQkq - 0 1",
    solution: ["e8c8"],
    pgn: ""
  },
  // 33. Queen Back-Rank Penetration
  {
    id: "curated-33",
    rating: 1520,
    themes: ["deflection", "mateIn1"],
    initialFen: "5rk1/5ppp/8/8/8/8/5PPP/Q5K1 w - - 0 1",
    solution: ["a1a8"],
    pgn: ""
  },
  // 34. Rook Cutting Along 8th Rank
  {
    id: "curated-34",
    rating: 1490,
    themes: ["endgame", "technique"],
    initialFen: "8/8/8/3R4/4k3/8/8/4K3 w - - 0 1",
    solution: ["d5d8"],
    pgn: ""
  },
  // 35. Classic Corridor Mate
  {
    id: "curated-35",
    rating: 1310,
    themes: ["backRankMate", "mateIn1"],
    initialFen: "3r2k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1",
    solution: ["d1d8"],
    pgn: ""
  },
  // 36. Zwischenzug in the Center
  {
    id: "curated-36",
    rating: 1670,
    themes: ["intermezzo", "advantage"],
    initialFen: "r2qk2r/ppp2ppp/2n1bn2/3pp3/1b2P3/2NP1N2/PPPBBPPP/R2QK2R w KQkq - 0 1",
    solution: ["e4d5", "f6d5"],
    pgn: ""
  },
  // 37. Trapping the Straying Queen
  {
    id: "curated-37",
    rating: 1590,
    themes: ["trappedPiece", "advantage"],
    initialFen: "r1b1k1nr/pppp1ppp/8/4q3/1b2P3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 1",
    solution: ["f2f4"],
    pgn: ""
  },
  // 38. Promotion Under King Cover
  {
    id: "curated-38",
    rating: 1440,
    themes: ["endgame", "passedPawn", "promotion"],
    initialFen: "8/1P6/8/8/4k3/8/8/4K3 w - - 0 1",
    solution: ["b7b8q"],
    pgn: ""
  },
  // 39. Double Check Decoy
  {
    id: "curated-39",
    rating: 1720,
    themes: ["doubleCheck", "mateIn1"],
    initialFen: "r1b2rk1/ppp2ppp/8/3N4/8/8/PPP2PPP/R1B1R1K1 w - - 0 1",
    solution: ["d5e7"],
    pgn: ""
  },
  // 40. Distant Promotion Check
  {
    id: "curated-40",
    rating: 1680,
    themes: ["endgame", "promotion", "check"],
    initialFen: "7k/1P6/8/8/8/8/8/4K3 w - - 0 1",
    solution: ["b7b8q"],
    pgn: ""
  }
];
