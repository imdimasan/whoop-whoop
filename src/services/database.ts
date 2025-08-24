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

export interface BlockedMember {
  id: number;
  group_id: number;
  user_id: number;
  action_type: "ban" | "mute" | "delete";
  reason: string | null;
  message_content: string | null;
  duration_minutes: number | null;
  blocked_at: Date;
  blocked_by: string;
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

    // Create blocked_members table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blocked_members (
        id SERIAL PRIMARY KEY,
        group_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        action_type VARCHAR(20) NOT NULL, -- 'ban', 'mute', 'delete'
        reason TEXT,
        message_content TEXT,
        duration_minutes INTEGER, -- NULL for permanent bans, number for mutes
        blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        blocked_by VARCHAR(50) DEFAULT 'bot' -- 'bot', 'admin', 'community_reports'
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
      `CREATE INDEX IF NOT EXISTS idx_blocked_members_group_id ON blocked_members(group_id)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_blocked_members_user_id ON blocked_members(user_id)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_blocked_members_action_type ON blocked_members(action_type)`
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

/**
 * Record a moderation action (ban, mute, delete)
 * @example
 * await recordModerationAction(-1001, 123, 'ban', 'Drug dealer', 'продам травку', null, 'bot');
 */
export const recordModerationAction = async (
  groupId: number,
  userId: number,
  actionType: "ban" | "mute" | "delete",
  reason: string | null,
  messageContent: string | null,
  durationMinutes: number | null = null,
  blockedBy: string = "bot"
): Promise<boolean> => {
  try {
    await pool.query(
      `INSERT INTO blocked_members 
       (group_id, user_id, action_type, reason, message_content, duration_minutes, blocked_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        groupId,
        userId,
        actionType,
        reason,
        messageContent,
        durationMinutes,
        blockedBy,
      ]
    );

    logger.info("Moderation action recorded", {
      groupId,
      userId,
      actionType,
      reason,
      messageLength: messageContent?.length || 0,
      durationMinutes,
      blockedBy,
    });

    return true;
  } catch (error) {
    logger.error("Database error recording moderation action", {
      error,
      groupId,
      userId,
      actionType,
    });
    return false;
  }
};

/**
 * Get moderation statistics for a group
 * @example
 * const stats = await getModerationStats(-1001);
 */
export const getModerationStats = async (
  groupId: number
): Promise<{
  totalActions: number;
  bans: number;
  mutes: number;
  deletes: number;
  last24h: number;
  topReasons: Array<{ reason: string; count: number }>;
}> => {
  try {
    // Get total counts by action type
    const actionCounts = await pool.query(
      `SELECT action_type, COUNT(*) as count 
       FROM blocked_members 
       WHERE group_id = $1 
       GROUP BY action_type`,
      [groupId]
    );

    // Get actions in last 24 hours
    const recent = await pool.query(
      `SELECT COUNT(*) as count 
       FROM blocked_members 
       WHERE group_id = $1 AND blocked_at > NOW() - INTERVAL '24 hours'`,
      [groupId]
    );

    // Get top reasons
    const topReasons = await pool.query(
      `SELECT reason, COUNT(*) as count 
       FROM blocked_members 
       WHERE group_id = $1 AND reason IS NOT NULL 
       GROUP BY reason 
       ORDER BY count DESC 
       LIMIT 5`,
      [groupId]
    );

    const counts = { bans: 0, mutes: 0, deletes: 0 };
    actionCounts.rows.forEach((row) => {
      if (row.action_type === "ban") counts.bans = parseInt(row.count);
      else if (row.action_type === "mute") counts.mutes = parseInt(row.count);
      else if (row.action_type === "delete")
        counts.deletes = parseInt(row.count);
    });

    return {
      totalActions: counts.bans + counts.mutes + counts.deletes,
      bans: counts.bans,
      mutes: counts.mutes,
      deletes: counts.deletes,
      last24h: parseInt(recent.rows[0]?.count || "0"),
      topReasons: topReasons.rows.map((row) => ({
        reason: row.reason,
        count: parseInt(row.count),
      })),
    };
  } catch (error) {
    logger.error("Database error getting moderation stats", { error, groupId });
    return {
      totalActions: 0,
      bans: 0,
      mutes: 0,
      deletes: 0,
      last24h: 0,
      topReasons: [],
    };
  }
};

/**
 * Get user's moderation history
 * @example
 * const history = await getUserModerationHistory(-1001, 123);
 */
export const getUserModerationHistory = async (
  groupId: number,
  userId: number
): Promise<BlockedMember[]> => {
  try {
    const result = await pool.query(
      `SELECT * FROM blocked_members 
       WHERE group_id = $1 AND user_id = $2 
       ORDER BY blocked_at DESC`,
      [groupId, userId]
    );

    return result.rows;
  } catch (error) {
    logger.error("Database error getting user moderation history", {
      error,
      groupId,
      userId,
    });
    return [];
  }
};
