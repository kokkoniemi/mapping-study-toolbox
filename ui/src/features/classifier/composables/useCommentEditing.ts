import type { Ref } from "vue";

import type { RecordItem } from "../../../helpers/api";
import { debounce } from "../../../helpers/utils";

type CommentEditingOptions = {
  currentItem: Ref<RecordItem | null>;
  setItemComment: (id: number, value: string) => Promise<void>;
  setMoveLock: () => void;
  unsetMoveLock: () => void;
  debounceMs?: number;
};

export const useCommentEditing = ({
  currentItem,
  setItemComment,
  setMoveLock,
  unsetMoveLock,
  debounceMs = 1000,
}: CommentEditingOptions) => {
  const debouncedSetComment = debounce(async (id: number, value: string) => {
    await setItemComment(id, value);
  }, debounceMs);

  const onCommentInput = (event: Event) => {
    const id = currentItem.value?.id;
    if (id === undefined) {
      return;
    }

    const value = (event.target as HTMLTextAreaElement).value;
    debouncedSetComment(id, value);
  };

  return {
    onCommentInput,
    onCommentFocus: setMoveLock,
    onCommentBlur: unsetMoveLock,
  };
};
