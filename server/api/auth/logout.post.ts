export default defineEventHandler(async (event) => {
  clearAuthCookies(event);
  return { ok: true };
});
