export function getYearRange() {
  const current = new Date().getFullYear()
  return Array.from({ length: current - 1939 }, (_, i) => current - i)
}
