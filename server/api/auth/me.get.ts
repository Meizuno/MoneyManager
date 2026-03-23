export default defineEventHandler(async (event) => {
  const user = await requireAuthUser(event);
  return { user };
});
