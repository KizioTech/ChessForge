/**
 * stockfish-engine.ts — Real Stockfish 19 Lite Web Worker engine runner.
 *
 * Implements ADR 0004:
 * 1. Dedicated Web Worker execution isolating engine calculations from UI thread.
 * 2. Strict Engine interface (init, evaluatePosition, stop, dispose).
 * 3. Immediate White-relative score normalization.
 * 4. Cancellation via AbortSignal without state corruption.
 *
 * Guarantees:
 * - Never returns fake or heuristic evaluations in production.
 * - Throws if the Worker cannot be initialized or fails.
 * - Rejects if an evaluation times out.
 */
import { Chess } from "chess.js";
import type {
  Engine,
  EngineConfig,
  PositionEvaluation
} from "./types";
import { parseUciInfoLine, buildPositionEvaluation } from "./uci-parser";

export class StockfishEngine implements Engine {
  private worker: Worker | null = null;
  private isInitialized = false;
  private currentResolver: ((val: PositionEvaluation) => void) | null = null;
  private currentRejecter: ((err: Error) => void) | null = null;
  private candidateLines = new Map<number, any>();
  private bestMoveUci = "";
  private currentFen = "";
  private currentPly = 0;
  private currentMoveSan = "";
  private currentMoveUci = "";
  private config: Required<EngineConfig>;

  constructor(config?: EngineConfig) {
    this.config = {
      depth: config?.depth ?? 16,
      multiPv: config?.multiPv ?? 3,
      threads: config?.threads ?? 1,
      hashMb: config?.hashMb ?? 32
    };
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    if (typeof Worker === "undefined") {
      throw new Error(
        "Web Workers are not available in this environment. StockfishEngine requires Worker support."
      );
    }

    try {
      this.worker = this.createWorker();
      this.setupWorkerListeners();

      this.sendCommand("uci");
      this.sendCommand(`setoption name MultiPV value ${this.config.multiPv}`);
      this.sendCommand(`setoption name Hash value ${this.config.hashMb}`);
      this.sendCommand(`setoption name Threads value ${this.config.threads}`);
      await this.isReady();

      this.isInitialized = true;
    } catch (err) {
      this.worker = null;
      this.isInitialized = false;
      throw new Error(
        `Failed to initialize Stockfish worker: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async isReady(): Promise<boolean> {
    if (!this.worker) return false;
    const worker = this.worker;
    return new Promise((resolve, reject) => {
      const listener = (e: MessageEvent) => {
        if (
          typeof e.data === "string" &&
          (e.data.trim() === "readyok" || e.data.trim() === "uciok")
        ) {
          worker.removeEventListener("message", listener);
          resolve(true);
        }
      };
      worker.addEventListener("message", listener);
      this.sendCommand("isready");

      setTimeout(() => {
        worker.removeEventListener("message", listener);
        // If engine doesn't reply within 3 seconds, reject
        reject(new Error("Stockfish engine isready handshake timed out."));
      }, 3000);
    });
  }

  async evaluatePosition(
    fen: string,
    options?: {
      depth?: number;
      multiPv?: number;
      signal?: AbortSignal;
      ply?: number;
      moveSan?: string;
      moveUci?: string;
    }
  ): Promise<PositionEvaluation> {
    await this.init();

    if (options?.signal?.aborted) {
      throw new DOMException("Evaluation aborted", "AbortError");
    }

    if (!this.worker) {
      throw new Error("Stockfish worker is not initialized or has crashed.");
    }

    const depth = options?.depth ?? this.config.depth;
    const multiPv = options?.multiPv ?? this.config.multiPv;
    const ply = options?.ply ?? 0;

    return new Promise<PositionEvaluation>((resolve, reject) => {
      let settled = false;

      // 10-second timeout: throws rather than silently faking an evaluation
      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.sendCommand("stop");
          this.currentResolver = null;
          this.currentRejecter = null;
          reject(new Error(`Stockfish evaluation timed out at ply ${ply} (depth ${depth})`));
        }
      }, 10000);

      this.currentResolver = (val: PositionEvaluation) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          resolve(val);
        }
      };

      this.currentRejecter = (err: Error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          reject(err);
        }
      };

      this.candidateLines.clear();
      this.bestMoveUci = "";
      this.currentFen = fen;
      this.currentPly = ply;
      this.currentMoveSan = options?.moveSan || "";
      this.currentMoveUci = options?.moveUci || "";

      // Abort signal listener
      if (options?.signal) {
        const onAbort = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            this.sendCommand("stop");
            reject(new DOMException("Evaluation aborted", "AbortError"));
          }
        };
        options.signal.addEventListener("abort", onAbort, { once: true });
      }

      this.sendCommand(`position fen ${fen}`);
      this.sendCommand(`go depth ${depth}`);
    });
  }

  async stop(): Promise<void> {
    if (this.worker) {
      this.sendCommand("stop");
    }
    if (this.currentRejecter) {
      this.currentRejecter(new DOMException("Evaluation stopped", "AbortError"));
      this.currentResolver = null;
      this.currentRejecter = null;
    }
  }

  async dispose(): Promise<void> {
    await this.stop();
    if (this.worker) {
      this.sendCommand("quit");
      this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
  }

  private sendCommand(command: string) {
    if (this.worker) {
      this.worker.postMessage(command);
    }
  }

  private setupWorkerListeners() {
    if (!this.worker) return;

    this.worker.onmessage = (event: MessageEvent) => {
      const line = typeof event.data === "string" ? event.data.trim() : "";
      if (!line) return;

      const sideToMove: "w" | "b" = this.currentFen.split(" ")[1] === "b" ? "b" : "w";

      // Parse UCI info line
      if (line.startsWith("info ") && line.includes(" score ")) {
        const parsed = parseUciInfoLine(line, sideToMove);
        if (parsed) {
          this.candidateLines.set(parsed.multiPv, parsed);
        }
      }

      // Bestmove line signals evaluation completion
      if (line.startsWith("bestmove ")) {
        const parts = line.split(" ");
        const bestMove = parts[1] || "";
        this.bestMoveUci = bestMove;

        if (this.currentResolver) {
          const result = buildPositionEvaluation(
            this.currentPly,
            this.currentFen,
            this.candidateLines,
            this.bestMoveUci,
            this.currentMoveSan,
            this.currentMoveUci
          );
          const resolver = this.currentResolver;
          this.currentResolver = null;
          this.currentRejecter = null;
          resolver(result);
        }
      }
    };

    this.worker.onerror = (err) => {
      console.error("Stockfish worker error:", err);
      if (this.currentRejecter) {
        this.currentRejecter(new Error("Stockfish Web Worker runtime error"));
        this.currentResolver = null;
        this.currentRejecter = null;
      }
    };
  }

  private createWorker(): Worker {
    let workerUrl: string;
    if (typeof window !== "undefined") {
      workerUrl = new URL("stockfish.js", window.location.href).href;
    } else {
      workerUrl = "/stockfish.js";
    }
    return new Worker(workerUrl);
  }
}
