/**
 * Executes `objectToMap`.
 * @param {unknown} value The value value.
 * @param {string} prefix The prefix value.
 * @returns {Map<string, string | number | boolean>} Result.
 */
export function objectToMap(value: unknown, prefix = ''): Map<string, string | number | boolean> {
  const result = new Map<string, string | number | boolean>();
  /**
   * Executes this implementation.
   * @param {unknown} current The current value.
   * @param {string} path The path value.
   * @returns {void} Result.
   */
  const visit = (current: unknown, path: string): void => {
    if (Array.isArray(current)) {
      current.forEach((entry, index) => visit(entry, `${path}/${index}`));
      return;
    }
    if (current && typeof current === 'object') {
      Object.entries(current).forEach(([key, entry]) => visit(entry, path ? `${path}/${key}` : key));
      return;
    }
    if (typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean')
      result.set(path, current);
  };
  visit(value, prefix);
  return result;
}
/**
 * Executes `parseObject`.
 * @param {T} value The value value.
 * @returns {T} Result.
 */
export function parseObject<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => parseObject(entry)) as T;
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) (value as Record<string, unknown>)[key] = parseObject(entry);
  }
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value) as T;
  return value;
}
