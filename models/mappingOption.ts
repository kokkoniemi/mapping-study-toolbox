import type { Sequelize } from "sequelize";

const defineMappingOption = (sequelize: Sequelize, DataTypes: any) => {
  const MappingOption: any = sequelize.define(
    "MappingOption",
    {
      title: DataTypes.STRING,
      position: DataTypes.INTEGER,
      color: DataTypes.STRING,
      mappingQuestionId: DataTypes.INTEGER,
    },
    {
      paranoid: true,
    },
  );

  MappingOption.associate = (models: any) => {
    MappingOption.belongsTo(models.MappingQuestion);
    MappingOption.belongsToMany(models.Record, { through: models.RecordMappingOption });
  };

  return MappingOption;
};

export default defineMappingOption;
