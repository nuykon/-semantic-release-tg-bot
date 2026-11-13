export const asArray = <T>(data: T | readonly T[] | Iterable<T> | null | undefined): T[] => {
 if (data == null || data === '') return [];
 if (typeof data !== 'string' && typeof (data as Iterable<T>)[Symbol.iterator] === 'function') return Array.from(data as Iterable<T>);
 return [data as T];
};
