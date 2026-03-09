# Data Model Reference

## Runtime configuration
- Sequelize runtime config source:
  - `config/config.json` in repo root (environment section selected by `NODE_ENV`)
  - fallback: `db-config.json` (legacy compatibility only)

## Core models
### `Record`
- Fields:
  - `title` (TEXT)
  - `url` (STRING)
  - `author` (STRING)
  - `status` (STRING)
  - `abstract` (TEXT)
  - `databases` (JSON array expected)
  - `alternateUrls` (JSON array expected)
  - `editedBy` (STRING)
  - `comment` (TEXT)
- Options:
  - `paranoid: true`
- Associations:
  - `belongsTo(Publication)`
  - `belongsToMany(MappingOption, through RecordMappingOption)`
- Custom static:
  - `Record.getAllByUrls(search_urls)` uses sqlite `json_each` against `alternateUrls`

### `Publication`
- Fields:
  - `name`, `alternateNames`, `jufoLevel`, `database`
- Options:
  - `paranoid: true`
- Associations:
  - `hasMany(Record)`

### `MappingQuestion`
- Fields:
  - `title`
  - `type` (default `multiSelect`)
  - `position` (default `0`)
- Options:
  - `paranoid: true`
- Associations:
  - `hasMany(MappingOption)`

### `MappingOption`
- Fields:
  - `title`
  - `position`
  - `color`
  - `mappingQuestionId`
- Options:
  - `paranoid: true`
- Associations:
  - `belongsTo(MappingQuestion)`
  - `belongsToMany(Record, through RecordMappingOption)`

### `RecordMappingOption`
- Fields:
  - `recordId`
  - `mappingQuestionId`
  - `mappingOptionId`
- Options:
  - `paranoid: false`
- Associations:
  - `belongsTo(Record)`
  - `belongsTo(MappingQuestion)`
  - `belongsTo(MappingOption)`

### `Import`
- Fields:
  - `database`
  - `total`
  - `dublicates` (legacy spelling in schema)
  - `namesakes`
  - `query`
- Options:
  - `paranoid: true`

## Schema practices
- Use new migration files for all schema updates.
- Keep in mind sqlite JSON behavior when querying `databases` and `alternateUrls`.
- Preserve field names with legacy spelling (`dublicates`) unless coordinating migration + consumer changes.
