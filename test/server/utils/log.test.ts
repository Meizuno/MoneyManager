import { describe, expect, it } from 'vitest'
import { createError } from 'h3'
import { consoleEntry, logLine } from '../../../server/utils/log'

const NOW = new Date('2026-10-25T13:25:39.884Z')

describe('logLine', () => {
  it('is one line of JSON with the level where Loki looks for it', () => {
    const line = logLine('info', 'http', 'request', { method: 'GET', path: '/api/me', status: 200 }, NOW)
    expect(line).not.toContain('\n')
    expect(JSON.parse(line)).toEqual({
      timestamp: '2026-10-25T13:25:39.884Z',
      level: 'info',
      logger: 'http',
      event: 'request',
      method: 'GET',
      path: '/api/me',
      status: 200
    })
  })

  it('keeps an error with its stack, still on one line', () => {
    const error = new Error('port in use', { cause: new Error('EADDRINUSE') })
    const line = logLine('error', 'metrics', 'cannot serve metrics', { port: 9000, error }, NOW)
    expect(line).not.toContain('\n')
    const { error: logged } = JSON.parse(line)
    expect(logged).toMatchObject({ name: 'Error', message: 'port in use', cause: { message: 'EADDRINUSE' } })
    expect(logged.stack).toContain('port in use\n    at ')
  })

  it('keeps the stack and the cause of an h3 error, which its toJSON leaves out', () => {
    const error = createError({ statusCode: 500, cause: new Error("Can't reach database server") })
    const { error: logged } = JSON.parse(logLine('error', 'console', '[request error]', { error }, NOW))
    expect(logged.stack).toContain('\n    at ')
    expect(logged.cause).toMatchObject({ message: "Can't reach database server" })
    expect(logged.cause.stack).toContain('\n    at ')
  })

  it('writes a BigInt as a string rather than throwing', () => {
    expect(JSON.parse(logLine('info', 'db', 'count', { rows: 12n }, NOW)).rows).toBe('12')
  })

  it('never throws: an entry with a cycle in it is written without its fields', () => {
    const cyclic: Record<string, unknown> = { id: 1 }
    cyclic.self = cyclic
    const logged = JSON.parse(logLine('error', 'console', 'boom', { cyclic }, NOW))
    expect(logged).toMatchObject({ level: 'error', logger: 'console', event: 'boom' })
    expect(logged.unwritable).toContain('circular')
    expect(logged.cyclic).toBeUndefined()
  })
})

describe('consoleEntry', () => {
  it('takes the text as the event and the Error apart, as Nuxt reports an unhandled one', () => {
    const error = new TypeError('x is undefined')
    const { event, fields } = consoleEntry(['[request error] [unhandled] [GET] /api/overview\n', error])
    expect(event).toBe('[request error] [unhandled] [GET] /api/overview')
    expect(fields).toEqual({ error })
  })

  it('formats like console does when there is no error', () => {
    expect(consoleEntry(['[cache] %s miss', 'rates', { ttl: 60 }])).toEqual({
      event: '[cache] rates miss { ttl: 60 }',
      fields: {}
    })
  })
})
