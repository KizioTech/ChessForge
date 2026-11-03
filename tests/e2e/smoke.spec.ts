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
    await expect(authModal.getByRole("heading", { level: 2 })).toHaveText("Sign in to ChessForge");

    // Toggle to Create account
    await page.getByRole("button", { name: "Create one" }).click();
    await expect(authModal.getByRole("heading", { level: 2 })).toHaveText("Create your account");

    // Toggle back to Sign in
    await page.getByRole("button", { name: "Sign in" }).last().click();
    await expect(authModal.getByRole("heading", { level: 2 })).toHaveText("Sign in to ChessForge");

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
});
