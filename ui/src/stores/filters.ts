import { defineStore } from "pinia";

import type { StatusFilter } from "@shared/contracts";
import type { FiltersState, PageLength } from "./types";

const pageLengthOptions: PageLength[] = [20, 25, 30];

export const useFiltersStore = defineStore("filters", {
  persist: {
    pick: ["pageLength", "statusFilter", "searchFilter"],
  },
  state: (): FiltersState => ({
    page: 1,
    pageLength: 25,
    statusFilter: "",
    searchFilter: "",
    dataImportFilterId: null,
  }),
  actions: {
    setPage(payload: number) {
      this.page = payload;
    },
    setPageLength(payload: number) {
      if (!pageLengthOptions.includes(payload as PageLength)) {
        return;
      }
      this.pageLength = payload as PageLength;
    },
    setStatusFilter(payload: StatusFilter) {
      this.statusFilter = payload;
      this.page = 1;
    },
    setSearchFilter(payload: string) {
      this.searchFilter = payload;
      this.page = 1;
    },
    setDataImportFilter(payload: number | null) {
      this.dataImportFilterId = payload;
    },
  },
});

