import { describe, it, expect } from "vitest";
import { isSupabaseConfigured, supabase } from "../../src/lib/supabase";

describe("Supabase Client Initialization", () => {
  it("initializes client instance without throwing", () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.from).toBe("function");
  });

  it("exports configuration flag based on env presence", () => {
    expect(typeof isSupabaseConfigured).toBe("boolean");
  });
});

