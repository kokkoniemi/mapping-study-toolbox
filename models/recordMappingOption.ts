import type { Sequelize } from "sequelize";

import type { DbModels, ModelFactory, RecordMappingOptionModelStatic } from "./types";

const defineRecordMappingOption: ModelFactory<RecordMappingOptionModelStatic> = (
  sequelize: Sequelize,
  DataTypes,
) => {
  const RecordMappingOption = sequelize.define(
    "RecordMappingOption",
    {
      recordId: DataTypes.INTEGER,
      mappingQuestionId: DataTypes.INTEGER,
      mappingOptionId: DataTypes.INTEGER,
    },
    {
      paranoid: false,
    },
  ) as RecordMappingOptionModelStatic;

  RecordMappingOption.associate = (models: DbModels) => {
    RecordMappingOption.belongsTo(models.Record);
    RecordMappingOption.belongsTo(models.MappingQuestion);
    RecordMappingOption.belongsTo(models.MappingOption);
  };

  return RecordMappingOption;
};

export default defineRecordMappingOption;
