export function parseMetricValue(value: string, unit: "km" | "m") {
  const match = value
    .trim()
    .toLowerCase()
    .match(new RegExp(`^([\\d,.]+)\\s*${unit}$`));

  if (!match) {
    return 0;
  }

  return Number.parseFloat(match[1].replaceAll(",", "")) || 0;
}

export function getDistancePrecision(value: number) {
  return Number.isInteger(value) ? 0 : 1;
}

export function parseRaceDate(value: string) {
  const [day, month, year] = value
    .split("/")
    .map((part) => Number.parseInt(part, 10));

  if (!day || !month || !year) {
    return 0;
  }

  return new Date(year, month - 1, day).getTime();
}

export function formatRaceDate(value: string) {
  const timestamp = parseRaceDate(value);

  if (!timestamp) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(timestamp);
}
