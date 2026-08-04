export function generateId() {
  return Math.random()
    .toString(36)
    .substring(2, 9);
}

export function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.min(
    Math.max(value, min),
    max
  );
}