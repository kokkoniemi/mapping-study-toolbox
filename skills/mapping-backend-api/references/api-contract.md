# API Contract Reference

## Base URL
- Default local API root: `http://localhost:3000/api`

## Records endpoints
### `GET /records`
- Query params:
  - `offset` (number, default `0`)
  - `limit` (number, default `25`)
  - `status` (`null|uncertain|excluded|included`)
  - `search` (substring match over comment, title, author, databases)
- Response shape:
  - `{ count: number, records: Record[] }`
- Each record is fetched with includes:
  - `Publication`
  - `MappingOptions`

### `GET /records/:id`
- Response: single `Record` object (includes `Publication`, `MappingOptions`).

### `PUT /records/:id`
- Allowed update fields from UI:
  - `status`
  - `comment`
  - `editedBy`
  - `MappingOptions` (optional pass-through)
- Status validation in route currently allows:
  - `null`, `uncertain`, `excluded`, `included`

### `POST /records/:recordId/mapping-options`
- Body:
  - `mappingQuestionId`
  - `mappingOptionId`
- Creates join row in `RecordMappingOptions`.
- Returns the mapping option object.

### `DELETE /records/:recordId/mapping-options/:mappingOptionId`
- Deletes join row.
- Returns success string message.

## Mapping question endpoints
### `GET /mapping-questions`
- Response shape:
  - `{ count: number, questions: MappingQuestion[] }`
- Ordering:
  - Questions by `position ASC`
  - Nested `MappingOptions` by `position ASC`

### `POST /mapping-questions`
- Body: `title`, `type`, `position`
- Returns created question.

### `PUT /mapping-questions/:id`
- Body supports partial update of `title`, `type`, `position`.

### `DELETE /mapping-questions/:id`
- Deletes question.

## Mapping option endpoints under question
### `GET /mapping-questions/:id/mapping-options`
- Response shape:
  - `{ count: number, options: MappingOption[] }`

### `POST /mapping-questions/:id/mapping-options`
- Body: `title`, `position`, `color`
- Returns created option.

### `PUT /mapping-questions/:id/mapping-options/:optionId`
- Partial update for `title`, `color`, `position`.

### `DELETE /mapping-questions/:id/mapping-options/:optionId`
- Deletes option.
