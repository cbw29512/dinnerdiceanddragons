// Compatibility bridge for the already-ported application modules. The production
// runtime no longer calls Supabase: all CRUD operations below come from Netlify
// Database. This file is removed once the remaining imports are renamed.
export {
  DataAccessError,
  SupabaseRestError,
  databaseHealth,
  deleteRows,
  eq,
  inList,
  insertRows,
  isNull,
  neq,
  selectMany,
  selectOne,
  updateRows,
  withTransaction
} from "./database.mjs";

export class ApiConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ApiConfigError";
  }
}
