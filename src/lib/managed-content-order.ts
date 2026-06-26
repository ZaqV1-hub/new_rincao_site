type OrderedItem = {
  id: string;
  sortOrder: number;
};

function compareByOrder<T extends OrderedItem>(a: T, b: T) {
  const orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);

  if (orderDiff !== 0) {
    return orderDiff;
  }

  return a.id.localeCompare(b.id);
}

export function sortOrderedItems<T extends OrderedItem>(items: T[]) {
  return [...items].sort(compareByOrder);
}

export function resequenceOrderedItems<T extends OrderedItem>(items: T[]) {
  return items.map((item, index) => ({
    ...item,
    sortOrder: index + 1,
  }));
}

export function upsertOrderedItem<T extends OrderedItem>(items: T[], nextItem: T) {
  const current = items.find((item) => item.id === nextItem.id) ?? null;
  const remaining = sortOrderedItems(items.filter((item) => item.id !== nextItem.id));

  return resequenceOrderedItems(
    sortOrderedItems([
      ...remaining,
      {
        ...nextItem,
        sortOrder: current?.sortOrder ?? remaining.length + 1,
      },
    ]),
  );
}

export function removeOrderedItem<T extends OrderedItem>(items: T[], id: string) {
  return resequenceOrderedItems(
    sortOrderedItems(items.filter((item) => item.id !== id)),
  );
}

export function moveOrderedItem<T extends OrderedItem>(
  items: T[],
  id: string,
  direction: "up" | "down",
) {
  const ordered = resequenceOrderedItems(sortOrderedItems(items));
  const index = ordered.findIndex((item) => item.id === id);

  if (index < 0) {
    return ordered;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= ordered.length) {
    return ordered;
  }

  const moved = [...ordered];
  const [item] = moved.splice(index, 1);
  moved.splice(targetIndex, 0, item);

  return resequenceOrderedItems(moved);
}
