/**
 * Aleatoriedad del sorteo.
 *
 * Se usa `crypto.getRandomValues` con rechazo de muestras para obtener enteros
 * uniformes: `Math.floor(Math.random() * n)` introduce un sesgo mínimo pero real
 * y aquí la promesa del producto es justamente que el sorteo sea limpio.
 */

const hasCrypto = typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'

/** Entero uniforme en [0, max). */
export function randomInt(max: number): number {
  if (max <= 0) throw new RangeError('randomInt requiere max > 0')
  if (!hasCrypto) return Math.floor(Math.random() * max)

  const limit = Math.floor(0xffffffff / max) * max
  const buffer = new Uint32Array(1)
  let value = 0
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]!
  } while (value >= limit)
  return value % max
}

/** Float uniforme en [0, 1). */
export function randomFloat(): number {
  if (!hasCrypto) return Math.random()
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0]! / 0x100000000
}

export function pickRandom<T>(items: readonly T[]): T | null {
  if (!items.length) return null
  return items[randomInt(items.length)]!
}

/**
 * Selección ponderada. Los pesos <= 0 se descartan; si todos lo son, cae a
 * selección uniforme para no dejar nunca al usuario sin resultado.
 */
export function pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number): T | null {
  if (!items.length) return null

  const weights = items.map((item) => {
    const weight = weightOf(item)
    return Number.isFinite(weight) && weight > 0 ? weight : 0
  })
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return pickRandom(items)

  let ticket = randomFloat() * total
  for (let i = 0; i < items.length; i++) {
    ticket -= weights[i]!
    if (ticket <= 0) return items[i]!
  }
  return items[items.length - 1]!
}

/** Baraja Fisher-Yates, usada por la animación de sorteo. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}
