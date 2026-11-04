import type { Mark } from './model.ts'

/** Receipt time cannot make an old exchange update executable again. */
export function freshMark(mark: Mark | null | undefined, now: number): mark is Mark {
  return !!mark && Number.isFinite(mark.price) && mark.price > 0
    && Number.isFinite(mark.receivedAt) && now - mark.receivedAt <= 5000 && mark.receivedAt <= now + 1000
    && (mark.exchangeAt == null || Number.isFinite(mark.exchangeAt)
      && now - mark.exchangeAt <= 5000 && mark.exchangeAt <= now + 1000)
}
