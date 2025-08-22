import { InlineKeyboard } from "grammy";
import { IBotContext } from "../interfaces/i-bot.js";
import { getGroupSettings, updateGroupSettings } from "../services/database.js";
import { logger } from "../utils/logger.js";

/**
 * Shows the main settings menu with inline keyboard buttons
 * @example
 * await showSettingsMenu(ctx);
 */
export const showSettingsMenu = async (ctx: IBotContext): Promise<void> => {
  const { chat } = ctx;

  if (!chat) {
    return;
  }

  // Get current settings
  const currentSettings = await getGroupSettings(chat.id);
  const currentMuteDuration = currentSettings.muteDurationMinutes || 60;
  const currentMaxReports = currentSettings.maxReports || 10;

  const keyboard = new InlineKeyboard()
    .text(`🔇 Минуты мута (${currentMuteDuration})`, "settings_mute_duration")
    .row()
    .text(
      `📊 Макс. жалоб для бана (${currentMaxReports})`,
      "settings_max_reports"
    )
    .row()
    .text("❌ Закрыть", "settings_close");

  const message = `⚙️ <b>Настройки группы</b>

<b>Текущие настройки:</b>
🔇 Длительность мута: <code>${currentMuteDuration}</code> минут
📊 Максимум жалоб на сообщение: <code>${currentMaxReports}</code>

Выберите параметр для изменения:`;

  await ctx.reply(message, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
};

/**
 * Handles callback queries from settings inline keyboard
 * @example
 * await handleSettingsCallback(ctx);
 */
export const handleSettingsCallback = async (
  ctx: IBotContext
): Promise<void> => {
  const { callbackQuery } = ctx;

  if (!callbackQuery || !callbackQuery.data) {
    return;
  }

  const { data } = callbackQuery;
  const { from, chat } = ctx;

  if (!from || !chat) {
    await ctx.answerCallbackQuery();
    return;
  }

  // Check admin permissions
  const member = await ctx.getChatMember(from.id);
  const isAdmin =
    member.status === "administrator" || member.status === "creator";

  if (!isAdmin) {
    await ctx.answerCallbackQuery();
    await ctx.reply("❌ Только администраторы могут изменять настройки");
    return;
  }

  try {
    switch (data) {
      case "settings_mute_duration":
        await handleMuteDurationSetting(ctx);
        break;

      case "settings_max_reports":
        await handleMaxReportsSetting(ctx);
        break;

      case "settings_close":
        await ctx.deleteMessage();
        await ctx.answerCallbackQuery();
        break;

      default:
        await ctx.answerCallbackQuery();
    }
  } catch (error) {
    logger.error("Settings callback error", { error, data });
    await ctx.answerCallbackQuery();
  }
};

/**
 * Handles mute duration setting with predefined options
 * @example
 * await handleMuteDurationSetting(ctx);
 */
const handleMuteDurationSetting = async (ctx: IBotContext): Promise<void> => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "🔇 <b>Настройка длительности мута</b>\n\nВыберите количество минут:",
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text("5 минут", "set_mute_5")
        .text("15 минут", "set_mute_15")
        .row()
        .text("30 минут", "set_mute_30")
        .text("60 минут", "set_mute_60")
        .row()
        .text("120 минут", "set_mute_120")
        .text("360 минут", "set_mute_360")
        .row()
        .text("1440 минут (24ч)", "set_mute_1440")
        .row()
        .text("⬅️ Назад", "settings_back"),
    }
  );
};

/**
 * Handles max reports setting with predefined options
 * @example
 * await handleMaxReportsSetting(ctx);
 */
const handleMaxReportsSetting = async (ctx: IBotContext): Promise<void> => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "📊 <b>Настройка максимального количества жалоб</b>\n\nВыберите количество жалоб на сообщение для бана:",
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard()
        .text("1 жалоба", "set_reports_1")
        .text("3 жалобы", "set_reports_3")
        .row()
        .text("5 жалоб", "set_reports_5")
        .text("8 жалоб", "set_reports_8")
        .row()
        .text("10 жалоб", "set_reports_10")
        .text("15 жалоб", "set_reports_15")
        .row()
        .text("20 жалоб", "set_reports_20")
        .text("30 жалоб", "set_reports_30")
        .row()
        .text("⬅️ Назад", "settings_back"),
    }
  );
};

/**
 * Handles setting value updates
 * @example
 * await handleSettingUpdate(ctx, 'mute', 60);
 */
export const handleSettingUpdate = async (
  ctx: IBotContext,
  type: string,
  value: number
): Promise<void> => {
  const { chat } = ctx;

  if (!chat) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    // Get current settings
    const currentSettings = await getGroupSettings(chat.id);
    let newSettings = { ...currentSettings };
    let successMessage = "";

    if (type === "mute") {
      newSettings.muteDurationMinutes = value;
      successMessage = `✅ Настройка обновлена!\n\nТеперь пользователи будут заблокированы на <b>${value}</b> минут.`;
    } else if (type === "reports") {
      newSettings.maxReports = value;
      successMessage = `✅ Настройка обновлена!\n\nТеперь пользователь будет заблокирован после <b>${value}</b> жалоб на сообщение.`;
    }

    const success = await updateGroupSettings(chat.id, newSettings);

    await ctx.answerCallbackQuery();

    if (success) {
      await ctx.editMessageText(successMessage, {
        parse_mode: "HTML",
        reply_markup: new InlineKeyboard()
          .text("⚙️ Настройки", "settings_back")
          .text("❌ Закрыть", "settings_close"),
      });
    } else {
      await ctx.editMessageText("❌ Ошибка при сохранении настроек", {
        reply_markup: new InlineKeyboard().text("⬅️ Назад", "settings_back"),
      });
    }
  } catch (error) {
    logger.error("Setting update error", { error, type, value });
    await ctx.answerCallbackQuery();
    await ctx.reply("❌ Произошла ошибка при обновлении настроек");
  }
};

/**
 * Handles going back to main settings menu
 * @example
 * await handleSettingsBack(ctx);
 */
export const handleSettingsBack = async (ctx: IBotContext): Promise<void> => {
  await ctx.answerCallbackQuery();

  const { chat } = ctx;

  if (!chat) {
    return;
  }

  // Get current settings
  const currentSettings = await getGroupSettings(chat.id);
  const currentMuteDuration = currentSettings.muteDurationMinutes || 60;
  const currentMaxReports = currentSettings.maxReports || 10;

  const keyboard = new InlineKeyboard()
    .text(`🔇 Минуты мута (${currentMuteDuration})`, "settings_mute_duration")
    .row()
    .text(
      `📊 Макс. жалоб для бана (${currentMaxReports})`,
      "settings_max_reports"
    )
    .row()
    .text("❌ Закрыть", "settings_close");

  const message = `⚙️ <b>Настройки группы</b>

<b>Текущие настройки:</b>
🔇 Длительность мута: <code>${currentMuteDuration}</code> минут
📊 Максимум жалоб на сообщение: <code>${currentMaxReports}</code>

Выберите параметр для изменения:`;

  await ctx.editMessageText(message, {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
};
