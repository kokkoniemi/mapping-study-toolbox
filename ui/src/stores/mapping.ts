import { defineStore } from "pinia";

import { mappingQuestions, type MappingQuestion } from "../helpers/api";
import type { MappingQuestionUpdate } from "./types";

export const useMappingStore = defineStore("mapping", {
  state: () => ({
    mappingQuestions: [] as MappingQuestion[],
  }),
  actions: {
    async fetchMappingQuestions() {
      const items = await mappingQuestions.index();
      this.mappingQuestions = items.data.questions;
    },
    async createMappingQuestion() {
      const question = await mappingQuestions.save({
        title: "",
        type: "multiSelect",
        position: this.mappingQuestions.length,
        description: "",
        decisionGuidance: "",
        positiveExamples: [],
        negativeExamples: [],
        evidenceInstructions: "",
        allowNewOption: true,
      });
      this.mappingQuestions = [...this.mappingQuestions, { ...question.data, MappingOptions: [] }];
    },
    async deleteMappingQuestion(id: number) {
      await mappingQuestions.delete(id);
      this.mappingQuestions = this.mappingQuestions.filter((question) => question.id !== id);
    },
    async updateMappingQuestion(data: MappingQuestionUpdate) {
      const { id, ...rest } = data;
      const question = await mappingQuestions.update(id, rest);
      const index = this.mappingQuestions.findIndex((item) => item.id === id);
      if (index < 0) {
        return;
      }

      const newQuestions = [...this.mappingQuestions];
      newQuestions[index] = question.data;
      this.mappingQuestions = newQuestions;
    },
  },
});
