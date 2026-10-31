export type BackResult = 'handled' | 'blocked' | 'pass';
const layers = new Set<{ handle: () => BackResult }>();

/** Opening order, not DOM order. Cleanup never affects another registration. */
export function registerBackLayer(handle: () => BackResult): () => void {
  const entry = { handle };
  layers.add(entry);
  return () => {
    layers.delete(entry);
  };
}

export function consumeBackLayer(): BackResult {
  const top = Array.from(layers).pop();
  return top ? top.handle() : 'pass';
}
