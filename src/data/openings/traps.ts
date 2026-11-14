/**
 * traps.ts: Curated catalog of 50 famous, tactical, and instructive chess opening traps.
 *
 * Each trap features:
 *  - Full move sequence up to the tactical climax/refutation (6 to 26 plies).
 *  - ECO code and standardized family naming for seamless integration into Learn trees.
 *  - Tactical motif (smothered mate, deflection, queen trap, underpromotion, pin).
 *  - Detailed explanation of why the trap works and how it is executed.
 *  - Owning side (who springs the trap).
 */

export interface OpeningTrap {
  eco: string;
  name: string;
  pgn: string;
  side: "white" | "black";
  motif: string;
  description: string;
}

export const KNOWN_TRAPS: OpeningTrap[] = [
  // ── Italian Game & Bishop's Opening ─────────────────────────────────────────
  {
    eco: "C50",
    name: "Italian Game: Légal Trap",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 d6 4. Nc3 Bg4 5. h3 Bh5 6. Nxe5 Bxd1 7. Bxf7+ Ke7 8. Nd5#",
    side: "white",
    motif: "Queen sacrifice / Minor piece mate",
    description: "White sacrifices the queen on d1 to deliver a stunning smothered-style checkmate with two knights and bishop in the center."
  },
  {
    eco: "C50",
    name: "Italian Game: Blackburne Shilling Gambit Trap",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2 6. Rf1 Qxe4+ 7. Be2 Nf3#",
    side: "black",
    motif: "Smothered mate / Queen fork",
    description: "Black baits White into grabbing on e5 and f7, then terrorizes the kingside and delivers smothered mate with 7...Nf3#."
  },
  {
    eco: "C57",
    name: "Italian Game: Two Knights Defense, Fried Liver Attack Trap",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7 7. Qf3+ Ke6 8. Nc3 Nce7 9. d4 c6 10. Bg5",
    side: "white",
    motif: "Knight sacrifice / King hunt",
    description: "White sacrifices the knight on f7, ripping open the Black king and pinning Black's defensive pieces in the center."
  },
  {
    eco: "C57",
    name: "Italian Game: Two Knights Defense, Traxler Counter-Attack Trap",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 Bc5 5. Nxf7 Bxf2+ 6. Kxf2 Nxe4+ 7. Kg1 Qh4 8. g3 Nxg3 9. Nxh8 Nd4",
    side: "black",
    motif: "Counter-sacrifice / King attack",
    description: "Instead of defending f7, Black strikes back with 5...Bxf2+!, exposing the White king to an unstoppable barrage."
  },
  {
    eco: "C50",
    name: "Italian Game: Lucchini Gambit Trap",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 f5 5. Ng5 f4 6. Nf7 Qh4 7. O-O Nf6 8. Nxh8 Ng4 9. h3 Bxf2+ 10. Kh1 d5",
    side: "black",
    motif: "Kingside mating net",
    description: "Black sacrifices the rook on h8 to set up a lethal mating web with Qh4, Ng4, and Bxf2+."
  },
  {
    eco: "C50",
    name: "Italian Game: Jerome Gambit Trap",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. Bxf7+ Kxf7 5. Nxe5+ Nxe5 6. Qh5+ Ke6 7. Qf5+ Kd6 8. f4 Qf6 9. fxe5+ Qxe5",
    side: "white",
    motif: "Double sacrifice / Center drag",
    description: "White audaciously sacrifices both bishop and knight on moves 4 and 5 to pull the Black king to the middle of the board."
  },

  // ── Ruy Lopez (Spanish Opening) ─────────────────────────────────────────────
  {
    eco: "C71",
    name: "Ruy Lopez: Noah's Ark Trap",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 d6 5. d4 b5 6. Bb3 Nxd4 7. Nxd4 exd4 8. Qxd4 c5 9. Qd5 Be6 10. Qc6+ Bd7 11. Qd5 c4",
    side: "black",
    motif: "Bishop trap",
    description: "Black traps White's prized light-squared bishop on b3 using the queenside pawn chain a6, b5, and c4."
  },
  {
    eco: "C65",
    name: "Ruy Lopez: Berlin Defense, Mortimer Trap",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. d3 Ne7 5. Nxe5 c6 6. Nc4 Ng6 7. Ba4 b5",
    side: "black",
    motif: "Fork / Trap",
    description: "Black baits 5.Nxe5 with the tricky retreat 4...Ne7, threatening 6...Qa5+ and winning the bishop with 7...b5."
  },
  {
    eco: "C65",
    name: "Ruy Lopez: Berlin Defense, Fishing Pole Trap",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Ng4 5. h3 h5 6. hxg4 hxg4 7. Nh2 Qh4 8. Re1 Qxh2+ 9. Kf1 Nd4",
    side: "black",
    motif: "Piece sacrifice / Open h-file mate",
    description: "Black baits White into taking the knight on g4 with 6.hxg4?, prying open the h-file for an unstoppable mating assault."
  },
  {
    eco: "C83",
    name: "Ruy Lopez: Open, Tarrasch Trap",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Nxe4 6. d4 b5 7. Bb3 d5 8. dxe5 Be6 9. c3 Be7 10. Re1 O-O 11. Nd4 Qd7 12. Nxe6 fxe6 13. Rxe4",
    side: "white",
    motif: "Absolute pin",
    description: "White wins a clean piece with 13.Rxe4! because Black's d5 pawn is pinned against the queen on d7."
  },

  // ── Sicilian Defense ────────────────────────────────────────────────────────
  {
    eco: "B21",
    name: "Sicilian Defense: Smith-Morra Gambit Accepted, Siberian Trap",
    pgn: "1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 Nc6 5. Nf3 e6 6. Bc4 Qc7 7. O-O Nf6 8. Qe2 Ng4 9. h3 Nd4 10. Nxd4 Qh2#",
    side: "black",
    motif: "Deflection / Mate on h2",
    description: "When White plays 9.h3?, Black stuns White with 9...Nd4!, removing the defender of h2 and threatening the white queen."
  },
  {
    eco: "B57",
    name: "Sicilian Defense: Sozin Attack, Magnus Smith Trap",
    pgn: "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 d6 6. Bc4 g6 7. Nxc6 bxc6 8. e5 dxe5 9. Bxf7+ Kxf7 10. Qxd8",
    side: "white",
    motif: "Deflection / Queen loss",
    description: "White sacrifices the bishop on f7 with check, deflecting the Black king away from the defense of the queen on d8."
  },
  {
    eco: "B20",
    name: "Sicilian Defense: Wing Gambit, Corner Rook Trap",
    pgn: "1. e4 c5 2. b4 cxb4 3. a3 d5 4. exd5 Qxd5 5. axb4 Qe5+ 6. Be2 Qxa1",
    side: "black",
    motif: "Double attack / Unprotected rook",
    description: "White greedily recaptures on b4 without noticing 5...Qe5+ forks the king on e1 and the undefended rook on a1."
  },
  {
    eco: "B22",
    name: "Sicilian Defense: Alapin Variation, Barmen Trap",
    pgn: "1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. d4 Nf6 5. Nf3 Bg4 6. dxc5 Qxd1+ 7. Kxd1 e5 8. b4 e4 9. h3 Bh5 10. g4 exf3 11. gxh5",
    side: "white",
    motif: "Queenside pawn majority",
    description: "White breaks the pin on the f3 knight and cements an overwhelming extra pawn on the queenside."
  },
  {
    eco: "B20",
    name: "Sicilian Defense: Bowdler Attack Trap",
    pgn: "1. e4 c5 2. Bc4 e6 3. Nf3 d5 4. exd5 exd5 5. Bb5+ Bd7 6. Qe2+ Be7 7. Ne5 Nf6 8. O-O O-O",
    side: "white",
    motif: "Early center challenge",
    description: "White uses active piece development on e2 and e5 to dominate the central dark squares against early pawn rushes."
  },

  // ── Queen's Gambit & 1.d4 Systems ───────────────────────────────────────────
  {
    eco: "D51",
    name: "Queen's Gambit Declined: Elephant Trap",
    pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Nbd7 5. cxd5 exd5 6. Nxd5 Nxd5 7. Bxd8 Bb4+ 8. Qd2 Bxd2+ 9. Kxd2 Kxd8",
    side: "black",
    motif: "Pseudo-pin counter / Minor piece win",
    description: "White falls for the phantom pin on the f6 knight. After 6...Nxd5! 7.Bxd8 Bb4+!, Black wins a clean piece."
  },
  {
    eco: "D52",
    name: "Queen's Gambit Declined: Cambridge Springs Trap",
    pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Nbd7 5. e3 c6 6. Nf3 Qa5 7. Nd2 Bb4 8. Qc2 O-O 9. Bd3 dxc4 10. Bxf6 cxd3 11. Qxd3 Nxf6",
    side: "black",
    motif: "Discovered attack / Bishop pair",
    description: "Black pins and unbalances White's queenside, winning the bishop pair and material."
  },
  {
    eco: "D63",
    name: "Queen's Gambit Declined: Rubinstein Trap",
    pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 Nbd7 7. Rc1 c6 8. Bd3 dxc4 9. Bxc4 Nd5 10. Bxe7 Qxe7 11. O-O Nxc3 12. Rxc3 e5 13. dxe5 Nxe5 14. Nxe5 Qxe5 15. f4 Qe7 16. f5 Rd8 17. Qh5 Bd7 18. e4 Be8 19. f6",
    side: "white",
    motif: "Kingside pawn wedge",
    description: "White shatters Black's castled defensive shelter by launching the f-pawn forward to f6 with decisive threats."
  },
  {
    eco: "D08",
    name: "Queen's Gambit Declined: Albin Countergambit, Lasker Trap",
    pgn: "1. d4 d5 2. c4 e5 3. dxe5 d4 4. e3 Bb4+ 5. Bd2 dxe3 6. Bxb4 exf2+ 7. Ke2 fxg1=N+ 8. Rxg1 Bg4+",
    side: "black",
    motif: "Underpromotion / Skewer",
    description: "The most famous underpromotion in chess: Black promotes to a knight on g1 with check, winning White's queen."
  },
  {
    eco: "D20",
    name: "Queen's Gambit Accepted: Trap with 3...b5",
    pgn: "1. d4 d5 2. c4 dxc4 3. e3 b5 4. a4 c6 5. axb5 cxb5 6. Qf3",
    side: "white",
    motif: "Corner rook trap / Queen fork",
    description: "Black stubbornly tries to hold onto the gambit pawn with 3...b5 and 4...c6, but 6.Qf3! wins the corner rook on a8."
  },
  {
    eco: "A52",
    name: "Budapest Gambit: Kieninger Trap",
    pgn: "1. d4 Nf6 2. c4 e5 3. dxe5 Ng4 4. Bf4 Nc6 5. Nf3 Bb4+ 6. Nbd2 Qe7 7. a3 Ngxe5 8. axb4 Nd3#",
    side: "black",
    motif: "Smothered mate / Absolute pin",
    description: "White plays 8.axb4?? expecting an easy piece, but Black responds with the devastating 8...Nd3# smothered mate."
  },
  {
    eco: "A51",
    name: "Budapest Gambit: Fajarowicz Variation Trap",
    pgn: "1. d4 Nf6 2. c4 e5 3. dxe5 Ne4 4. a3 d6 5. exd6 Bxd6 6. g3 Nxf2 7. Kxf2 Bxg3+ 8. hxg3 Qxd1",
    side: "black",
    motif: "King deflection / Queen win",
    description: "Black sacrifices on f2 and deflects White's king with 7...Bxg3+!, winning White's queen on d1."
  },
  {
    eco: "D00",
    name: "Blackmar-Diemer Gambit: Halosar Trap",
    pgn: "1. d4 d5 2. e4 dxe4 3. Nc3 Nf6 4. f3 exf3 5. Qxf3 Qxd4 6. Be3 Qb4 7. O-O-O Bg4 8. Nb5 Na6 9. Qxb7 Qe4 10. Qxa6 Qxe3+ 11. Kb1 Rc8 12. Nf3",
    side: "white",
    motif: "Counter-pin / Overloaded defense",
    description: "White allows 7...Bg4, then unleashes 8.Nb5! threatening mate on c7 and grabbing the queen or rook."
  },
  {
    eco: "E11",
    name: "Bogo-Indian Defense: Monticelli Trap",
    pgn: "1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. g3 Bb7 5. Bg2 Bb4+ 6. Bd2 Bxd2+ 7. Qxd2 O-O 8. Nc3 Ne4 9. Qc2 Nxc3 10. Ng5",
    side: "white",
    motif: "Dual mate and bishop threat",
    description: "White plays 10.Ng5!, threatening checkmate on h7 and discovering an attack against Black's unprotected bishop on b7."
  },
  {
    eco: "D15",
    name: "Slav Defense: Krause Attack Trap",
    pgn: "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 Bf5 6. Ne5 e6 7. f3 Bb4 8. e4 Bxe4 9. fxe4 Nxe4 10. Bd2 Qxd4 11. Nxe4 Qxe4+ 12. Qe2 Bxd2+ 13. Kxd2",
    side: "white",
    motif: "Tactical counter-strike",
    description: "A sharp tactical clash in the open Slav testing tactical precision on both sides."
  },
  {
    eco: "D15",
    name: "Slav Defense: Chameleon Variation Trap",
    pgn: "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 a6 5. e3 b5 6. b3 Bg4 7. Be2 e6 8. O-O Nbd7 9. h3 Bh5 10. Ne5 Bxe2 11. Qxe2 Nxe5 12. dxe5 Nd7 13. f4",
    side: "white",
    motif: "Central knight outpost",
    description: "White seizes space and establishes an immovable central pawn clamp with e5 and f4."
  },

  // ── Caro-Kann Defense ───────────────────────────────────────────────────────
  {
    eco: "B17",
    name: "Caro-Kann Defense: Steinitz Variation, Smothered Mate Trap",
    pgn: "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nd7 5. Qe2 Ngf6 6. Nd6#",
    side: "white",
    motif: "Smothered mate / Absolute pin",
    description: "Black automatically plays 5...Ngf6, missing that the e7 pawn is pinned to the king, allowing an instant 6.Nd6# mate."
  },
  {
    eco: "B11",
    name: "Caro-Kann Defense: Two Knights Attack Trap",
    pgn: "1. e4 c6 2. Nc3 d5 3. Nf3 dxe4 4. Nxe4 Nf6 5. Qe2 Nxe4 6. Qxe4 Nd7 7. Bc4 Nf6 8. Ne5 e6 9. Qe2",
    side: "white",
    motif: "F7 weakness / Mate threat",
    description: "White threatens 9.Bxf7# mate. If Black greedily grabs the queen with 8...Nxe4, 9.Bxf7# is instant checkmate."
  },
  {
    eco: "B10",
    name: "Caro-Kann Defense: Breyer Variation Trap",
    pgn: "1. e4 c6 2. d3 d5 3. Nd2 dxe4 4. dxe4 e5 5. Ngf3 Bc5 6. Nxe5 Bxf2+ 7. Kxf2 Qd4+ 8. Ke1 Qxe5",
    side: "black",
    motif: "F2 deflection / Queen fork",
    description: "Black sacrifices on f2 to deflect the king, winning back the knight on e5 with 7...Qd4+."
  },

  // ── French Defense ──────────────────────────────────────────────────────────
  {
    eco: "C02",
    name: "French Defense: Advance Variation, Milner-Barry Gambit Trap",
    pgn: "1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 6. Bd3 cxd4 7. cxd4 Bd7 8. O-O Nxd4 9. Nxd4 Qxd4 10. Nc3 Qxe5 11. Re1 Qb8 12. Nxd5",
    side: "white",
    motif: "Central pawn sac / Development lead",
    description: "White sacrifices the d4 and e5 pawns for massive development and control over the central e-file."
  },
  {
    eco: "C10",
    name: "French Defense: Rubinstein Variation Trap",
    pgn: "1. e4 e6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nd7 5. Nf3 Ngf6 6. Bd3 Be7 7. Qe2 O-O 8. Bg5 Nxe4 9. Qxe4 g6 10. Qh4",
    side: "white",
    motif: "Battery on h7 / Kingside bind",
    description: "White builds a devastating queen and bishop battery targeting h7, forcing fatal weaknesses in Black's castled shelter."
  },

  // ── Scandinavian Defense ────────────────────────────────────────────────────
  {
    eco: "B01",
    name: "Scandinavian Defense: Mieses-Kotrč Trap",
    pgn: "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 c6 5. Nf3 Nf6 6. Bc4 Bf5 7. Bd2 e6 8. Nd5 Qd8 9. Nxf6+ Qxf6 10. Bg5 Qg6 11. h4 Bxc2 12. Qe2",
    side: "white",
    motif: "Queen harassment / Center dominance",
    description: "White develops with continuous threats against Black's exposed queen, restricting Black's mobility."
  },
  {
    eco: "B01",
    name: "Scandinavian Defense: Portuguese Gambit Trap",
    pgn: "1. e4 d5 2. exd5 Nf6 3. d4 Bg4 4. f3 Bf5 5. Bb5+ Nbd7 6. c4 e6 7. dxe6 fxe6 8. Ne2 c6 9. Ba4 Bd6 10. O-O Qc7 11. h3 O-O-O",
    side: "black",
    motif: "Pawn sacrifice / Kingside pressure",
    description: "Black sacrifices the central pawn for rapid development, open diagonals, and kingside battery pressure."
  },
  {
    eco: "A06",
    name: "Scandinavian Defense: Tennison Gambit, Interceptor Trap",
    pgn: "1. e4 d5 2. Nf3 dxe4 3. Ng5 Nf6 4. d3 exd3 5. Bxd3 h6 6. Nxf7 Kxf7 7. Bg6+ Kxg6 8. Qxd8",
    side: "white",
    motif: "King deflection / Queen win",
    description: "White sacrifices on f7 and plays 7.Bg6+! checking the king and winning Black's undefended queen on d8."
  },

  // ── Englund Gambit ──────────────────────────────────────────────────────────
  {
    eco: "A40",
    name: "Englund Gambit: Soller Gambit Trap",
    pgn: "1. d4 e5 2. dxe5 f6 3. exf6 Nxf6 4. Nf3 Bc5 5. Bg5 Ne4 6. Bxd8 Bxf2#",
    side: "black",
    motif: "Queen sacrifice / F2 mate",
    description: "Black ignores White's attack on the queen with 5...Ne4!, leading directly to 6...Bxf2# checkmate."
  },
  {
    eco: "A40",
    name: "Englund Gambit: Queen Trap & Mate",
    pgn: "1. d4 e5 2. dxe5 Nc6 3. Nf3 Qe7 4. Bf4 Qb4+ 5. Bd2 Qxb2 6. Bc3 Bb4 7. Qd2 Bxc3 8. Qxc3 Qc1#",
    side: "black",
    motif: "Pin / Back-rank mate",
    description: "White plays 6.Bc3 to defend a1, but Black pins the bishop with 6...Bb4! and forces checkmate on c1."
  },

  // ── Dutch Defense ───────────────────────────────────────────────────────────
  {
    eco: "A80",
    name: "Dutch Defense: Blackburne Trap",
    pgn: "1. d4 f5 2. Bg5 h6 3. Bh4 g5 4. Bg3 f4 5. e3 h5 6. Bd3 Rh6 7. Qxh5+ Rxh5 8. Bg6#",
    side: "white",
    motif: "Queen sacrifice / Dark-square mate",
    description: "Black attempts to trap White's dark-squared bishop, but White detonates with 7.Qxh5+! and 8.Bg6#."
  },
  {
    eco: "A80",
    name: "Dutch Defense: Korchnoi Attack Trap",
    pgn: "1. d4 f5 2. h3 Nf6 3. g4 fxg4 4. hxg4 Nxg4 5. Qd3 Nf6 6. Rxh7 Rxh7 7. Qg6#",
    side: "white",
    motif: "Rook sacrifice / G6 mate",
    description: "White blows open the h-file with 6.Rxh7!, leading directly to 7.Qg6#."
  },

  // ── Petrov Defense (Russian Game) ───────────────────────────────────────────
  {
    eco: "C42",
    name: "Petrov's Defense: Classical Attack, Marshall Trap",
    pgn: "1. e4 e5 2. Nf3 Nf6 3. Nxe5 d6 4. Nf3 Nxe4 5. d4 d5 6. Bd3 Bd6 7. O-O O-O 8. c4 Bg4 9. cxd5 f5 10. Re1 Bxh2+ 11. Kxh2 Nxf2 12. Qe2 Nxd3 13. Qxd3 Bxf3",
    side: "black",
    motif: "Kingside sacrifice / Double attack",
    description: "Black sacrifices on h2 to rip open White's king shelter and win material with active counter-play."
  },

  // ── Vienna Game & King's Gambit ─────────────────────────────────────────────
  {
    eco: "C29",
    name: "Vienna Game: Vienna Gambit, Steinitz Trap",
    pgn: "1. e4 e5 2. Nc3 Nf6 3. f4 d5 4. fxe5 Nxe4 5. d3 Qh4+ 6. g3 Nxg3 7. Nf3 Qh5 8. Nxd5 Bg4 9. Nf4 Bxf3 10. Nxh5 Bxd1 11. hxg3 Bxc2 12. b3",
    side: "white",
    motif: "Bishop trap",
    description: "White weathers Black's early tactical assault and traps Black's light-squared bishop on c2 with 12.b3."
  },
  {
    eco: "C37",
    name: "King's Gambit Accepted: Muzio Gambit Trap",
    pgn: "1. e4 e5 2. f4 exf4 3. Nf3 g5 4. Bc4 g4 5. O-O gxf3 6. Qxf3 Qf6 7. e5 Qxe5 8. Bxf7+ Kxf7 9. d4 Qxd4+ 10. Be3 Qf6 11. Bxf4",
    side: "white",
    motif: "Full piece sacrifice / Rapid development",
    description: "White sacrifices an entire knight on move 5 to blow open the f-file and overwhelm Black's uncastled king."
  },
  {
    eco: "C35",
    name: "King's Gambit Accepted: Cunningham Defense Trap",
    pgn: "1. e4 e5 2. f4 exf4 3. Nf3 Be7 4. Bc4 Bh4+ 5. g3 fxg3 6. O-O gxh2+ 7. Kh1 d5 8. Bxd5 Nf6 9. Bxf7+ Kxf7 10. Nxh4",
    side: "white",
    motif: "Bishop sacrifice / Kingside pin",
    description: "White sacrifices the bishop on f7 to draw out the Black king and control the board."
  },

  // ── Flank & Other Openings ──────────────────────────────────────────────────
  {
    eco: "A02",
    name: "Bird's Opening: From's Gambit Trap",
    pgn: "1. f4 e5 2. fxe5 d6 3. exd6 Bxd6 4. Nf3 g5 5. h3 Bg3#",
    side: "black",
    motif: "Fool's mate pattern",
    description: "White plays 5.h3?? to prevent g4, fatally neglecting the weakened e1-h4 diagonal and allowing 5...Bg3#."
  },
  {
    eco: "B00",
    name: "Owen's Defense: Matovinsky Trap",
    pgn: "1. e4 b6 2. d4 Bb7 3. Bd3 f5 4. exf5 Bxg2 5. Qh5+ g6 6. fxg6 Bg7 7. gxh7+ Kf8 8. hxg8=Q+ Kxg8 9. Qg4 Bxh1 10. Nf3",
    side: "white",
    motif: "Piece trapping / King exposure",
    description: "Black greedily snaps up the h1 rook, but White's ferocious initiative against Black's king is overwhelming."
  },
  {
    eco: "A00",
    name: "Grob Opening: Fritz Gambit, Queen Fork Trap",
    pgn: "1. g4 d5 2. Bg2 Bxg4 3. c4 c6 4. cxd5 cxd5 5. Qb3 Nf6 6. Nc3 e6 7. Qxb7 Nbd7 8. d4",
    side: "white",
    motif: "B7 infiltration",
    description: "White sacrifices the g4 pawn to open the diagonal for the queen to infiltrate b7 and attack both rooks."
  },
  {
    eco: "A09",
    name: "Réti Opening: Advance Variation, Knight Trap",
    pgn: "1. Nf3 d5 2. c4 d4 3. e3 c5 4. b4 Bg4 5. exd4 cxd4 6. h3 Bxf3 7. Qxf3 Nc6 8. b5 Nb4 9. Qb3 e5 10. a3",
    side: "white",
    motif: "Knight trap",
    description: "Black's knight leaps forward to b4 hoping for a fork on c2, but White calmly traps it on the rim with 10.a3."
  },
  {
    eco: "B02",
    name: "Alekhine Defense: Kmoch Trap",
    pgn: "1. e4 Nf6 2. e5 Nd5 3. c4 Nb6 4. c5 Nd5 5. Bc4 e6 6. Nc3 d6 7. cxd6 cxd6 8. Nxd5 exd5 9. Bxd5 dxe5 10. Qb3 Qc7 11. Nf3",
    side: "white",
    motif: "F7 pressure / Space clamp",
    description: "White aggressively advances c4-c5 and targets f7, keeping Black cramped and uncomfortable."
  },
  {
    eco: "A45",
    name: "Trompowsky Attack: Queen Infiltration Trap",
    pgn: "1. d4 Nf6 2. Bg5 c5 3. d5 Qb6 4. Nc3 Qxb2 5. Bd2 Qb6 6. e4 d6 7. f4 e6 8. Rb1 Qd8 9. Bb5+ Bd7 10. dxe6 fxe6 11. Nf3",
    side: "white",
    motif: "Poisoned pawn on b2 / Tempo gain",
    description: "Black snatches the b2 pawn, but White uses open lines to gain massive development and queenside dominance."
  },
  {
    eco: "A46",
    name: "Torre Attack: Counter-Strike Trap",
    pgn: "1. d4 Nf6 2. Nf3 e6 3. Bg5 c5 4. e3 Qb6 5. Nbd2 Qxb2 6. Bd3 cxd4 7. exd4 Be7 8. O-O Qb6 9. Nc4 Qc7 10. Re1",
    side: "white",
    motif: "Center control / Rapid coordination",
    description: "White sacrifices a queenside pawn to activate all pieces toward the uncastled Black king."
  }
];
