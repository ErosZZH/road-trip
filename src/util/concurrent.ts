/**
 * Map over `items` with a bounded number of concurrent async calls, preserving
 * input order in the result. Used to fetch the driving-route matrix without
 * firing dozens of Baidu requests at once (which the SDK throttles/drops).
 *
 * @param items  inputs to process
 * @param limit  max in-flight calls at any moment (>= 1)
 * @param fn     async worker; receives the item and its index
 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const size = Math.max(1, Math.min(limit, items.length || 1));
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]!, i);
    }
  }

  await Promise.all(Array.from({ length: size }, () => worker()));
  return results;
}
