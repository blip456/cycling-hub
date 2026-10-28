/** Round tick values covering [min, max], at most about five of them. */
export function niceTicks(min: number, max: number): number[] {
  const low = max - min < 1 ? (min + max) / 2 - 0.5 : min;
  const high = max - min < 1 ? (min + max) / 2 + 0.5 : max;
  const span = high - low;
  const step = [0.5, 1, 2, 5, 10, 20].find((s) => span / s <= 4) ?? 50;
  const first = Math.floor(low / step) * step;
  const ticks: number[] = [];
  for (let value = first; value <= high + step; value += step) {
    ticks.push(Math.round(value * 100) / 100);
    if (value >= high) break;
  }
  return ticks;
}
