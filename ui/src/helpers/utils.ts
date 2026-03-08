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
