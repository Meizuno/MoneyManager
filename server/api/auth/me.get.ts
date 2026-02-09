import { getAuthUser } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const user = await getAuthUser(event);
  return { user };
});
