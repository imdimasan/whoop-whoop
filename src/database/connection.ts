import { Pool } from "pg";
import { logger } from "../utils/logger.js";

/**
 * Database connection pool
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  // Updates are handled one by one, so a connection or query that hangs would
  // stall moderation in every group: fail fast and let callers use fallbacks
  connectionTimeoutMillis: 5000,
  query_timeout: 10000,
  // query_timeout only stops waiting on the client side; these make the
  // server cancel the statement too, so a lock held elsewhere (e.g. an open
  // transaction in psql) cannot pile up abandoned queries on the server
  statement_timeout: 8000,
  lock_timeout: 3000,
});

/**
 * Test connection on startup
 */
pool.on("connect", () => {
  logger.info("Connected to PostgreSQL database");
});

/**
 * Error handler
 */
pool.on("error", (err) => {
  logger.error("PostgreSQL connection error", { error: err.message });
});

export default pool;
