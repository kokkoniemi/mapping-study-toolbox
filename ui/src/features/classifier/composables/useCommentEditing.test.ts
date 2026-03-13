import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import type { RecordItem } from "../../../helpers/api";
import { useCommentEditing } from "./useCommentEditing";

const makeRecord = (overrides: Partial<RecordItem> = {}): RecordItem => ({
  id: 1,
  title: "Record",
  author: "Author",
  year: null,
  url: "https://example.com",
  databases: [],
  alternateUrls: [],
  abstract: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  status: null,
  comment: null,
  MappingOptions: [],
  ...overrides,
});

describe("useCommentEditing", () => {
  it("debounces comment persistence", async () => {
    vi.useFakeTimers();
    const setItemComment = vi.fn(async () => {});
    const currentItem = ref<RecordItem | null>(makeRecord({ id: 123 }));

    const { onCommentInput } = useCommentEditing({
      currentItem,
      setItemComment,
      setMoveLock: vi.fn(),
      unsetMoveLock: vi.fn(),
      debounceMs: 500,
    });

    onCommentInput({ target: { value: "hello" } } as unknown as Event);
    expect(setItemComment).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(setItemComment).toHaveBeenCalledWith(123, "hello");
    vi.useRealTimers();
  });

  it("exposes focus and blur handlers", () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();

    const { onCommentFocus, onCommentBlur } = useCommentEditing({
      currentItem: ref<RecordItem | null>(makeRecord()),
      setItemComment: vi.fn(async () => {}),
      setMoveLock: onFocus,
      unsetMoveLock: onBlur,
    });

    onCommentFocus();
    onCommentBlur();

    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
