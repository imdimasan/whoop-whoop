import { TContentType } from "../interfaces/i-content";
import { TModerationAction } from "../interfaces/i-actions";

/**
 * Gets action and reason for content type
 * @example
 * const { action, reason } = getActionForContentType('drugs');
 */
const getActionForContentType = (
  contentType: TContentType
): { action: TModerationAction; reason: string } => {
  switch (contentType) {
    case "drugs":
      return {
        action: "ban",
        reason: "Обнаружен контент, связанный с наркотиками",
      };
    case "jobs":
      return {
        action: "ban",
        reason: "Обнаружено предложение работы или найм",
      };
    case "gambling":
      return {
        action: "ban",
        reason: "Обнаружен спам казино/азартных игр",
      };
    case "financial":
      return {
        action: "ban",
        reason: "Обнаружена финансовая схема (займы, быстрые деньги)",
      };
    case "tickets":
      return {
        action: "mute",
        reason: "Обнаружена продажа билетов - возможный риск мошенничества",
      };
    case "default":
    default:
      return { action: "none", reason: "Разрешенный контент" };
  }
};

export default getActionForContentType;
