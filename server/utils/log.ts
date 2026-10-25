import { format } from 'node:util'
import { consola } from 'consola'

// Logs. In production every entry is one line of JSON on stdout with its
// level in `level`: Alloy ships the container's output to Loki, which reads
// the level from that field (detected_level) and keeps an entry one entry.
// consola's text did neither — `[http] ℹ request {` and then a line per
// field, none with a level Loki recognises. The keys are Forma's
// (structlog): timestamp, level, event, then the entry's own fields.
// In dev it is consola as before, read by people rather than by Loki.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogFields = Record<string, unknown>
export type Log = Record<LogLevel, (event: string, fields?: LogFields) => void>

export function logLine(level: LogLevel, logger: string, event: string, fields: LogFields = {}, now = new Date()): string {
  const entry = { timestamp: now.toISOString(), level, logger, event }
  try {
    return JSON.stringify({ ...entry, ...fields }, plain)
  }
  catch (error) {
    // A field JSON can't write (a cycle) costs that entry its fields, never
    // the caller its request: console.error comes through here too.
    return JSON.stringify({ ...entry, unwritable: String(error) })
  }
}

// What JSON can't say on its own. An Error loses its stack either way: its
// own properties aren't enumerable, so it prints as {}, and h3's errors have
// a toJSON that leaves the stack and the cause out — hence `this[key]`, the
// value before its toJSON. A BigInt throws.
function plain(this: Record<string, unknown>, key: string, value: unknown): unknown {
  const original = this[key]
  if (original instanceof Error) {
    const { name, message, stack, cause } = original
    return cause === undefined ? { name, message, stack } : { name, message, stack, cause }
  }
  return typeof value === 'bigint' ? value.toString() : value
}

function write(level: LogLevel, logger: string, event: string, fields?: LogFields) {
  if (import.meta.dev) consola.withTag(logger)[level](event, ...(fields ? [fields] : []))
  else process.stdout.write(`${logLine(level, logger, event, fields)}\n`)
}

export function useLog(logger: string): Log {
  return {
    debug: (event, fields) => write('debug', logger, event, fields),
    info: (event, fields) => write('info', logger, event, fields),
    warn: (event, fields) => write('warn', logger, event, fields),
    error: (event, fields) => write('error', logger, event, fields)
  }
}

/**
 * A console call as an entry: its text as the event, and an Error among its
 * arguments as `error`, stack and all — Nuxt reports an unhandled error as
 * console.error('[request error] [unhandled] [GET] <url>\n', error).
 */
export function consoleEntry(args: unknown[]): { event: string, fields: LogFields } {
  const error = args.find(arg => arg instanceof Error)
  const event = format(...args.filter(arg => arg !== error)).trim()
  return { event, fields: error ? { error } : {} }
}

/** What Nitro, h3 and libraries print through console, as entries of the log. */
export function routeConsoleToLog() {
  const to = (level: LogLevel) => (...args: unknown[]) => {
    const { event, fields } = consoleEntry(args)
    write(level, 'console', event, fields)
  }
  console.debug = to('debug')
  console.log = to('info')
  console.info = to('info')
  console.warn = to('warn')
  console.error = to('error')
}
