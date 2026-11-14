/**
 * theory-lines.ts: Deep, master-level theoretical main lines (8 to 13 full moves / 16 to 26 plies).
 *
 * Provides real master continuations for all common openings and variations,
 * replacing 2-4 move definition stubs with comprehensive repertoire lines.
 */

export interface TheoryLine {
  eco: string;
  name: string;
  pgn: string;
  side: "white" | "black";
}

export const DEEP_THEORY_LINES: TheoryLine[] = [
  // ── Italian Game (C50–C59) ──────────────────────────────────────────────────
  {
    eco: "C50",
    name: "Italian Game: Giuoco Piano Main Line",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O a6 7. a4 Ba7 8. Re1 O-O 9. Nbd2 h6",
    side: "white"
  },
  {
    eco: "C52",
    name: "Italian Game: Evans Gambit Accepted, Main Line",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O dxc3 8. Qb3 Qf6 9. e5 Qg6 10. Nxc3 Nge7",
    side: "white"
  },
  {
    eco: "C55",
    name: "Italian Game: Two Knights Defense, Modern Main Line",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Be7 5. O-O O-O 6. Re1 d6 7. a4 Be6 8. Nbd2 Qd7 9. c3 Rae8",
    side: "white"
  },
  {
    eco: "C58",
    name: "Italian Game: Two Knights Defense, Polerio Defense",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Na5 6. Bb5+ c6 7. dxc6 bxc6 8. Bd3 Nd5 9. Nf3 Bd6 10. O-O O-O",
    side: "black"
  },

  // ── Ruy Lopez (Spanish Opening, C60–C99) ────────────────────────────────────
  {
    eco: "C97",
    name: "Ruy Lopez: Closed, Chigorin Defense",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Na5 10. Bc2 c5 11. d4 Qc7 12. Nbd2",
    side: "black"
  },
  {
    eco: "C95",
    name: "Ruy Lopez: Closed, Breyer Defense",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7",
    side: "black"
  },
  {
    eco: "C65",
    name: "Ruy Lopez: Berlin Defense, L'Hermet Variation",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 Nd6 6. Bxc6 dxc6 7. dxe5 Nf5 8. Qxd8+ Kxd8 9. Nc3 Ke8",
    side: "black"
  },
  {
    eco: "C80",
    name: "Ruy Lopez: Open Defense, Main Line",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Nxe4 6. d4 b5 7. Bb3 d5 8. dxe5 Be6 9. Nbd2 Nc5 10. c3 Be7",
    side: "black"
  },
  {
    eco: "C89",
    name: "Ruy Lopez: Marshall Attack",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 11. Rxe5 c6",
    side: "black"
  },

  // ── Sicilian Defense (B20–B99) ──────────────────────────────────────────────
  {
    eco: "B90",
    name: "Sicilian Defense: Najdorf Variation, English Attack",
    pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6 8. f3 Be7 9. Qd2 O-O 10. O-O-O Nbd7 11. g4 b5",
    side: "black"
  },
  {
    eco: "B99",
    name: "Sicilian Defense: Najdorf Variation, Classical 6.Bg5",
    pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Bg5 e6 7. f4 Be7 8. Qf3 Qc7 9. O-O-O Nbd7 10. g4 b5",
    side: "black"
  },
  {
    eco: "B78",
    name: "Sicilian Defense: Dragon Variation, Yugoslav Attack",
    pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6 9. Bc4 Bd7 10. O-O-O Rc8 11. Bb3 Ne5",
    side: "black"
  },
  {
    eco: "B80",
    name: "Sicilian Defense: Scheveningen Variation, English Attack",
    pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e6 6. Be3 a6 7. f3 b5 8. Qd2 Nbd7 9. g4 Nb6 10. O-O-O Bb7",
    side: "black"
  },
  {
    eco: "B64",
    name: "Sicilian Defense: Classical Variation, Richter-Rauzer Attack",
    pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 Nc6 6. Bg5 e6 7. Qd2 a6 8. O-O-O Bd7 9. f4 Be7 10. Nf3 b5",
    side: "black"
  },
  {
    eco: "B22",
    name: "Sicilian Defense: Alapin Variation, Main Line",
    pgn: "1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. d4 Nf6 5. Nf3 e6 6. Be2 Nc6 7. O-O cxd4 8. cxd4 Be7 9. Nc3 Qd6 10. Be3 O-O",
    side: "white"
  },
  {
    eco: "B23",
    name: "Sicilian Defense: Closed Variation, Main Line",
    pgn: "1. e4 c5 2. Nc3 Nc6 3. g3 g6 4. Bg2 Bg7 5. d3 d6 6. f4 e6 7. Nf3 Nge7 8. O-O O-O 9. Be3 Nd4 10. e5 Nef5",
    side: "white"
  },

  // ── French Defense (C00–C19) ────────────────────────────────────────────────
  {
    eco: "C18",
    name: "French Defense: Winawer Variation, Advance Variation",
    pgn: "1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. e5 c5 5. a3 Bxc3+ 6. bxc3 Ne7 7. Qg4 Qc7 8. Qxg7 Rg8 9. Qxh7 cxd4 10. Ne2 Nbc6 11. f4 Bd7 12. Qd3 dxc3",
    side: "black"
  },
  {
    eco: "C11",
    name: "French Defense: Classical Variation, Steinitz",
    pgn: "1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. e5 Nfd7 5. f4 c5 6. Nf3 Nc6 7. Be3 a6 8. Qd2 b5 9. a3 Be7 10. Be2 O-O",
    side: "black"
  },
  {
    eco: "C02",
    name: "French Defense: Advance Variation, Paulsen",
    pgn: "1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 6. a3 Nh6 7. b4 cxd4 8. cxd4 Nf5 9. Bb2 Bd7 10. Be2",
    side: "white"
  },
  {
    eco: "C07",
    name: "French Defense: Tarrasch Variation, Open System",
    pgn: "1. e4 e6 2. d4 d5 3. Nd2 c5 4. exd5 exd5 5. Ngf3 Nc6 6. Bb5 Bd6 7. dxc5 Bxc5 8. O-O Ne7 9. Nb3 Bd6",
    side: "black"
  },

  // ── Caro-Kann Defense (B10–B19) ─────────────────────────────────────────────
  {
    eco: "B18",
    name: "Caro-Kann Defense: Classical Variation, Capablanca",
    pgn: "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7 8. h5 Bh7 9. Bd3 Bxd3 10. Qxd3 e6 11. Bd2 Ngf6 12. O-O-O",
    side: "black"
  },
  {
    eco: "B12",
    name: "Caro-Kann Defense: Advance Variation, Short System",
    pgn: "1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 c5 6. Be3 Qb6 7. Nc3 Nc6 8. O-O Qxb2 9. Qe1 cxd4 10. Bxd4 Nxd4 11. Nxd4",
    side: "white"
  },
  {
    eco: "B14",
    name: "Caro-Kann Defense: Panov-Botvinnik Attack",
    pgn: "1. e4 c6 2. d4 d5 3. exd5 cxd5 4. c4 Nf6 5. Nc3 e6 6. Nf3 Be7 7. cxd5 Nxd5 8. Bd3 Nc6 9. O-O O-O 10. Re1 Bf6",
    side: "white"
  },

  // ── Queen's Gambit Declined & Slav (D10–D69) ────────────────────────────────
  {
    eco: "D35",
    name: "Queen's Gambit Declined: Exchange Variation, Positional",
    pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5 exd5 5. Bg5 c6 6. e3 Be7 7. Bd3 Nbd7 8. Qc2 O-O 9. Nge2 Re8 10. O-O Nf8",
    side: "white"
  },
  {
    eco: "D58",
    name: "Queen's Gambit Declined: Tartakower Defense",
    pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 h6 7. Bh4 b6 8. cxd5 Nxd5 9. Bxe7 Qxe7 10. Nxd5 exd5 11. Rc1 Be6",
    side: "black"
  },
  {
    eco: "D15",
    name: "Slav Defense: Classical Main Line",
    pgn: "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 Bf5 6. e3 e6 7. Bxc4 Bb4 8. O-O O-O 9. Qe2 Nbd7 10. e4 Bg6",
    side: "black"
  },
  {
    eco: "D45",
    name: "Semi-Slav Defense: Meran Variation",
    pgn: "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 e6 5. e3 Nbd7 6. Bd3 dxc4 7. Bxc4 b5 8. Bd3 a6 9. e4 c5 10. d5 c4 11. Bc2 Qc7",
    side: "black"
  },
  {
    eco: "D27",
    name: "Queen's Gambit Accepted: Classical Defense",
    pgn: "1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 e6 5. Bxc4 c5 6. O-O a6 7. Bb3 cxd4 8. exd4 Nc6 9. Nc3 Be7",
    side: "white"
  },

  // ── King's Indian & Grünfeld (E60–E99, D70–D99) ─────────────────────────────
  {
    eco: "E99",
    name: "King's Indian Defense: Classical, Mar del Plata Variation",
    pgn: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6 8. d5 Ne7 9. Ne1 Nd7 10. Be3 f5 11. f3 f4 12. Bf2 g5 13. a4 Ng6",
    side: "black"
  },
  {
    eco: "E81",
    name: "King's Indian Defense: Sämisch Variation",
    pgn: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f3 O-O 6. Be3 c5 7. Nge2 Nc6 8. d5 Ne5 9. Ng3 e6 10. Be2 exd5 11. cxd5",
    side: "white"
  },
  {
    eco: "D85",
    name: "Grünfeld Defense: Exchange Variation, Modern",
    pgn: "1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. cxd5 Nxd5 5. e4 Nxc3 6. bxc3 Bg7 7. Bc4 c5 8. Ne2 O-O 9. O-O Nc6 10. Be3 cxd4 11. cxd4 Bg4 12. f3 Na5 13. Bd3 Be6",
    side: "black"
  },

  // ── Nimzo-Indian & Bogo-Indian (E20–E59) ────────────────────────────────────
  {
    eco: "E32",
    name: "Nimzo-Indian Defense: Classical Variation, 4.Qc2",
    pgn: "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 O-O 5. a3 Bxc3+ 6. Qxc3 b6 7. Bg5 Bb7 8. f3 d6 9. e3 Nbd7 10. Bd3 c5",
    side: "white"
  },
  {
    eco: "E48",
    name: "Nimzo-Indian Defense: Rubinstein System",
    pgn: "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 O-O 5. Bd3 d5 6. Nf3 c5 7. O-O Nc6 8. a3 Bxc3 9. bxc3 dxc4 10. Bxc4 Qc7",
    side: "black"
  },

  // ── Flank & 1.d4 Alternatives ───────────────────────────────────────────────
  {
    eco: "D02",
    name: "London System: Main Line",
    pgn: "1. d4 d5 2. Bf4 Nf6 3. e3 c5 4. c3 Nc6 5. Nd2 e6 6. Ngf3 Bd6 7. Bg3 O-O 8. Bd3 b6 9. Ne5 Bb7 10. f4 Ne7",
    side: "white"
  },
  {
    eco: "E04",
    name: "Catalan Opening: Open Catalan, Main Line",
    pgn: "1. d4 Nf6 2. c4 e6 3. g3 d5 4. Bg2 dxc4 5. Nf3 Be7 6. O-O O-O 7. Qc2 a6 8. Qxc4 b5 9. Qc2 Bb7 10. Bd2 Be4 11. Qc1 Bb7",
    side: "white"
  },
  {
    eco: "A29",
    name: "English Opening: King's English, Four Knights Variation",
    pgn: "1. c4 e5 2. Nc3 Nf6 3. Nf3 Nc6 4. g3 d5 5. cxd5 Nxd5 6. Bg2 Nb6 7. O-O Be7 8. a3 O-O 9. b4 Be6 10. d3 f6",
    side: "white"
  },
  {
    eco: "C45",
    name: "Scotch Game: Mieses Variation",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nxc6 bxc6 6. e5 Qe7 7. Qe2 Nd5 8. c4 Ba6 9. b3 g6 10. g3 Bg7 11. Bb2 O-O",
    side: "white"
  },
  {
    eco: "B01",
    name: "Scandinavian Defense: Main Line, 3...Qa5",
    pgn: "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 c6 6. Bc4 Bf5 7. Bd2 e6 8. Nd5 Qd8 9. Nxf6+ Qxf6 10. Qe2 Nd7",
    side: "black"
  },
  {
    eco: "B01",
    name: "Scandinavian Defense: Modern Variation, 2...Nf6",
    pgn: "1. e4 d5 2. exd5 Nf6 3. d4 Nxd5 4. Nf3 g6 5. Be2 Bg7 6. O-O O-O 7. c4 Nb6 8. Nc3 Nc6 9. Be3 Bg4 10. c5 Nd5",
    side: "white"
  },
  {
    eco: "B04",
    name: "Alekhine Defense: Modern Variation",
    pgn: "1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. Nf3 Bg4 5. Be2 e6 6. O-O Be7 7. c4 Nb6 8. Nc3 O-O 9. Be3 d5 10. c5 Bxf3 11. Bxf3 Nc4",
    side: "white"
  },
  {
    eco: "A65",
    name: "Benoni Defense: Modern Main Line",
    pgn: "1. d4 Nf6 2. c4 c5 3. d5 e6 4. Nc3 exd5 5. cxd5 d6 6. e4 g6 7. Nf3 Bg7 8. Be2 O-O 9. O-O a6 10. a4 Re8 11. Nd2 Nbd7",
    side: "black"
  },
  {
    eco: "A07",
    name: "King's Indian Attack: Closed System",
    pgn: "1. Nf3 d5 2. g3 Nf6 3. Bg2 e6 4. O-O Be7 5. d3 O-O 6. Nbd2 c5 7. e4 Nc6 8. Re1 b5 9. e5 Nd7 10. Nf1 a5 11. h4 b4",
    side: "white"
  },
  {
    eco: "C42",
    name: "Petrov's Defense: Classical Attack, 4.Nf3",
    pgn: "1. e4 e5 2. Nf3 Nf6 3. Nxe5 d6 4. Nf3 Nxe4 5. d4 d5 6. Bd3 Be7 7. O-O Nc6 8. c4 Nb4 9. Be2 O-O 10. Nc3 Bf5",
    side: "white"
  },
  {
    eco: "B08",
    name: "Pirc Defense: Classical Variation",
    pgn: "1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Nf3 Bg7 5. Be2 O-O 6. O-O c6 7. a4 a5 8. h3 Qc7 9. Be3 e5",
    side: "black"
  }
];
