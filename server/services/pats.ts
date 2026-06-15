import type { H3Event } from 'h3'
import type { CreatePatInput } from '#shared/schemas/pat'
import { authorize } from '../utils/principal'
import { createPatScoped, listPatsScoped, revokePatScoped } from '../utils/pats'

// HTTP use-cases for PAT management. Managing tokens is full-access only
// (no scope argument → default-deny): a PAT can never mint or manage
// PATs, only a session/JWT principal can.

export async function createPat(event: H3Event, input: CreatePatInput) {
  const { userId } = await authorize(event)
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
  return createPatScoped(userId, input.name, input.scopes, expiresAt)
}

export async function listPats(event: H3Event) {
  const { userId } = await authorize(event)
  return listPatsScoped(userId)
}

export async function revokePat(event: H3Event, id: string) {
  const { userId } = await authorize(event)
  return revokePatScoped(userId, id)
}
