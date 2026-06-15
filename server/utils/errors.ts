import { H3Error } from 'h3'
import type { TransactionType } from '#shared/schemas/transaction'

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

// 403 — the principal is authenticated but its scopes don't permit the
// operation (e.g. a read-only PAT attempting a write). Distinct from 401:
// the credentials are valid, they're just not sufficient.
export class Forbidden extends DomainError {
  constructor(message?: string) {
    super(403, 'Forbidden', message ?? 'This token is not permitted to perform this action')
  }
}

// 404 — a personal access token row doesn't exist for this user.
export class PatNotFound extends DomainError {
  constructor(id?: string) {
    super(404, 'Token not found', id ? `Token ${id} not found` : undefined)
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

// 400 — a transaction write referenced a category id that doesn't exist
// for this user under the resolved transaction type. Distinct from the
// *CategoryNotFound 404s above (which are about category CRUD): here the
// category is a foreign-key reference on a transaction, so a bad value is
// invalid input, not a missing resource. The message names the right tool
// so an MCP caller can recover by fetching a real id.
export class CategoryNotFound extends DomainError {
  constructor(type: TransactionType, id: number | string) {
    const tool = type === 'expense' ? 'get_expense_categories' : 'get_income_categories'
    super(
      400,
      'Category not found',
      `${type === 'expense' ? 'Expense' : 'Income'} category ${id} does not exist. Fetch a valid id via ${tool}.`
    )
  }
}

// 400 — category input that isn't a numeric id reached the MCP boundary
// (e.g. the model passed a category NAME like "Food"). Rejected loudly
// rather than silently coerced to 0, so the mistake surfaces as a tool
// error the model must correct.
export class InvalidCategoryInput extends DomainError {
  constructor() {
    super(
      400,
      'Invalid category',
      'category must be a numeric id from get_expense_categories / get_income_categories'
    )
  }
}
