import { defineStore } from "pinia";

import type { EnrichmentMode } from "@shared/contracts";
import type { TabMode, UiState } from "./types";

export const useUiStore = defineStore("ui", {
  persist: {
    pick: ["tab", "dataCellsTruncated", "enrichmentMode", "nick"],
  },
  state: (): UiState => ({
    tab: "inc-exc",
    nick: null,
    dataCellsTruncated: true,
    moveLock: false,
    enrichmentMode: "missing",
  }),
  actions: {
    updateNick(payload: string | null) {
      this.nick = payload;
    },
    updateTab(payload: TabMode) {
      this.tab = payload;
    },
    setDataCellsTruncated(payload: boolean) {
      this.dataCellsTruncated = payload;
    },
    setMoveLock() {
      this.moveLock = true;
    },
    unsetMoveLock() {
      this.moveLock = false;
    },
    setEnrichmentMode(payload: EnrichmentMode) {
      this.enrichmentMode = payload;
    },
  },
});

