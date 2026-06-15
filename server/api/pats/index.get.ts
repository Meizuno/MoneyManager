// List the viewer's PATs (full-access only). Returns summaries only —
// never the token value or its hash.
export default defineEventHandler(async (event) => {
  const pats = await listPats(event)
  return { pats }
})
