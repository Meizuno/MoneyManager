import { describe, expect, it, vi } from 'vitest'
import { createPull } from '../../../app/utils/pull'

function setup(state: { scrollY?: number, canPull?: boolean } = {}) {
  const onTrigger = vi.fn()
  const seen: number[] = []
  const pull = createPull({
    scrollY: () => state.scrollY ?? 0,
    canPull: () => state.canPull ?? true,
    onTrigger,
    onDistance: distance => seen.push(distance)
  })
  return { pull, onTrigger, last: () => seen.at(-1) ?? 0 }
}

describe('pull to refresh', () => {
  it('reloads when let go past the threshold', () => {
    const { pull, onTrigger, last } = setup()
    pull.start(100)
    expect(pull.move(200)).toBe(true) // the page is held still meanwhile
    expect(last()).toBe(50) // damped by half
    pull.move(250)
    pull.end()
    expect(onTrigger).toHaveBeenCalledOnce()
  })

  it('springs back when let go short of it', () => {
    const { pull, onTrigger, last } = setup()
    pull.start(100)
    pull.move(200)
    pull.end()
    expect(onTrigger).not.toHaveBeenCalled()
    expect(last()).toBe(0)
  })

  it('opens no further than its cap', () => {
    const { pull, last } = setup()
    pull.start(0)
    pull.move(1000)
    expect(last()).toBe(120)
  })

  it('is only a pull from the very top of the page', () => {
    const state = { scrollY: 40 }
    const { pull, onTrigger } = setup(state)
    pull.start(100)
    expect(pull.move(400)).toBe(false) // an ordinary scroll, left alone
    pull.end()
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it('lets go when the page scrolls away under it', () => {
    const state = { scrollY: 0 }
    const { pull, onTrigger, last } = setup(state)
    pull.start(100)
    pull.move(200)
    state.scrollY = 5
    expect(pull.move(400)).toBe(false)
    expect(last()).toBe(0)
    pull.end()
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it('does nothing while a sheet is open: it is swiped down to close', () => {
    const { pull, onTrigger } = setup({ canPull: false })
    pull.start(0)
    expect(pull.move(500)).toBe(false)
    pull.end()
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it('pushing up is not a pull', () => {
    const { pull, onTrigger, last } = setup()
    pull.start(300)
    expect(pull.move(100)).toBe(false)
    expect(last()).toBe(0)
    pull.end()
    expect(onTrigger).not.toHaveBeenCalled()
  })
})
