import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseArtifact } from "./artifact";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "__fixtures__", name), "utf-8");
}

describe("parseArtifact", () => {
  it("parses a valid baseline artifact", () => {
    const result = parseArtifact(fixture("baseline.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { artifact } = result;
    expect(artifact.project).toBe("OfflineCodeTutor");
    expect(artifact.variant).toBe("baseline");
    expect(artifact.variantKnown).toBe(true);
    expect(artifact.benchmarkStatus).toBe("completed");
    expect(artifact.modelSha256).toMatch(/^0{64}$/);
    expect(artifact.runs).toHaveLength(2);
    expect(artifact.runs[0].promptId).toBe("python-factorial-debug");
    expect(artifact.runs[0].elapsedSeconds).toBe(5.26);
    expect(artifact.runs[0].tokensPerSecond).toBe(21.55);
  });

  it("parses a valid prompt_v3 artifact", () => {
    const result = parseArtifact(fixture("prompt_v3.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.variant).toBe("prompt_v3");
    expect(result.artifact.variantKnown).toBe(true);
    expect(result.artifact.runs).toHaveLength(2);
  });

  it("rejects malformed JSON with a readable error", () => {
    const result = parseArtifact("{not valid json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not valid JSON/i);
  });

  it("rejects JSON that is not an OfflineCodeTutor artifact", () => {
    const result = parseArtifact(JSON.stringify({ hello: "world" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/does not look like/i);
    expect(result.error).toMatch(/project/);
    expect(result.error).toMatch(/runs/);
  });

  it("rejects an artifact with an empty runs array", () => {
    const base = JSON.parse(fixture("baseline.json"));
    base.runs = [];
    const result = parseArtifact(JSON.stringify(base));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/runs/);
  });

  it("rejects a run missing required fields", () => {
    const base = JSON.parse(fixture("baseline.json"));
    base.runs = [{ prompt_id: "x" }]; // missing prompt + ok
    const result = parseArtifact(JSON.stringify(base));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Run 1/);
  });

  it("treats missing optional metrics as null, never zero", () => {
    const result = parseArtifact(fixture("baseline.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const secondRun = result.artifact.runs[1]; // has no metric fields
    expect(secondRun.elapsedSeconds).toBeNull();
    expect(secondRun.tokensPerSecond).toBeNull();
    expect(secondRun.cleanOutputPreview).toBeNull();
    // Critically NOT zero / empty string.
    expect(secondRun.elapsedSeconds).not.toBe(0);
    expect(secondRun.tokensPerSecond).not.toBe(0);
  });

  it("does not fabricate metrics or coerce explicit nulls to numbers", () => {
    const base = JSON.parse(fixture("baseline.json"));
    base.runs[0].tokens_per_second = null;
    base.runs[0].elapsed_seconds = null;
    const result = parseArtifact(JSON.stringify(base));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.runs[0].tokensPerSecond).toBeNull();
    expect(result.artifact.runs[0].elapsedSeconds).toBeNull();
  });

  it("flags an unknown variant but still parses", () => {
    const base = JSON.parse(fixture("baseline.json"));
    base.settings.prompt_variant = "experimental_v9";
    const result = parseArtifact(JSON.stringify(base));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.variant).toBe("experimental_v9");
    expect(result.artifact.variantKnown).toBe(false);
  });

  it("accepts an already-parsed object (not only strings)", () => {
    const obj = JSON.parse(fixture("prompt_v3.json"));
    const result = parseArtifact(obj);
    expect(result.ok).toBe(true);
  });

  it("tolerates additive run/settings metadata from the expanded task pack", () => {
    // Ticket 7 adds optional fields (task_title, category, repeat_index, etc.)
    // and new settings keys. The importer must ignore unknowns and still parse,
    // preserving required fields and treating missing metrics as null.
    const base = JSON.parse(fixture("baseline.json"));
    base.settings.max_tokens_source = "variant_default";
    base.settings.repeats = 3;
    base.runs[0].task_title = "Python factorial";
    base.runs[0].language = "python";
    base.runs[0].category = "debugging";
    base.runs[0].difficulty = "beginner";
    base.runs[0].expected_concepts = ["base case"];
    base.runs[0].repeat_index = 1;
    base.runs[0].repeat_count = 3;
    const result = parseArtifact(JSON.stringify(base));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.runs[0].promptId).toBe("python-factorial-debug");
    // The run with no metrics still maps to null, never 0.
    expect(result.artifact.runs[1].tokensPerSecond).toBeNull();
  });
});
