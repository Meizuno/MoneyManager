import { describe, it, expect } from 'vitest'
import { isError } from 'h3'
import {
  DomainError,
  ExpenseCategoryNotFound,
  IncomeCategoryNotFound,
  TransactionNotFound,
  Unauthorized
} from '../../../server/utils/errors'

describe('domain errors', () => {
  it('TransactionNotFound carries a 404 and the id in its message', () => {
    const err = new TransactionNotFound(42)
    expect(err.statusCode).toBe(404)
    expect(err.statusMessage).toBe('Transaction not found')
    expect(err.name).toBe('TransactionNotFound')
    expect(err.message).toContain('42')
    expect(err).toBeInstanceOf(DomainError)
  })

  it('IncomeCategoryNotFound / ExpenseCategoryNotFound carry their own status messages', () => {
    expect(new IncomeCategoryNotFound().statusMessage).toBe('Income category not found')
    expect(new ExpenseCategoryNotFound().statusMessage).toBe('Expense category not found')
  })

  it('Unauthorized carries a 401', () => {
    const err = new Unauthorized()
    expect(err.statusCode).toBe(401)
    expect(err.statusMessage).toBe('Unauthorized')
    expect(err.name).toBe('Unauthorized')
  })

  it('are recognized as H3 errors so Nitro renders the right status', () => {
    // isError keys off the H3Error brand; if this is false, Nitro would
    // treat the throw as an unhandled 500 instead of the carried status.
    expect(isError(new TransactionNotFound())).toBe(true)
    expect(isError(new Unauthorized())).toBe(true)
  })
})
