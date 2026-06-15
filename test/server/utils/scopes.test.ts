import { describe, it, expect } from 'vitest'
import { isScope, requireScope, type Principal } from '../../../server/utils/scopes'

const all: Principal = { userId: 'u', scopes: 'all' }
const read: Principal = { userId: 'u', scopes: ['read'] }
const add: Principal = { userId: 'u', scopes: ['add'] }
const both: Principal = { userId: 'u', scopes: ['read', 'add'] }

describe('requireScope', () => {
  it('full access can do everything, including unassigned (full-only) operations', () => {
    expect(requireScope(all, 'read')).toBe(true)
    expect(requireScope(all, 'add')).toBe(true)
    expect(requireScope(all)).toBe(true) // no scope = full-access-only op
  })

  it('a read PAT can read only', () => {
    expect(requireScope(read, 'read')).toBe(true)
    expect(requireScope(read, 'add')).toBe(false)
    expect(requireScope(read)).toBe(false)
  })

  it('an add PAT can add only', () => {
    expect(requireScope(add, 'add')).toBe(true)
    expect(requireScope(add, 'read')).toBe(false)
    expect(requireScope(add)).toBe(false)
  })

  it('a read+add PAT can read and add but still not full-only operations', () => {
    expect(requireScope(both, 'read')).toBe(true)
    expect(requireScope(both, 'add')).toBe(true)
    expect(requireScope(both)).toBe(false)
  })

  it('default-deny: an operation with no scope assigned is full-access only', () => {
    // This is the guarantee that any new, unannotated operation is safe.
    for (const p of [read, add, both]) expect(requireScope(p)).toBe(false)
    expect(requireScope(all)).toBe(true)
  })
})

describe('isScope', () => {
  it('accepts known scopes and rejects anything else', () => {
    expect(isScope('read')).toBe(true)
    expect(isScope('add')).toBe(true)
    expect(isScope('delete')).toBe(false)
    expect(isScope('')).toBe(false)
    expect(isScope(undefined)).toBe(false)
  })
})
