import { describe, expect, it } from "vitest";
import {
  moveOrderedItem,
  removeOrderedItem,
  sortOrderedItems,
  resequenceOrderedItems,
  upsertOrderedItem,
} from "@/lib/managed-content-order";

type FixtureItem = {
  id: string;
  sortOrder: number;
};

describe("managed-content-order", () => {
  it("assigns the next sequential order when creating a new item", () => {
    const items: FixtureItem[] = [
      { id: "one", sortOrder: 1 },
      { id: "two", sortOrder: 2 },
    ];

    expect(
      upsertOrderedItem(items, { id: "three", sortOrder: 999 }),
    ).toEqual([
      { id: "one", sortOrder: 1 },
      { id: "two", sortOrder: 2 },
      { id: "three", sortOrder: 3 },
    ]);
  });

  it("keeps the same position when updating an existing item", () => {
    const items: FixtureItem[] = [
      { id: "one", sortOrder: 1 },
      { id: "two", sortOrder: 2 },
      { id: "three", sortOrder: 3 },
    ];

    expect(
      upsertOrderedItem(items, { id: "two", sortOrder: 99 }),
    ).toEqual([
      { id: "one", sortOrder: 1 },
      { id: "two", sortOrder: 2 },
      { id: "three", sortOrder: 3 },
    ]);
  });

  it("reindexes the list after deleting an item", () => {
    const items: FixtureItem[] = [
      { id: "one", sortOrder: 1 },
      { id: "two", sortOrder: 2 },
      { id: "three", sortOrder: 3 },
    ];

    expect(removeOrderedItem(items, "two")).toEqual([
      { id: "one", sortOrder: 1 },
      { id: "three", sortOrder: 2 },
    ]);
  });

  it("moves an item up and keeps orders sequential", () => {
    const items: FixtureItem[] = [
      { id: "one", sortOrder: 1 },
      { id: "two", sortOrder: 2 },
      { id: "three", sortOrder: 3 },
    ];

    expect(moveOrderedItem(items, "three", "up")).toEqual([
      { id: "one", sortOrder: 1 },
      { id: "three", sortOrder: 2 },
      { id: "two", sortOrder: 3 },
    ]);
  });

  it("normalizes duplicate orders into a clean sequence", () => {
    const items: FixtureItem[] = [
      { id: "one", sortOrder: 1 },
      { id: "two", sortOrder: 1 },
      { id: "three", sortOrder: 4 },
    ];

    expect(resequenceOrderedItems(sortOrderedItems(items))).toEqual([
      { id: "one", sortOrder: 1 },
      { id: "two", sortOrder: 2 },
      { id: "three", sortOrder: 3 },
    ]);
  });
});
