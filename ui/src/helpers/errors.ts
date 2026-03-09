import { HttpError } from "./api";

export const getApiErrorMessage = (error: unknown) => {
  if (error instanceof HttpError) {
    const data = error.response.data as { error?: { message?: string } } | undefined;
    return data?.error?.message ?? `Request failed (${error.response.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed";
};
