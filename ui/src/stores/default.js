import { defineStore } from 'pinia';
import { records, mappingQuestions } from '../helpers/api';

export const defaultStore = defineStore('default', {
    persist: true,
    state: () => ({
        tab: 'inc-exc',
        page: 1,
        pageLength: 25,
        pageItems: [],
        itemCount: 0,
        currentItemId: null,
        statusFilter: "",
        searchFilter: "",
        nick: null,
        loading: false,
        mappingQuestions: [],
        moveLock: false,
    }),
    getters: {
        currentItem: ({ currentItemId, pageItems }) => !currentItemId ? null : pageItems.find(item => item.id == currentItemId),
    },
    actions: {
        async setPage(payload) {
            if (payload > Math.ceil(this.itemCount / this.pageLength)) {
                return;
            }
            this.page = payload;
            await this.fetchPageItems();
            this.setCurrentItem(this.pageItems[0]);
          },
          setCurrentItem(payload) {
            this.currentItemId = !payload ? null : payload.id;
          },
          async setStatusFilter(payload) {
            this.statusFilter = payload;
            this.page = 1;
            await this.fetchPageItems();
          },
          async setSearchFilter(payload) {
            this.searchFilter = payload;
            this.page = 1;
            await this.fetchPageItems({ search: payload });
          },
          async fetchPageItems(where) {
            const {
              page, pageLength, statusFilter, searchFilter, currentItem
            } = this;
      
            const items = await records.index({
              offset: (page - 1) * pageLength,
              limit: pageLength,
              ...where,
              ...(statusFilter !== "" && { status: statusFilter }),
              ...(searchFilter !== "" && { search: searchFilter }),
            });
      
            this.pageItems = items.data.records;
            this.itemCount = items.data.count;
            
            if (currentItem === null
              || !items.data.records.find(item => item.id === currentItem.id)) {
              this.setCurrentItem(items.data.records[0]);
            }
          },
          async setItemStatus(payload) {
            const { pageItems, statusFilter, nick, currentItem } = this;

            if (currentItem) {
              const item = await records.update(currentItem.id, { status: payload, editedBy: nick });
              const index = pageItems.findIndex((item) => item.id === currentItem.id);
              let newItems = [...pageItems];
              let nextItem = null;
              if (statusFilter !== "" && statusFilter !== item.data.status) {
                await this.fetchPageItems({ status: statusFilter });
                nextItem = pageItems.length <= index + 1 ? this.pageItems[pageItems.length - 1] : pageItems[index + 1];
              } else {
                nextItem = item.data;
                newItems[index] = item.data;
                this.pageItems = newItems;
              }
              this.setCurrentItem(nextItem);
            }
          },
          // id can differ from currentItemId because of debounce and must be given as parameter
          async setItemComment(id, payload) {
            const { nick, pageItems} = this;
            const index = pageItems.findIndex((item) => item.id === id);
            let newItems = [...pageItems];
            newItems[index].comment = payload;
            this.pageItems = newItems;
            await records.update(id, { comment: payload || null, editedBy: nick });
          },
          updateNick(payload) {
            this.nick = payload;
          },
          updateTab(payload) {
            this.tab = payload;
          },
          async fetchMappingQuestions() {
            const items = await mappingQuestions.index();
            this.mappingQuestions = items.data.questions;
          },
          async createMappingQuestion() {
            const question = await mappingQuestions.save({ title: '', type: 'multiSelect', position: this.mappingQuestions.length });
            this.mappingQuestions = [...this.mappingQuestions, question.data];
          },
          async deleteMappingQuestion(id) {
            await mappingQuestions.delete(id);
            this.mappingQuestions = [...this.mappingQuestions.filter(q => q.id != id)];
          },
          async updateMappingQuestion(data) {
            const { id, ...rest } = data;
            const question = await mappingQuestions.update(id, rest);
            let newQuestions = [...this.mappingQuestions];
            const index = await newQuestions.findIndex((item) => item.id === id);
            newQuestions[index] = await question.data;
            this.mappingQuestions = [...newQuestions];
          },
          async createMappingOption(data) {
            const { pageItems, currentItemId, currentItem } = this;
            const { id, ...rest } = data;
            const option = await mappingQuestions.mappingOptions.save(id, rest);
            const recordOption = await records.mappingOptions.save(currentItemId, { mappingQuestionId: id, mappingOptionId: option.data.id });
            await this.fetchMappingQuestions();
            const index = pageItems.findIndex((item) => item.id === currentItem.id);
            let newItems = [...pageItems];
            currentItem.MappingOptions = [...currentItem.MappingOptions, recordOption.data];
            newItems[index] = currentItem;
            this.pageItems = newItems;
          },
          async addRecordMappingOption(data) {
            const { pageItems, currentItemId, currentItem } = this;
            const { mappingQuestionId, mappingOptionId } = data;
            const option = await records.mappingOptions.save(currentItemId, { mappingQuestionId, mappingOptionId });
      
            const index = pageItems.findIndex((item) => item.id === currentItem.id);
            let newItems = [...pageItems];
            currentItem.MappingOptions = [...currentItem.MappingOptions, option.data];
            newItems[index] = currentItem;
            this.pageItems = newItems;
          },
          async removeRecordMappingOption(optionId) {
            const { pageItems, currentItemId, currentItem } = this;
            await records.mappingOptions.delete(currentItemId, optionId);
            const index = pageItems.findIndex((item) => item.id === currentItem.id);
            let newItems = [...pageItems];
            currentItem.MappingOptions = currentItem.MappingOptions.filter(o => o.id !== optionId);
            newItems[index] = currentItem;
            this.pageItems = newItems;
          },
          setMoveLock() {
            this.moveLock = true;
          },
          unsetMoveLock() {
            this.moveLock = false;
          }
    } 
});