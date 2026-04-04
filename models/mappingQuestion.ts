import type { Sequelize } from "sequelize";

import type { DbModels, MappingQuestionModelStatic, ModelFactory } from "./types";

const defineMappingQuestion: ModelFactory<MappingQuestionModelStatic> = (
  sequelize: Sequelize,
  DataTypes,
) => {
  const MappingQuestion = sequelize.define(
    "MappingQuestion",
    {
      title: DataTypes.STRING,
      type: { type: DataTypes.STRING, defaultValue: "multiSelect" },
      position: { type: DataTypes.INTEGER, defaultValue: 0 },
      description: DataTypes.TEXT,
      decisionGuidance: DataTypes.TEXT,
      positiveExamples: DataTypes.JSON,
      negativeExamples: DataTypes.JSON,
      evidenceInstructions: DataTypes.TEXT,
      allowNewOption: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    {
      paranoid: true,
    },
  ) as MappingQuestionModelStatic;

  MappingQuestion.associate = (models: DbModels) => {
    MappingQuestion.hasMany(models.MappingOption);
  };

  return MappingQuestion;
};

export default defineMappingQuestion;
