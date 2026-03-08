import type { Sequelize } from "sequelize";

const definePublication = (sequelize: Sequelize, DataTypes: any) => {
  const Publication: any = sequelize.define(
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
  );

  Publication.associate = (models: any) => {
    Publication.hasMany(models.Record);
  };

  return Publication;
};

export default definePublication;
