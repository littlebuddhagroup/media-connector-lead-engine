/**
 * Ejecuta un array de tareas async con concurrencia controlada.
 * Más rápido que secuencial, más seguro que Promise.all sin límite.
 *
 * @param items       Array de elementos a procesar
 * @param fn          Función async a aplicar a cada elemento
 * @param concurrency Máximo de promesas en vuelo simultáneamente (default: 5)
 */
export async function runConcurrently<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 5
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++
      results[i] = await fn(items[i], i)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker)
  await Promise.all(workers)
  return results
}
