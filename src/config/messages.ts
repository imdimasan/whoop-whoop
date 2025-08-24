const BOT_TITLE = `<b>that's the sound of da police</b> 🚔\n`;

/**
 * Mild violation warning message (auto-deletes)
 * @example
 * const msg = mildViolationWarning('John', 'Неподходящий язык');
 */
export const mildViolationWarning = (
  firstName: string,
  reason: string
): string =>
  `${BOT_TITLE}\n` +
  `Сообщение ${firstName} было удалено.\n` +
  `Причина: ${reason}\n`;

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
  `${firstName} заблокирован на ${durationMinutes} минут.\n` +
  `Причина: ${reason}`;

/**
 * User banned notification message
 * @example
 * const msg = bannedUserMessage('John', 'Severe policy violation');
 */
export const bannedUserMessage = (username: string, reason: string): string => {
  return (
    `${BOT_TITLE}\n` +
    `${username} навсегда заблокирован.\n` +
    `Причина: ${reason}`
  );
};

/**
 * Community-based ban message
 * @example
 * const msg = communityBannedUserMessage('John');
 */
export const communityBannedUserMessage = (username: string): string => {
  return (
    `${BOT_TITLE}\n` +
    `${username} заблокирован на основании жалоб участников группы.`
  );
};

/**
 * Ticket sale warning message for the group
 * @example
 * const msg = ticketSaleWarningMessage('John', 'Продажа билетов без встречи может быть мошенничеством');
 */
export const ticketSaleWarningMessage = (
  firstName: string,
  aiExplanation: string
): string =>
  `${BOT_TITLE}\n` +
  `⚠️ <b>Сообщение ${firstName} имеет высокий риск мошенничества</b> ⚠️\n\n` +
  `<b>Причина:</b>\n${aiExplanation}\n\n` +
  `<b>Считаете это сообщение мошенническим?:</b>\n` +
  `• Ответьте на сообщение пользователя командой /report.\n`;

/**
 * Bot welcome message for private chats
 * @example
 * const msg = welcomePrivateMessage('yourbotname_bot');
 */
export const welcomePrivateMessage = (botUsername: string): string => {
  return (
    `👋 <b>В городе новый шериф: ${botUsername}!</b>\n` + `${BOT_TITLE}\n\n`
  );
};

/**
 * Bot active message for groups
 * @example
 * const msg = welcomeGroupMessage('yourbotname_bot');
 */
export const welcomeGroupMessage = (botUsername: string): string => {
  return (
    `${BOT_TITLE}\n` +
    `${botUsername} активен!\n` +
    `Я буду автоматически модерировать сообщения в этой группе.\n` +
    `Убедитесь, что у меня есть права администратора для удаления сообщений и ограничения пользователей.`
  );
};

/**
 * Help message with commands and information
 * @example
 * const msg = helpMessage();
 */
export const helpMessage = (): string => {
  return (
    `${BOT_TITLE}\n` +
    `<b>Команды бота:</b>\n\n` +
    `/start - Запустить бота\n` +
    `/help - Показать это сообщение помощи\n` +
    `/stats - Посмотреть статистику модерации\n` +
    `/settings - Настроить бота (только для админов)\n` +
    `/report - Пожаловаться на пользователя (ответить на сообщение)\n\n` +
    `<b>Требования для администратора:</b>\n` +
    `• Право удалять сообщения\n` +
    `• Право ограничивать участников\n\n` +
    `<b>Действия модерации:</b>\n` +
    `• <b>Удаление:</b> Подозрительные предложения работы\n` +
    `• <b>Блокировка:</b> Потенциальные наркокурьеры\n` +
    `• <b>Бан:</b> Подтвержденные наркодилеры\n` +
    `• <b>Репорты:</b> Участники могут жаловаться на любой контент командой /report\n\n` +
    `Бот специализируется исключительно на антинаркотической деятельности. Все остальные нарушения модерируются участниками через систему репортов.`
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
  missingPermissions: string[],
  moderationStats?: {
    totalActions: number;
    bans: number;
    mutes: number;
    deletes: number;
    last24h: number;
    topReasons: Array<{ reason: string; count: number }>;
  }
): string => {
  const permissionStatus =
    canDelete && canRestrict ? "✅ Правильно настроен" : "❌ Отсутствуют права";

  let statsSection = `\n\n<i>Подробная статистика скоро...</i>`;

  if (moderationStats && moderationStats.totalActions > 0) {
    const topReasonsText =
      moderationStats.topReasons.length > 0
        ? moderationStats.topReasons
            .slice(0, 3)
            .map((r) => `• ${r.reason}: ${r.count}`)
            .join("\n")
        : "Нет данных";

    statsSection =
      `\n\n<b>📊 Статистика модерации:</b>\n` +
      `Всего действий: ${moderationStats.totalActions}\n` +
      `🚫 Баны: ${moderationStats.bans}\n` +
      `🔇 Блокировки: ${moderationStats.mutes}\n` +
      `🗑 Удаления: ${moderationStats.deletes}\n` +
      `⏰ За 24 часа: ${moderationStats.last24h}\n\n` +
      `<b>Топ причины:</b>\n${topReasonsText}`;
  }

  return (
    `${BOT_TITLE}\n` +
    `<b>Статистика модерации</b>\n\n` +
    `Группа: ${groupTitle}\n` +
    `Статус бота: ${permissionStatus}\n` +
    `OpenAI: ✅ Подключен\n\n` +
    `<b>Права:</b>\n` +
    `Удаление сообщений: ${canDelete ? "✅" : "❌"}\n` +
    `Ограничение участников: ${canRestrict ? "✅" : "❌"}\n` +
    (missingPermissions.length > 0
      ? `\n⚠️ Отсутствует: ${missingPermissions.join(", ")}`
      : "") +
    statsSection
  );
};

/**
 * Error messages
 */
export const errorMessages = {
  privateOnly: "📊 Эта команда работает только в группах.",
  groupOnly: "Эта команда работает только в группах.",
  adminOnly: "❌ Только администраторы могут использовать эту команду.",
} as const;

/**
 * Default reasons for moderation actions
 */
export const defaultReasons = {
  contentViolation: "Нарушение контента",
  policyViolation: "Нарушение правил",
  severeViolation: "Серьёзное нарушение правил",
} as const;
