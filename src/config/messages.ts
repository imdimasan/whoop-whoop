const BOT_TITLE = `🚔 <b>that's the sound of da police</b>\n`;

/**
 * Warning message template
 * @example
 * const msg = warningMessage('John', 2, 3, 'Inappropriate content');
 */
export const warningMessage = (
  firstName: string,
  warningCount: number,
  maxWarnings: number,
  reason: string
): string =>
  `${BOT_TITLE}\n` +
  `Warning ${warningCount}/${maxWarnings}\n` +
  `${firstName}, your message was deleted.\n` +
  `Reason: ${reason}\n` +
  `Please follow the group rules.`;

/**
 * User muted notification message
 * @example
 * const msg = mutedUserMessage('John', 5, 'Repeated violations');
 */
export const mutedUserMessage = (
  firstName: string,
  durationMinutes: number,
  reason: string
): string =>
  `${BOT_TITLE}\n` +
  `${firstName} has been muted for ${durationMinutes} minutes.\n` +
  `Reason: ${reason}`;

/**
 * User banned notification message
 * @example
 * const msg = bannedUserMessage('John', 'Severe policy violation');
 */
export const bannedUserMessage = (username: string, reason: string): string => {
  return (
    `${BOT_TITLE}\n` +
    `${username} has been permanently banned.\n` +
    `Reason: ${reason}`
  );
};

/**
 * Bot welcome message for private chats
 * @example
 * const msg = welcomePrivateMessage('whoop_whoop_bot');
 */
export const welcomePrivateMessage = (botUsername: string): string => {
  return (
    `👋 <b>Welcome to ${botUsername}!</b>\n\n` +
    `I'm an AI-powered moderation bot that helps keep Telegram groups safe and friendly.\n\n` +
    `<b>Features:</b>\n` +
    `• AI-powered content moderation\n` +
    `• Automatic spam detection\n` +
    `• Inappropriate content filtering\n` +
    `• Warning system for violations\n` +
    `• Temporary muting and banning\n\n` +
    `<b>How to use:</b>\n` +
    `1. Add me to your group\n` +
    `2. Make me an administrator with delete and restrict permissions\n` +
    `3. I'll automatically moderate messages\n\n` +
    `Use /help for more information.`
  );
};

/**
 * Bot active message for groups
 * @example
 * const msg = welcomeGroupMessage('whoop_whoop_bot');
 */
export const welcomeGroupMessage = (botUsername: string): string => {
  return (
    `${BOT_TITLE}\n` +
    `${botUsername} is active!\n` +
    `I'll moderate messages in this group automatically.\n` +
    `Make sure I have admin permissions to delete messages and restrict users.`
  );
};

/**
 * Help message with commands and information
 * @example
 * const msg = helpMessage(3);
 */
export const helpMessage = (maxWarnings: number): string => {
  return (
    `${BOT_TITLE}\n` +
    `<b>Bot Commands:</b>\n\n` +
    `/start - Initialize the bot\n` +
    `/help - Show this help message\n` +
    `/stats - View moderation statistics\n` +
    `/settings - Configure bot settings (admin only)\n` +
    `/warnings - Check user warnings (reply to message)\n` +
    `/clearwarnings - Clear user warnings (admin only, reply to message)\n\n` +
    `<b>Admin Requirements:</b>\n` +
    `• Delete messages permission\n` +
    `• Restrict members permission\n\n` +
    `<b>Moderation Actions:</b>\n` +
    `• <b>Warning:</b> After content violation\n` +
    `• <b>Mute:</b> After ${maxWarnings} warnings or medium severity\n` +
    `• <b>Ban:</b> For severe violations\n\n` +
    `The bot uses OpenAI to analyze messages for spam, inappropriate content, and policy violations.`
  );
};

/**
 * Statistics message with bot status and permissions
 * @example
 * const msg = statsMessage('My Group', true, true, []);
 */
export const statsMessage = (
  groupTitle: string,
  canDelete: boolean,
  canRestrict: boolean,
  missingPermissions: string[]
): string => {
  const permissionStatus =
    canDelete && canRestrict
      ? "✅ Properly configured"
      : "❌ Missing permissions";

  return (
    `${BOT_TITLE}\n` +
    `<b>Moderation Statistics</b>\n\n` +
    `Group: ${groupTitle}\n` +
    `Bot Status: ${permissionStatus}\n` +
    `OpenAI: ✅ Connected\n\n` +
    `<b>Permissions:</b>\n` +
    `Delete messages: ${canDelete ? "✅" : "❌"}\n` +
    `Restrict members: ${canRestrict ? "✅" : "❌"}\n` +
    (missingPermissions.length > 0
      ? `\n⚠️ Missing: ${missingPermissions.join(", ")}`
      : "") +
    `\n\n<i>Detailed statistics coming soon...</i>`
  );
};

/**
 * Settings message showing current configuration
 * @example
 * const msg = settingsMessage(3, 5, 95, 80, 30);
 */
export const settingsMessage = (
  maxWarnings: number,
  muteDurationMinutes: number,
  banThreshold: number,
  muteThreshold: number,
  deleteThreshold: number
): string => {
  return (
    `${BOT_TITLE}\n` +
    `<b>Bot Settings</b>\n\n` +
    `<b>Warning System:</b>\n` +
    `Max Warnings: ${maxWarnings}\n` +
    `Mute Duration: ${muteDurationMinutes} minutes\n\n` +
    `<b>Action Thresholds:</b>\n` +
    `Ban: ${banThreshold}% confidence\n` +
    `Mute: ${muteThreshold}% confidence\n` +
    `Delete/Warn: ${deleteThreshold}% confidence\n\n` +
    `<i>Lower thresholds = more warnings, higher = stricter</i>`
  );
};

/**
 * User warnings display message
 * @example
 * const msg = userWarningsMessage('John', 2, 3);
 */
export const userWarningsMessage = (
  firstName: string,
  warningCount: number,
  maxWarnings: number
): string => {
  return (
    `${BOT_TITLE}\n` +
    `<b>User Warnings</b>\n\n` +
    `User: ${firstName}\n` +
    `Warnings: ${warningCount}/${maxWarnings}`
  );
};

/**
 * Warnings cleared confirmation message
 * @example
 * const msg = warningsClearedMessage('John');
 */
export const warningsClearedMessage = (firstName: string): string => {
  return `✅ Warnings cleared for ${firstName}`;
};

/**
 * Error messages
 */
export const errorMessages = {
  privateOnly: "📊 This command only works in groups.",
  groupOnly: "This command only works in groups.",
  adminOnly: "❌ Only administrators can use this command.",
  replyRequired: "Please reply to a user's message to check their warnings.",
  replyRequiredClear:
    "Please reply to a user's message to clear their warnings.",
} as const;

/**
 * Default reasons for moderation actions
 */
export const defaultReasons = {
  contentViolation: "Content violation",
  policyViolation: "Policy violation",
  severeViolation: "Severe policy violation",
} as const;
