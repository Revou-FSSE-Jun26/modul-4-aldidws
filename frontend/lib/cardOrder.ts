/**
 * Compute the Float `order` for a card dropped at `targetIndex` in a column.
 *
 * `cards` is the destination column's cards sorted by `order`. If the moving
 * card is already in that list (same-column reorder), pass `movingId` so it is
 * ignored and `targetIndex` refers to the list without it.
 * The result is never negative.
 */
export function computeCardOrder(
  cards: { id: string; order: number }[],
  targetIndex: number,
  movingId?: string,
): number {
  const list = movingId ? cards.filter((c) => c.id !== movingId) : cards;

  if (list.length === 0) return 0;

  if (targetIndex <= 0) {
    const first = list[0].order;
    return first > 0 ? first / 2 : 0;
  }

  if (targetIndex >= list.length) {
    return list[list.length - 1].order + 1;
  }

  return (list[targetIndex - 1].order + list[targetIndex].order) / 2;
}
