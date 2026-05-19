/**
 * Runs `process` over every item in `items` with at most `concurrency` tasks
 * running at once. Reports progress after each item completes.
 * Returns results in the same order as `items`; null where process threw.
 */
export async function runConcurrent<T, R>(
  items: T[],
  process: (item: T, index: number) => Promise<R | null>,
  options: { concurrency: number; onProgress?: (done: number, total: number) => void },
): Promise<(R | null)[]> {
  const results: (R | null)[] = Array(items.length).fill(null)
  let nextIdx = 0
  let doneCount = 0

  async function worker() {
    while (nextIdx < items.length) {
      const i = nextIdx++
      try {
        results[i] = await process(items[i], i)
      } catch {
        results[i] = null
      }
      doneCount++
      options.onProgress?.(doneCount, items.length)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, items.length) }, worker),
  )
  return results
}
