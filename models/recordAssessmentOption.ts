import type { Sequelize } from "sequelize";

import type { DbModels, ModelFactory, RecordAssessmentOptionModelStatic } from "./types";

const defineRecordAssessmentOption: ModelFactory<RecordAssessmentOptionModelStatic> = (
  sequelize: Sequelize,
  DataTypes,
) => {
  const RecordAssessmentOption = sequelize.define(
    "RecordAssessmentOption",
    {
      recordAssessmentId: DataTypes.INTEGER,
      mappingOptionId: DataTypes.INTEGER,
    },
    {
      paranoid: false,
    },
  ) as RecordAssessmentOptionModelStatic;

  RecordAssessmentOption.associate = (models: DbModels) => {
    RecordAssessmentOption.belongsTo(models.RecordAssessment, { foreignKey: "recordAssessmentId" });
    RecordAssessmentOption.belongsTo(models.MappingOption, { foreignKey: "mappingOptionId" });
  };

  return RecordAssessmentOption;
};

export default defineRecordAssessmentOption;
