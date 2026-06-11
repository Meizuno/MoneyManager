// Augment H3's request context with the fields our middleware /
// services attach. Keeps `event.context.user` / `requestId` /
// `accessToken` typed everywhere they're read, instead of relying on
// `as AuthUser` casts at the call site.

import type { AuthUser } from '../utils/auth'

declare module 'h3' {
  interface H3EventContext {
    user?: AuthUser
    accessToken?: string
    requestId?: string
  }
}

export {}
