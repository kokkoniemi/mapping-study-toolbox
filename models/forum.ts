import type { Sequelize } from "sequelize";

import type { DbModels, ForumModelStatic, ModelFactory } from "./types";

const defineForum: ModelFactory<ForumModelStatic> = (sequelize: Sequelize, DataTypes) => {
  const Forum = sequelize.define(
    "Forum",
    {
      name: DataTypes.STRING,
      alternateNames: DataTypes.JSON,
      enrichmentProvenance: DataTypes.JSON,
      jufoLevel: DataTypes.INTEGER,
      jufoId: DataTypes.INTEGER,
      jufoFetchedAt: DataTypes.DATE,
      jufoLastError: DataTypes.TEXT,
      database: DataTypes.STRING,
      publisher: DataTypes.STRING,
      issn: DataTypes.STRING,
    },
    {
      paranoid: true,
    },
  ) as ForumModelStatic;

  Forum.associate = (models: DbModels) => {
    Forum.hasMany(models.Record, { foreignKey: "forumId" });
  };

  return Forum;
};

export default defineForum;
