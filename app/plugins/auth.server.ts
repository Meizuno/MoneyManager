// Populate the authenticated user during SSR. refresh() uses the
// request-aware fetch, so the forwarded auth cookies authenticate
// /api/auth/me on the server; the user lands in the payload and the
// header renders signed-in on the first paint — no client round-trip.
export default defineNuxtPlugin(async () => {
  await useAuth().refresh();
});
