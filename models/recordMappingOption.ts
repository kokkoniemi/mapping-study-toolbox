import type { Sequelize } from "sequelize";

const defineRecordMappingOption = (sequelize: Sequelize, DataTypes: any) => {
  const RecordMappingOption: any = sequelize.define(
    "RecordMappingOption",
    {
      recordId: DataTypes.INTEGER,
      mappingQuestionId: DataTypes.INTEGER,
      mappingOptionId: DataTypes.INTEGER,
    },
    {
      paranoid: false,
    },
  );

  RecordMappingOption.associate = (models: any) => {
    RecordMappingOption.belongsTo(models.Record);
    RecordMappingOption.belongsTo(models.MappingQuestion);
    RecordMappingOption.belongsTo(models.MappingOption);
  };

  return RecordMappingOption;
};

export default defineRecordMappingOption;
