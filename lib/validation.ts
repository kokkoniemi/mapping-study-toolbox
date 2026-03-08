import { badRequest } from "./http";

const getSingleValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

export const parseObject = (value: unknown, fieldName: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest(`${fieldName} must be an object`);
  }
  return value as Record<string, unknown>;
};

export const assertAllowedKeys = (
  input: Record<string, unknown>,
  allowedKeys: readonly string[],
  fieldName: string,
) => {
  const invalidKeys = Object.keys(input).filter((key) => !allowedKeys.includes(key));
  if (invalidKeys.length > 0) {
    throw badRequest(`${fieldName} contains unsupported keys`, { invalidKeys, allowedKeys });
  }
};

type IntegerOptions = {
  min?: number;
  max?: number;
  defaultValue?: number;
};

export const parseInteger = (value: unknown, fieldName: string, options: IntegerOptions = {}) => {
  const single = getSingleValue(value);
  if (single === undefined || single === null || single === "") {
    if (options.defaultValue !== undefined) {
      return options.defaultValue;
    }
    throw badRequest(`${fieldName} is required`);
  }

  const parsed =
    typeof single === "number"
      ? single
      : typeof single === "string"
        ? Number.parseInt(single, 10)
        : Number.NaN;

  if (!Number.isInteger(parsed)) {
    throw badRequest(`${fieldName} must be an integer`);
  }

  if (options.min !== undefined && parsed < options.min) {
    throw badRequest(`${fieldName} must be >= ${options.min}`);
  }

  if (options.max !== undefined && parsed > options.max) {
    throw badRequest(`${fieldName} must be <= ${options.max}`);
  }

  return parsed;
};

type StringOptions = {
  optional?: boolean;
  trim?: boolean;
  allowEmpty?: boolean;
  maxLength?: number;
};

export const parseString = (value: unknown, fieldName: string, options: StringOptions = {}) => {
  const single = getSingleValue(value);

  if (single === undefined || single === null) {
    if (options.optional) {
      return undefined;
    }
    throw badRequest(`${fieldName} is required`);
  }

  if (typeof single !== "string") {
    throw badRequest(`${fieldName} must be a string`);
  }

  const normalized = options.trim ? single.trim() : single;

  if (options.allowEmpty === false && normalized.length === 0) {
    throw badRequest(`${fieldName} must not be empty`);
  }

  if (options.maxLength !== undefined && normalized.length > options.maxLength) {
    throw badRequest(`${fieldName} must be at most ${options.maxLength} characters`);
  }

  return normalized;
};

export const parseOptionalNullableString = (
  value: unknown,
  fieldName: string,
  options: Omit<StringOptions, "optional"> = {},
) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return parseString(value, fieldName, { ...options, optional: false });
};
