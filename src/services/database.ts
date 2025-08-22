import pool from "../database/connection.js";
import { logger } from "../utils/logger.js";

export interface MessageReport {
  id: number;
  message_id: number;
  chat_id: number;
  target_user_id: number;
  reporter_user_id: number;
  reported_at: Date;
}

export interface GroupSettings {
  chat_id: number;
  settings: Record<string, any>;
}

/**
 * Initialize database tables
 * @example
 * await initializeTables();
 */
export const initializeTables = async (): Promise<void> => {
  try {
    // Create message_reports table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_reports (
        id SERIAL PRIMARY KEY,
        message_id BIGINT NOT NULL,
        chat_id BIGINT NOT NULL,
        target_user_id BIGINT NOT NULL,
        reporter_user_id BIGINT NOT NULL,
        reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, reporter_user_id)
      )
    `);

    // Create group_settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_settings (
        chat_id BIGINT PRIMARY KEY,
        settings JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_message_reports_message_id ON message_reports(message_id)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_message_reports_chat_id ON message_reports(chat_id)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_message_reports_target_user ON message_reports(target_user_id)`
    );

    logger.info("Database tables initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize database tables", { error });
    throw error;
  }
};

/**
 * Add a report for a specific message
 * @example
 * const result = await addReport(123, -1001, 456, 789);
 */
export const addReport = async (
  messageId: number,
  chatId: number,
  targetUserId: number,
  reporterUserId: number
): Promise<{
  success: boolean;
  reportCount: number;
  alreadyReported: boolean;
}> => {
  try {
    // Try to insert report (will fail if already exists due to UNIQUE constraint)
    const insertResult = await pool.query(
      `INSERT INTO message_reports (message_id, chat_id, target_user_id, reporter_user_id) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (message_id, reporter_user_id) DO NOTHING 
       RETURNING id`,
      [messageId, chatId, targetUserId, reporterUserId]
    );

    const alreadyReported = insertResult.rows.length === 0;

    // Get total report count for this specific message
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM message_reports WHERE message_id = $1`,
      [messageId]
    );

    const reportCount = parseInt(countResult.rows[0].count);

    logger.info("Report processed", {
      messageId,
      chatId,
      targetUserId,
      reporterUserId,
      reportCount,
      alreadyReported,
    });

    return { success: true, reportCount, alreadyReported };
  } catch (error) {
    logger.error("Database error adding report", {
      error,
      messageId,
      targetUserId,
      reporterUserId,
    });
    return { success: false, reportCount: 0, alreadyReported: false };
  }
};

/**
 * Get group settings
 * @example
 * const settings = await getGroupSettings(-1001);
 */
export const getGroupSettings = async (
  chatId: number
): Promise<Record<string, any>> => {
  try {
    const result = await pool.query(
      `SELECT settings FROM group_settings WHERE chat_id = $1`,
      [chatId]
    );

    return result.rows[0]?.settings || {};
  } catch (error) {
    logger.error("Database error getting group settings", { error, chatId });
    return {};
  }
};

/**
 * Update group settings
 * @example
 * await updateGroupSettings(-1001, { maxReports: 8 });
 */
export const updateGroupSettings = async (
  chatId: number,
  settings: Record<string, any>
): Promise<boolean> => {
  try {
    await pool.query(
      `INSERT INTO group_settings (chat_id, settings, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (chat_id) 
       DO UPDATE SET settings = $2, updated_at = NOW()`,
      [chatId, JSON.stringify(settings)]
    );

    logger.info("Group settings updated", { chatId, settings });
    return true;
  } catch (error) {
    logger.error("Database error updating group settings", { error, chatId });
    return false;
  }
};

/**
 * Get report statistics for a message
 * @example
 * const stats = await getMessageReportStats(123);
 */
export const getMessageReportStats = async (
  messageId: number
): Promise<{
  reportCount: number;
  reporters: number[];
}> => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count, array_agg(reporter_user_id) as reporters 
       FROM message_reports WHERE message_id = $1`,
      [messageId]
    );

    const row = result.rows[0];
    return {
      reportCount: parseInt(row.count) || 0,
      reporters: row.reporters || [],
    };
  } catch (error) {
    logger.error("Database error getting message report stats", {
      error,
      messageId,
    });
    return { reportCount: 0, reporters: [] };
  }
};
