export const keyCodes = {
    ARROW_LEFT: 37,
    ARROW_RIGHT: 39
};

export const debounce = (fn, delay = 300) => {
    let timeoutId = null;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
        }, delay);
    };
};
