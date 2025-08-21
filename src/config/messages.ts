const BOT_TITLE = `<b>that's the sound of da police</b> 🚔\n`;

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
  `Предупреждение ${warningCount}/${maxWarnings}\n` +
  `${firstName}, ваше сообщение было удалено.\n` +
  `Причина: ${reason}\n` +
  `Пожалуйста, соблюдайте правила группы.`;

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
 * Ticket sale warning message for the group
 * @example
 * const msg = ticketSaleWarningMessage('John', 'Продажа билетов без встречи может быть мошенничеством');
 */
export const ticketSaleWarningMessage = (
  firstName: string,
  aiExplanation: string
): string =>
  `${BOT_TITLE}\n` +
  `⚠️ <b>Подозрительное сообщение от ${firstName}</b> ⚠️\n\n` +
  `<b>Причина:</b>\n${aiExplanation}\n\n` +
  `<b>Советы по безопасности:</b>\n` +
  `• Встречайтесь лично, когда это возможно.\n` +
  `• Используйте безопасную оплату.\n` +
  `• Проверяйте подлинность билета.\n` +
  `• Не доверяйте незнакомцам в интернете.`;

/**
 * Bot welcome message for private chats
 * @example
 * const msg = welcomePrivateMessage('whoop_whoop_bot');
 */
export const welcomePrivateMessage = (botUsername: string): string => {
  return (
    `${BOT_TITLE}\n` + `👋 <b>В городе новый шериф: ${botUsername}!</b>\n\n`
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
    `${botUsername} активен!\n` +
    `Я буду автоматически модерировать сообщения в этой группе.\n` +
    `Убедитесь, что у меня есть права администратора для удаления сообщений и ограничения пользователей.`
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
    `<b>Команды бота:</b>\n\n` +
    `/start - Запустить бота\n` +
    `/help - Показать это сообщение помощи\n` +
    `/stats - Посмотреть статистику модерации\n` +
    `/settings - Настроить бота (только для админов)\n` +
    `/warnings - Проверить предупреждения пользователя (ответить на сообщение)\n` +
    `/clearwarnings - Очистить предупреждения пользователя (только для админов, ответить на сообщение)\n\n` +
    `<b>Требования для администратора:</b>\n` +
    `• Право удалять сообщения\n` +
    `• Право ограничивать участников\n\n` +
    `<b>Действия модерации:</b>\n` +
    `• <b>Предупреждение:</b> После нарушения контента\n` +
    `• <b>Блокировка:</b> После ${maxWarnings} предупреждений или средней серьёзности\n` +
    `• <b>Бан:</b> За серьёзные нарушения\n\n` +
    `Бот использует OpenAI для анализа сообщений на спам, неподходящий контент и нарушения правил.`
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
    canDelete && canRestrict ? "✅ Правильно настроен" : "❌ Отсутствуют права";

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
    `\n\n<i>Подробная статистика скоро...</i>`
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
): string =>
  `${BOT_TITLE}\n` +
  `<b>Настройки бота</b>\n\n` +
  `<b>Система предупреждений:</b>\n` +
  `Макс. предупреждений: ${maxWarnings}\n` +
  `Длительность блокировки: ${muteDurationMinutes} минут\n\n` +
  `<b>Пороги действий:</b>\n` +
  `Бан: ${banThreshold}% уверенности\n` +
  `Блокировка: ${muteThreshold}% уверенности\n` +
  `Удаление/Предупреждение: ${deleteThreshold}% уверенности\n\n` +
  `<i>Низкие пороги = больше предупреждений, высокие = строже</i>`;

/**
 * User warnings display message
 * @example
 * const msg = userWarningsMessage('John', 2, 3);
 */
export const userWarningsMessage = (
  firstName: string,
  warningCount: number,
  maxWarnings: number
): string =>
  `${BOT_TITLE}\n` +
  `<b>Предупреждения пользователя</b>\n\n` +
  `Пользователь: ${firstName}\n` +
  `Предупреждения: ${warningCount}/${maxWarnings}`;

/**
 * Warnings cleared confirmation message
 * @example
 * const msg = warningsClearedMessage('John');
 */
export const warningsClearedMessage = (firstName: string): string =>
  `✅ Предупреждения очищены для ${firstName}`;

/**
 * Error messages
 */
export const errorMessages = {
  privateOnly: "📊 Эта команда работает только в группах.",
  groupOnly: "Эта команда работает только в группах.",
  adminOnly: "❌ Только администраторы могут использовать эту команду.",
  replyRequired:
    "Пожалуйста, ответьте на сообщение пользователя, чтобы проверить его предупреждения.",
  replyRequiredClear:
    "Пожалуйста, ответьте на сообщение пользователя, чтобы очистить его предупреждения.",
} as const;

/**
 * Default reasons for moderation actions
 */
export const defaultReasons = {
  contentViolation: "Нарушение контента",
  policyViolation: "Нарушение правил",
  severeViolation: "Серьёзное нарушение правил",
} as const;
