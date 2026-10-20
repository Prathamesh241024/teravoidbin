export const levelOf = xp => Math.floor(Math.sqrt(xp / 25)) + 1
export const levelStart = l => 25 * (l - 1) ** 2
export const levelInfo = xp => {
  const l = levelOf(xp), a = levelStart(l), b = levelStart(l + 1)
  return { level: l, into: xp - a, need: b - a, pct: Math.round(((xp - a) / (b - a)) * 100) }
}
