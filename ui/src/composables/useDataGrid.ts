import { nextTick, ref, type Ref } from "vue";
import type Handsontable from "handsontable/base";

import { defaultStore } from "../stores/default";

export type HotInstance = Pick<Handsontable, "render" | "loadData" | "updateSettings" | "rootElement" | "getCell">;

export type DataGridExpose = {
  getHotInstance: () => HotInstance | null;
  getShellElement: () => HTMLElement | null;
};

type UseDataGridParams = {
  store: ReturnType<typeof defaultStore>;
  dataGridRef: Ref<DataGridExpose | null>;
  dataLoading: Ref<boolean>;
  dataHasMore: Ref<boolean>;
  tableRows: Readonly<Ref<Array<Record<string, unknown>>>>;
};

export const useDataGrid = ({
  store,
  dataGridRef,
  dataLoading,
  dataHasMore,
  tableRows,
}: UseDataGridParams) => {
  const gridHeight = ref(520);
  let gridResizeObserver: ResizeObserver | null = null;

  const updateGridHeight = () => {
    const shell = dataGridRef.value?.getShellElement();
    if (!shell) {
      return;
    }
    gridHeight.value = Math.max(260, Math.floor(shell.clientHeight));
  };

  const getTableScrollHolder = () => {
    const rootElement = dataGridRef.value?.getHotInstance()?.rootElement;
    if (!rootElement) {
      return null;
    }
    return rootElement.querySelector(".ht_master .wtHolder") as HTMLElement | null;
  };

  const maybeLoadMoreFromScrollPosition = async () => {
    if (dataLoading.value || !dataHasMore.value) {
      return;
    }

    const holder = getTableScrollHolder();
    if (!holder) {
      return;
    }

    const remaining = holder.scrollHeight - holder.scrollTop - holder.clientHeight;
    if (remaining <= 140) {
      await store.loadMoreData();
    }
  };

  const ensureViewportFilled = async () => {
    let holder = getTableScrollHolder();
    if (!holder) {
      return;
    }

    while (dataHasMore.value && !dataLoading.value && holder.scrollHeight <= holder.clientHeight + 20) {
      await store.loadMoreData();
      await nextTick();
      dataGridRef.value?.getHotInstance()?.render();
      holder = getTableScrollHolder();
      if (!holder) {
        break;
      }
    }
  };

  const onAfterScrollVertically = () => {
    void maybeLoadMoreFromScrollPosition();
  };

  const syncGridData = () => {
    const instance = dataGridRef.value?.getHotInstance();
    if (!instance) {
      return;
    }
    instance.loadData?.(tableRows.value);
    instance.render();
  };

  const mountGridSizing = () => {
    const shell = dataGridRef.value?.getShellElement();
    if (!shell) {
      return;
    }

    gridResizeObserver = new ResizeObserver(() => {
      updateGridHeight();
    });
    gridResizeObserver.observe(shell);
    updateGridHeight();
  };

  const unmountGridSizing = () => {
    gridResizeObserver?.disconnect();
    gridResizeObserver = null;
  };

  return {
    gridHeight,
    updateGridHeight,
    onAfterScrollVertically,
    ensureViewportFilled,
    syncGridData,
    mountGridSizing,
    unmountGridSizing,
  };
};
