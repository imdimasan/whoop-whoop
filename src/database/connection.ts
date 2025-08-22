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
