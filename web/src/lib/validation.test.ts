import { describe, expect, it } from "vitest";
import {
  slugify,
  validateProjectInput,
  validateTaskInput,
} from "./validation";

describe("slugify", () => {
  it("produces a stable slug from a title", () => {
    expect(slugify("Python Factorial Base Case")).toBe(
      "python-factorial-base-case",
    );
  });

  it("collapses punctuation and trims dashes", () => {
    expect(slugify("  C++ vector: out-of-bounds!  ")).toBe(
      "c-vector-out-of-bounds",
    );
  });

  it("falls back to 'task' when nothing usable remains", () => {
    expect(slugify("!!!")).toBe("task");
    expect(slugify("")).toBe("task");
  });
});

describe("validateProjectInput", () => {
  it("rejects an empty name", () => {
    const result = validateProjectInput({ name: "   ", description: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.name).toBeTruthy();
  });

  it("rejects an over-long name", () => {
    const result = validateProjectInput({ name: "a".repeat(121) });
    expect(result.ok).toBe(false);
  });

  it("trims and nulls empty description", () => {
    const result = validateProjectInput({ name: "  My Project  ", description: "   " });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe("My Project");
      expect(result.data.description).toBeNull();
    }
  });
});

describe("validateTaskInput", () => {
  it("rejects an empty prompt", () => {
    const result = validateTaskInput({ title: "A task", prompt: "  " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.prompt).toBeTruthy();
  });

  it("rejects an empty title", () => {
    const result = validateTaskInput({ title: "", prompt: "find the bug" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.title).toBeTruthy();
  });

  it("rejects an invalid difficulty", () => {
    const result = validateTaskInput({
      title: "A task",
      prompt: "find the bug",
      difficulty: "extreme",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.difficulty).toBeTruthy();
  });

  it("accepts a valid task and nulls optional empties", () => {
    const result = validateTaskInput({
      title: " Factorial bug ",
      prompt: " return 0 should be return 1 ",
      language: "python",
      difficulty: "easy",
      category: "",
      expectedFixHint: "",
      notes: "",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("Factorial bug");
      expect(result.data.language).toBe("python");
      expect(result.data.difficulty).toBe("easy");
      expect(result.data.category).toBeNull();
      expect(result.data.expectedFixHint).toBeNull();
      expect(result.data.notes).toBeNull();
    }
  });
});
