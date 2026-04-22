export type DebouncedCallback<Args extends unknown[]> = ((
	...args: Args
) => void) & {
	cancel: () => void;
};

export const debounceCallback = <Args extends unknown[]>(
	callback: (...args: Args) => void,
	delayMs: number,
): DebouncedCallback<Args> => {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const debounced = ((...args: Args) => {
		if (timeoutId !== null) {
			clearTimeout(timeoutId);
		}

		timeoutId = setTimeout(() => {
			timeoutId = null;
			callback(...args);
		}, delayMs);
	}) as DebouncedCallback<Args>;

	debounced.cancel = () => {
		if (timeoutId === null) {
			return;
		}

		clearTimeout(timeoutId);
		timeoutId = null;
	};

	return debounced;
};
