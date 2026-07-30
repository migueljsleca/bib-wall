const CARD_WIDTH = 290;
const CANVAS_HORIZONTAL_SPACING = 60;
const MIN_GRID_COLUMNS = 4;
const MAX_GRID_COLUMNS = 9;
const MIN_TILE_WIDTH = 3400;

export function getGridColumns(raceCount: number) {
  if (raceCount <= 0) {
    return 1;
  }

  const minColumns = Math.min(MIN_GRID_COLUMNS, raceCount);
  const maxColumns = Math.min(MAX_GRID_COLUMNS, raceCount);
  const widthPreferredColumns = Math.min(
    maxColumns,
    Math.max(
      minColumns,
      Math.ceil(MIN_TILE_WIDTH / (CARD_WIDTH + CANVAS_HORIZONTAL_SPACING))
    )
  );

  let bestColumns = widthPreferredColumns;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let columns = widthPreferredColumns; columns <= maxColumns; columns += 1) {
    const repeatedCells = (columns - (raceCount % columns)) % columns;
    const preferredWidthPenalty = Math.abs(columns - widthPreferredColumns);
    const score = repeatedCells * 100 + preferredWidthPenalty * 10;

    if (score < bestScore) {
      bestScore = score;
      bestColumns = columns;
    }
  }

  return bestColumns;
}

export function createTiledItems<T>(
  items: readonly T[],
  gridColumns: number,
  gridRows: number
) {
  if (items.length === 0) {
    return [];
  }

  const tileCellCount = gridColumns * gridRows;
  return Array.from(
    { length: tileCellCount },
    (_, index) => items[index % items.length]
  );
}
