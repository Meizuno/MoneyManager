import { describe, it, expect } from 'vitest'
import { formatMoney, formatNumber, moneyParts, parseAmount } from '../../../app/utils/money'

describe('parseAmount', () => {
  it.each([
    ['450', 450],
    ['12.5', 12.5],
    ['12,50', 12.5],
    ['1 250,50', 1250.5],
    ['1.250,50', 1250.5],
    ['1,250.50', 1250.5],
    ['1,250', 1250],
    ['  99  ', 99]
  ])('reads %j as %d', (text, value) => {
    expect(parseAmount(text)).toBe(value)
  })

  it.each(['', '   ', 'abc', '-5', '12.5.1', '1e3'])('refuses %j', (text) => {
    expect(parseAmount(text)).toBeNull()
  })
})

// Intl puts a no-break space between the code and the number.
const nb = (text: string) => text.replace(' ', '\u00a0')

describe('formatting', () => {
  it('puts the currency first and keeps two decimals', () => {
    expect(formatMoney(12620.27, 'CZK')).toBe(nb('CZK 12,620.27'))
    expect(formatMoney(12620.27, 'CZK', false)).toBe(nb('CZK 12,620'))
  })

  it('falls back to CZK without a usable currency', () => {
    expect(formatMoney(5, null)).toBe(nb('CZK 5.00'))
    expect(formatMoney(5, 'nope')).toBe(nb('CZK 5.00'))
    expect(formatMoney(5, 'eur')).toBe('€5.00')
  })

  it('splits out the cents for quieter rendering', () => {
    const types = moneyParts(1234.5, 'CZK').map(p => p.type)
    expect(types).toContain('currency')
    expect(types).toContain('fraction')
  })

  it('formats a bare number', () => {
    expect(formatNumber(68000)).toBe('68,000.00')
  })
})
