import type { Sequelize } from "sequelize";

import type { DbModels, KeywordingSuggestionModelStatic, ModelFactory } from "./types";

const defineKeywordingSuggestion: ModelFactory<KeywordingSuggestionModelStatic> = (
  sequelize: Sequelize,
  DataTypes,
) => {
  const KeywordingSuggestion = sequelize.define(
    "KeywordingSuggestion",
    {
      keywordingJobId: DataTypes.INTEGER,
      recordId: DataTypes.INTEGER,
      mappingQuestionId: DataTypes.INTEGER,
      actionType: DataTypes.STRING,
      decisionType: DataTypes.STRING,
      existingOptionId: DataTypes.INTEGER,
      proposedOptionLabel: DataTypes.STRING,
      confidence: DataTypes.INTEGER,
      rationale: DataTypes.TEXT,
      reviewerNote: DataTypes.TEXT,
    },
    {
      paranoid: false,
    },
  ) as KeywordingSuggestionModelStatic;

  KeywordingSuggestion.associate = (models: DbModels) => {
    KeywordingSuggestion.belongsTo(models.KeywordingJob, { foreignKey: "keywordingJobId" });
    KeywordingSuggestion.belongsTo(models.Record, { foreignKey: "recordId" });
    KeywordingSuggestion.belongsTo(models.MappingQuestion, { foreignKey: "mappingQuestionId" });
    KeywordingSuggestion.belongsTo(models.MappingOption, { foreignKey: "existingOptionId" });
    KeywordingSuggestion.hasMany(models.KeywordingEvidenceSpan, { foreignKey: "keywordingSuggestionId" });
  };

  return KeywordingSuggestion;
};

export default defineKeywordingSuggestion;
