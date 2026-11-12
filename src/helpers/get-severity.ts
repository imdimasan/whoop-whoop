import { TContentType } from "../interfaces/i-content";

/**
 * Gets severity for content type
 * @example
 * const severity = getSeverityForContentType('drugs');
 */
const getSeverityForContentType = (
  contentType: TContentType
): "low" | "medium" | "high" => {
  switch (contentType) {
    case "drugs":
    case "jobs":
    case "gambling":
    case "financial":
    case "scam":
      return "high";
    case "tickets":
      return "medium";
    case "default":
      return "low";
    default:
      return "low";
  }
};

export default getSeverityForContentType;
