import pc from "picocolors";
import type { Logger } from "@swibostyle/core";

/**
 * Create a console logger
 */
export function createLogger(): Logger {
  return {
    debug(message: string, ...args: unknown[]) {
      console.log(pc.dim(`[debug] ${format(message, args)}`));
    },
    info(message: string, ...args: unknown[]) {
      console.log(pc.blue(`[info] ${format(message, args)}`));
    },
    warn(message: string, ...args: unknown[]) {
      console.log(pc.yellow(`[warn] ${format(message, args)}`));
    },
    error(message: string, ...args: unknown[]) {
      console.error(pc.red(`[error] ${format(message, args)}`));
    },
  };
}

/**
 * Format message with arguments (simple printf-like)
 */
function format(message: string, args: unknown[]): string {
  let result = message;
  for (const arg of args) {
    result = result.replace(/%[sdifoO]/, String(arg));
  }
  return result;
}
