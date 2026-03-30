import type { Sequelize } from "sequelize";

import type { DbModels, ModelFactory, RecordDocumentModelStatic } from "./types";

const defineRecordDocument: ModelFactory<RecordDocumentModelStatic> = (
  sequelize: Sequelize,
  DataTypes,
) => {
  const RecordDocument = sequelize.define(
    "RecordDocument",
    {
      recordId: DataTypes.INTEGER,
      originalFileName: DataTypes.STRING,
      storedPath: DataTypes.STRING,
      mimeType: DataTypes.STRING,
      checksum: DataTypes.STRING,
      fileSize: DataTypes.INTEGER,
      uploadStatus: DataTypes.STRING,
      extractionStatus: DataTypes.STRING,
      sourceType: DataTypes.STRING,
      pageCount: DataTypes.INTEGER,
      extractorKind: DataTypes.STRING,
      extractorVersion: DataTypes.STRING,
      extractedTextPath: DataTypes.STRING,
      structuredDocumentPath: DataTypes.STRING,
      chunkManifestPath: DataTypes.STRING,
      extractionError: DataTypes.TEXT,
      qualityStatus: DataTypes.STRING,
      qualityScore: DataTypes.FLOAT,
      printableTextRatio: DataTypes.FLOAT,
      weirdCharacterRatio: DataTypes.FLOAT,
      ocrUsed: DataTypes.BOOLEAN,
      ocrConfidence: DataTypes.FLOAT,
      extractionWarnings: DataTypes.JSON,
      isActive: DataTypes.BOOLEAN,
    },
    {
      paranoid: false,
    },
  ) as RecordDocumentModelStatic;

  RecordDocument.associate = (models: DbModels) => {
    RecordDocument.belongsTo(models.Record, { foreignKey: "recordId" });
    RecordDocument.hasMany(models.DocumentChunk, { foreignKey: "recordDocumentId" });
    RecordDocument.hasMany(models.KeywordingEvidenceSpan, { foreignKey: "recordDocumentId" });
  };

  return RecordDocument;
};

export default defineRecordDocument;
