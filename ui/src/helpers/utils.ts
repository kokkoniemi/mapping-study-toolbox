export const keyCodes = {
  ARROW_LEFT: 37,
  ARROW_RIGHT: 39,
} as const;

export const debounce = <TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delay = 300,
) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function debounced(this: unknown, ...args: TArgs) {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
};

export const decodeHtmlEntities = (value: string) =>
  value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g, (match, entity) => {
    const token = String(entity);
    if (token.startsWith("#x") || token.startsWith("#X")) {
      const codePoint = Number.parseInt(token.slice(2), 16);
      if (!Number.isFinite(codePoint) || codePoint <= 0) {
        return match;
      }
      return String.fromCodePoint(codePoint);
    }
    if (token.startsWith("#")) {
      const codePoint = Number.parseInt(token.slice(1), 10);
      if (!Number.isFinite(codePoint) || codePoint <= 0) {
        return match;
      }
      return String.fromCodePoint(codePoint);
    }
    return HTML_ENTITY_MAP[token.toLocaleLowerCase()] ?? match;
  });
