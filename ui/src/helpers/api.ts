const API_ROOT = "http://localhost:3000/api/";
const REQUEST_TIMEOUT_MS = 10000;
const REQUEST_RETRY_COUNT = 3;
const REQUEST_RETRY_DELAY_MS = 300;

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Primitive = string | number | boolean;
export type QueryValue = Primitive | null | undefined | Primitive[];
export type QueryParams = Record<string, QueryValue>;
export type HttpResponse<T> = {
  data: T;
  status: number;
};

type RequestOptions<TBody> = {
  params?: QueryParams | undefined;
  data?: TBody | undefined;
};

export class HttpError<T = unknown> extends Error {
  response: {
    status: number;
    data: T;
  };

  constructor(message: string, status: number, data: T) {
    super(message);
    this.name = "HttpError";
    this.response = { status, data };
  }
}

export const buildUrl = (path: string, params?: QueryParams): string => {
  const url = new URL(path, API_ROOT);

  if (!params) {
    return url.toString();
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)));
      return;
    }

    url.searchParams.append(key, String(value));
  });

  return url.toString();
};

const parseResponse = async <TResponse>(response: Response): Promise<TResponse> => {
  if (response.status === 204) {
    return undefined as TResponse;
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return (await response.text()) as TResponse;
  }

  const body = await response.text();
  if (!body) {
    return undefined as TResponse;
  }

  return JSON.parse(body) as TResponse;
};

const request = async <TResponse = unknown, TBody = unknown>(
  method: HttpMethod,
  path: string,
  { params, data }: RequestOptions<TBody> = {},
): Promise<HttpResponse<TResponse>> => {
  const maxAttempts = method === "GET" ? REQUEST_RETRY_COUNT : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(buildUrl(path, params), {
        method,
        headers: {
          Accept: "application/json",
          ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
        signal: controller.signal,
      });

      const payload = await parseResponse<TResponse>(response);

      if (!response.ok) {
        throw new HttpError(`HTTP ${response.status} for ${method} ${path}`, response.status, payload);
      }

      return { data: payload, status: response.status };
    } catch (error) {
      lastError = error;

      const isRetryable =
        method === "GET"
        && attempt < maxAttempts
        && !(error instanceof HttpError);

      if (!isRetryable) {
        console.error(error);
        throw error;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, REQUEST_RETRY_DELAY_MS * attempt);
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
};

export const http = {
  get: <TResponse>(path: string, { params }: { params?: QueryParams | undefined } = {}) =>
    request<TResponse>("GET", path, { params }),
  post: <TResponse, TBody = unknown>(
    path: string,
    data: TBody,
    { params }: { params?: QueryParams | undefined } = {},
  ) => request<TResponse, TBody>("POST", path, { params, data }),
  put: <TResponse, TBody = unknown>(
    path: string,
    data: TBody,
    { params }: { params?: QueryParams | undefined } = {},
  ) => request<TResponse, TBody>("PUT", path, { params, data }),
  patch: <TResponse, TBody = unknown>(
    path: string,
    data: TBody,
    { params }: { params?: QueryParams | undefined } = {},
  ) => request<TResponse, TBody>("PATCH", path, { params, data }),
  delete: <TResponse>(path: string, { params }: { params?: QueryParams | undefined } = {}) =>
    request<TResponse>("DELETE", path, { params }),
};

export interface MappingOption {
  id: number;
  title: string;
  position: number;
  color: string | null;
  mappingQuestionId: number;
  [key: string]: unknown;
}

export type RecordStatus = "uncertain" | "excluded" | "included" | null;

export interface MappingQuestion {
  id: number;
  title: string;
  type: string;
  position: number;
  MappingOptions?: MappingOption[];
  [key: string]: unknown;
}

export interface Publication {
  id: number;
  name: string;
  jufoLevel: number | null;
  [key: string]: unknown;
}

export interface RecordItem {
  id: number;
  title: string;
  author: string;
  url: string;
  databases: string[];
  alternateUrls: string[];
  abstract: string | null;
  createdAt: string;
  updatedAt: string;
  status: RecordStatus;
  comment: string | null;
  Publication?: Publication | null;
  MappingOptions: MappingOption[];
  [key: string]: unknown;
}

interface RecordsIndexResponse {
  count: number;
  records: RecordItem[];
}

interface MappingQuestionsIndexResponse {
  count: number;
  questions: MappingQuestion[];
}

interface MappingOptionsIndexResponse {
  count: number;
  options: MappingOption[];
}

type UpdateRecordPayload = Record<string, unknown>;
export type PatchRecordPayload = Partial<{
  title: string;
  author: string;
  url: string;
  status: RecordStatus;
  comment: string | null;
  abstract: string | null;
  databases: string[];
  alternateUrls: string[];
  editedBy: string;
}>;
type SaveMappingOptionPayload = {
  mappingOptionId: number;
  mappingQuestionId: number;
};

type SaveQuestionPayload = {
  title: string;
  type: string;
  position: number;
};

type UpdateQuestionPayload = Partial<SaveQuestionPayload>;
type SaveQuestionOptionPayload = {
  title: string;
  position: number;
  color?: string | null;
};

type UpdateQuestionOptionPayload = Partial<SaveQuestionOptionPayload>;

export const records = {
  index: (params?: QueryParams) => http.get<RecordsIndexResponse>("records", { params }),
  get: (id: number, params?: QueryParams) => http.get<RecordItem>(`records/${id}`, { params }),
  update: (id: number, data: UpdateRecordPayload, params?: QueryParams) =>
    http.put<RecordItem, UpdateRecordPayload>(`records/${id}`, data, { params }),
  patch: (id: number, data: PatchRecordPayload, params?: QueryParams) =>
    http.patch<RecordItem, PatchRecordPayload>(`records/${id}`, data, { params }),
  mappingOptions: {
    save: (id: number, data: SaveMappingOptionPayload, params?: QueryParams) =>
      http.post<MappingOption, SaveMappingOptionPayload>(`records/${id}/mapping-options`, data, {
        params,
      }),
    delete: (id: number, optionId: number, params?: QueryParams) =>
      http.delete<string>(`records/${id}/mapping-options/${optionId}`, { params }),
  },
};

export const mappingQuestions = {
  index: (params?: QueryParams) =>
    http.get<MappingQuestionsIndexResponse>("mapping-questions", { params }),
  save: (data: SaveQuestionPayload, params?: QueryParams) =>
    http.post<MappingQuestion, SaveQuestionPayload>("mapping-questions", data, { params }),
  update: (id: number, data: UpdateQuestionPayload, params?: QueryParams) =>
    http.put<MappingQuestion, UpdateQuestionPayload>(`mapping-questions/${id}`, data, {
      params,
    }),
  delete: (id: number, params?: QueryParams) =>
    http.delete<MappingQuestion>(`mapping-questions/${id}`, { params }),
  mappingOptions: {
    index: (id: number, params?: QueryParams) =>
      http.get<MappingOptionsIndexResponse>(`mapping-questions/${id}/mapping-options`, {
        params,
      }),
    save: (id: number, data: SaveQuestionOptionPayload, params?: QueryParams) =>
      http.post<MappingOption, SaveQuestionOptionPayload>(
        `mapping-questions/${id}/mapping-options`,
        data,
        { params },
      ),
    update: (id: number, optionId: number, data: UpdateQuestionOptionPayload, params?: QueryParams) =>
      http.put<MappingOption, UpdateQuestionOptionPayload>(
        `mapping-questions/${id}/mapping-options/${optionId}`,
        data,
        { params },
      ),
    delete: (id: number, optionId: number, params?: QueryParams) =>
      http.delete<MappingOption>(`mapping-questions/${id}/mapping-options/${optionId}`, {
        params,
      }),
  },
};
