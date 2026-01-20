import { createLogger } from "lovely-logs";

const customLogger = createLogger({
  timestampEnabled: false,
  prefix: { info: "[INFO]", error: "[ERROR]", warn: "[WARN]", debug: "[DEBUG]", success: "[SUCCESS]" },
});

export default customLogger;
