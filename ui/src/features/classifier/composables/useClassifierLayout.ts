import { nextTick, onMounted, onUnmounted, watch, type Ref } from "vue";

import { keyCodes } from "../../../helpers/utils";

type ClassifierLayoutOptions = {
  classifierRef: Ref<HTMLElement | null>;
  classifierMainRef: Ref<HTMLElement | null>;
  moveLock: Ref<boolean>;
  currentItemId: Ref<number | null | undefined>;
  resetVisibility: () => void;
  onMovePrev: () => Promise<void> | void;
  onMoveNext: () => void;
};

const isInteractiveTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }

  return (
    element.tagName === "INPUT"
    || element.tagName === "TEXTAREA"
    || element.tagName === "SELECT"
    || element.tagName === "BUTTON"
    || element.isContentEditable
  );
};

export const useClassifierLayout = ({
  classifierRef,
  classifierMainRef,
  moveLock,
  currentItemId,
  resetVisibility,
  onMovePrev,
  onMoveNext,
}: ClassifierLayoutOptions) => {
  let sidebarHeightObserver: ResizeObserver | null = null;

  const updateSidebarHeightVariable = () => {
    const classifierElement = classifierRef.value;
    const sidebarElement = document.getElementById("sidebar");
    if (!classifierElement || !sidebarElement) {
      return;
    }

    const sidebarHeight = Math.ceil(sidebarElement.getBoundingClientRect().height);
    classifierElement.style.setProperty("--sidebar-height", `${sidebarHeight}px`);
  };

  const onWindowKeyDown = (event: KeyboardEvent) => {
    if (isInteractiveTarget(event.target) || moveLock.value) {
      return;
    }

    if (event.keyCode === keyCodes.ARROW_LEFT) {
      void onMovePrev();
      return;
    }

    if (event.keyCode === keyCodes.ARROW_RIGHT) {
      onMoveNext();
    }
  };

  watch(
    currentItemId,
    async () => {
      resetVisibility();
      await nextTick();
      classifierMainRef.value?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    },
  );

  onMounted(() => {
    window.addEventListener("keydown", onWindowKeyDown);
    window.addEventListener("resize", updateSidebarHeightVariable);

    const sidebarElement = document.getElementById("sidebar");
    if (sidebarElement) {
      sidebarHeightObserver = new ResizeObserver(() => {
        updateSidebarHeightVariable();
      });
      sidebarHeightObserver.observe(sidebarElement);
    }

    void nextTick(updateSidebarHeightVariable);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", onWindowKeyDown);
    window.removeEventListener("resize", updateSidebarHeightVariable);
    sidebarHeightObserver?.disconnect();
    sidebarHeightObserver = null;
  });
};
