import { test, expect } from "@playwright/test";

test.describe("ChessForge Phase 1 Smoke Test", () => {
  test("loads application shell and navigates workspace", async ({ page }) => {
    await page.goto("/");

    // 1. App shell verification
    await expect(page.locator(".titlebar-brand")).toContainText("CHESSFORGE");
    await expect(page.locator("h1")).toContainText("Good afternoon");

    // 2. Auth modal interaction
    const signInBtn = page.getByRole("button", { name: "Sign in" }).first();
    await expect(signInBtn).toBeVisible();
    await signInBtn.click();

    const authModal = page.locator(".auth-modal");
    await expect(authModal).toBeVisible();

    const createOneBtn = page.getByRole("button", { name: "Create one" });
    if (await createOneBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(authModal.getByRole("heading", { level: 2 })).toHaveText("Sign in to ChessForge");
      // Toggle to Create account
      await createOneBtn.click();
      await expect(authModal.getByRole("heading", { level: 2 })).toHaveText("Create your account");

      // Toggle back to Sign in
      await page.getByRole("button", { name: "Sign in" }).last().click();
      await expect(authModal.getByRole("heading", { level: 2 })).toHaveText("Sign in to ChessForge");
    } else {
      // Unconfigured fallback in bare environments
      await expect(page.getByText("Supabase Unconfigured")).toBeVisible();
    }

    // Close modal
    await page.locator('.auth-modal button[aria-label="Close"]').click();
    await expect(authModal).not.toBeVisible();

    // 3. Navigate to Analysis Workspace
    const analysisNav = page.locator("button.nav-item", { hasText: "Analysis" });
    await analysisNav.click();
    await expect(page.locator("h1")).toHaveText("Analysis workspace");

    // 4. Board verification
    const board = page.locator(".board-container");
    await expect(board).toBeVisible();
    await expect(page.locator("cg-board")).toBeVisible();

    // Verify move controls
    const startingPosText = page.locator(".move-position");
    await expect(startingPosText).toHaveText("Starting position");

    // Undo button initially disabled
    const undoBtn = page.locator('button[title*="Undo"]');
    await expect(undoBtn).toBeDisabled();

    // 5. Flip board interaction
    const flipBtn = page.locator('button[title="Flip board"]');
    await expect(flipBtn).toBeVisible();
    await flipBtn.click();
    await expect(page.locator(".cg-wrap")).toHaveClass(/orientation-black/);
    await flipBtn.click();
    await expect(page.locator(".cg-wrap")).toHaveClass(/orientation-white/);
  });

  test("imports games, detects duplicates, and loads into analysis workspace", async ({ page }) => {
    await page.goto("/");

    // 1. Open Import Dialog
    const importBtn = page.getByRole("button", { name: "Import games" }).first();
    await expect(importBtn).toBeVisible();
    await importBtn.click();

    const importModal = page.locator(".import-modal");
    await expect(importModal).toBeVisible();
    await expect(importModal.getByRole("heading", { level: 2 })).toHaveText("Bring your games into ChessForge");

    // 2. Switch to Paste PGN tab
    await page.getByRole("button", { name: "Paste PGN text" }).click();

    const testPgn = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.11.03"]
[White "makawa7"]
[Black "GrandmasterX"]
[Result "1-0"]
[WhiteElo "1205"]
[BlackElo "1190"]
[TimeControl "600+0"]
[Termination "makawa7 won by checkmate"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0`;

    await page.locator("textarea.pgn-textarea").fill(testPgn);

    // 3. Click Import games
    await page.getByRole("button", { name: "Import games" }).last().click();

    // 4. Verify Import Complete report
    await expect(page.getByText("Import Complete")).toBeVisible();
    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();

    // 5. Navigate to My Games via report button
    await page.getByRole("button", { name: "View in My Games" }).click();
    await expect(page.locator("h1")).toHaveText("My Games");

    // Verify game card is rendered
    await expect(page.getByText("GrandmasterX")).toBeVisible();
    await expect(page.locator(".panel").getByText("1-0", { exact: true })).toBeVisible();
    await expect(page.locator("span", { hasText: "Rapid" }).first()).toBeVisible();

    // 6. Click Analyse to open in Analysis Workspace
    const analyseBtn = page.getByRole("button", { name: "Analyse" }).first();
    await analyseBtn.click();
    await expect(page.locator("h1")).toHaveText("Analysis workspace");

    // Verify board and notation are populated
    await expect(page.locator(".move-count")).toContainText("7 plies");
    await expect(page.getByText("Qxf7#")).toBeVisible();

    // 7. Verify Checkmate visual presentation is active for this game
    await expect(page.locator(".status-checkmate")).toBeVisible();
    await expect(page.locator(".checkmate-banner")).toBeVisible();

    // 8. Re-import the exact same game and verify duplicate detection
    const importAgainBtn = page.getByRole("button", { name: "Import games" }).first();
    await importAgainBtn.click();
    await page.getByRole("button", { name: "Paste PGN text" }).click();
    await page.locator("textarea.pgn-textarea").fill(testPgn);
    await page.getByRole("button", { name: "Import games" }).last().click();

    // Report should show 0 imported, 1 duplicate skipped
    await expect(page.getByText("Import Complete")).toBeVisible();
    await expect(page.getByText("0 games added to your library")).toBeVisible();
    await expect(page.getByText("Duplicates Skipped")).toBeVisible();
  });
});

