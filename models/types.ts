import type { Model, ModelStatic, Sequelize } from "sequelize";
import type * as SequelizeModule from "sequelize";

export type DataTypesInstance = typeof import("sequelize").DataTypes;

type BaseModel<TAttributes extends object, TCreationAttributes extends object> =
  Model<TAttributes, TCreationAttributes> & TAttributes;

export type AssociableModel<TModel extends Model = Model> = ModelStatic<TModel> & {
  associate?: (models: DbModels) => void;
};

export interface ForumAttributes {
  id: number;
  name: string | null;
  alternateNames: string[] | null;
  jufoLevel: number | null;
  jufoId: number | null;
  jufoFetchedAt: Date | null;
  jufoLastError: string | null;
  database: string | null;
  publisher: string | null;
  issn: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type ForumCreationAttributes = Partial<ForumAttributes>;
export type ForumModel = BaseModel<ForumAttributes, ForumCreationAttributes>;
export type ForumModelStatic = AssociableModel<ForumModel>;

export interface MappingQuestionAttributes {
  id: number;
  title: string | null;
  type: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type MappingQuestionCreationAttributes = Partial<MappingQuestionAttributes>;
export type MappingQuestionModel = BaseModel<
  MappingQuestionAttributes,
  MappingQuestionCreationAttributes
>;
export type MappingQuestionModelStatic = AssociableModel<MappingQuestionModel>;

export interface MappingOptionAttributes {
  id: number;
  title: string | null;
  position: number | null;
  color: string | null;
  mappingQuestionId: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type MappingOptionCreationAttributes = Partial<MappingOptionAttributes>;
export type MappingOptionModel = BaseModel<MappingOptionAttributes, MappingOptionCreationAttributes>;
export type MappingOptionModelStatic = AssociableModel<MappingOptionModel>;

export interface RecordMappingOptionAttributes {
  id: number;
  recordId: number;
  mappingQuestionId: number;
  mappingOptionId: number;
  createdAt: Date;
  updatedAt: Date;
}

export type RecordMappingOptionCreationAttributes = Partial<RecordMappingOptionAttributes>;
export type RecordMappingOptionModel = BaseModel<
  RecordMappingOptionAttributes,
  RecordMappingOptionCreationAttributes
>;
export type RecordMappingOptionModelStatic = AssociableModel<RecordMappingOptionModel>;

export type RecordStatus = "excluded" | "included" | "uncertain" | null;

export interface CrossrefAuthorDetail {
  given: string | null;
  family: string | null;
  name: string | null;
  sequence: string | null;
  orcid: string | null;
  affiliations: string[];
}

export interface CrossrefReferenceItem {
  doi: string | null;
  key: string | null;
  unstructured: string | null;
  articleTitle: string | null;
  journalTitle: string | null;
  author: string | null;
  year: string | null;
  volume: string | null;
  firstPage: string | null;
}

export interface RecordAttributes {
  id: number;
  title: string | null;
  url: string | null;
  author: string | null;
  status: RecordStatus;
  abstract: string | null;
  databases: string[] | null;
  alternateUrls: string[] | null;
  doi: string | null;
  authorDetails: CrossrefAuthorDetail[] | null;
  referenceItems: CrossrefReferenceItem[] | null;
  crossrefEnrichedAt: Date | null;
  crossrefLastError: string | null;
  forumId: number | null;
  editedBy: string | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type RecordCreationAttributes = Partial<RecordAttributes>;
export type RecordModel = BaseModel<RecordAttributes, RecordCreationAttributes>;
export type RecordModelStatic = AssociableModel<RecordModel> & {
  getAllByUrls: (searchUrls: string[]) => Promise<RecordModel[]>;
};

export interface ImportAttributes {
  id: number;
  database: string | null;
  total: number | null;
  dublicates: number | null;
  namesakes: string[] | null;
  query: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type ImportCreationAttributes = Partial<ImportAttributes>;
export type ImportModel = BaseModel<ImportAttributes, ImportCreationAttributes>;
export type ImportModelStatic = AssociableModel<ImportModel>;

export interface DbModels {
  Record: RecordModelStatic;
  Forum: ForumModelStatic;
  MappingQuestion: MappingQuestionModelStatic;
  MappingOption: MappingOptionModelStatic;
  RecordMappingOption: RecordMappingOptionModelStatic;
  Import: ImportModelStatic;
  sequelize: Sequelize;
  Sequelize: typeof SequelizeModule;
}

export type ModelFactory<TModel extends AssociableModel = AssociableModel> = (
  sequelize: Sequelize,
  dataTypes: DataTypesInstance,
) => TModel;
