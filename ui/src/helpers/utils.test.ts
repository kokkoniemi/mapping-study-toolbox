import { afterEach, describe, expect, it, vi } from "vitest";

import { debounce, keyCodes } from "./utils";

describe("keyCodes", () => {
  it("keeps expected keyboard constants", () => {
    expect(keyCodes.ARROW_LEFT).toBe(37);
    expect(keyCodes.ARROW_RIGHT).toBe(39);
  });
});

describe("debounce", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs only once with latest arguments after delay", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("first");
    debounced("second");

    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("second");
  });

  it("preserves call context", () => {
    vi.useFakeTimers();

    const values: string[] = [];
    const debounced = debounce(function (this: { label: string }, value: string) {
      values.push(`${this.label}:${value}`);
    }, 100);

    debounced.call({ label: "ctx" }, "value");
    vi.advanceTimersByTime(100);

    expect(values).toEqual(["ctx:value"]);
  });
});
