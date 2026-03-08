import type { Sequelize } from "sequelize";

import type { DbModels, ModelFactory, PublicationModelStatic } from "./types";

const definePublication: ModelFactory<PublicationModelStatic> = (sequelize: Sequelize, DataTypes) => {
  const Publication = sequelize.define(
    "Publication",
    {
      name: DataTypes.STRING,
      alternateNames: DataTypes.JSON,
      jufoLevel: DataTypes.INTEGER,
      database: DataTypes.STRING,
    },
    {
      paranoid: true,
    },
  ) as PublicationModelStatic;

  Publication.associate = (models: DbModels) => {
    Publication.hasMany(models.Record);
  };

  return Publication;
};

export default definePublication;
