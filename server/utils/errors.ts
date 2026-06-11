import { H3Error } from 'h3'

// Domain error taxonomy. Services throw these instead of sprinkling
// createError({ statusCode }) through the business logic; each error
// type defines its HTTP status + message in exactly one place (here).
//
// Why extend H3Error rather than map in a Nitro plugin: the Nitro
// `error` hook is observability-only (it cannot change the response),
// and Nitro renders the status straight off `error.statusCode` — but
// only treats an error as "handled" when `isError()` is true, which
// keys off H3Error's static `__h3_error__` brand (inherited by
// subclasses). Extending H3Error is therefore the framework-native way
// to get a typed taxonomy that renders with the right status and isn't
// logged as an unhandled 500.

export class DomainError extends H3Error {
  constructor(statusCode: number, statusMessage: string, message?: string) {
    super(message ?? statusMessage)
    this.name = new.target.name
    this.statusCode = statusCode
    this.statusMessage = statusMessage
  }
}

// 401 — the request needs an authenticated user and doesn't have one.
export class Unauthorized extends DomainError {
  constructor(message?: string) {
    super(401, 'Unauthorized', message)
  }
}

// 404 — a transaction (income or expense) row doesn't exist for this
// user. Income/Expense live in separate tables but are one logical
// resource over HTTP/MCP; the not-found message stays generic.
export class TransactionNotFound extends DomainError {
  constructor(id?: number | string) {
    super(404, 'Transaction not found', id ? `Transaction ${id} not found` : undefined)
  }
}

// 404 — a category row doesn't exist for this user.
export class IncomeCategoryNotFound extends DomainError {
  constructor(id?: number | string) {
    super(404, 'Income category not found', id ? `Income category ${id} not found` : undefined)
  }
}
export class ExpenseCategoryNotFound extends DomainError {
  constructor(id?: number | string) {
    super(404, 'Expense category not found', id ? `Expense category ${id} not found` : undefined)
  }
}
