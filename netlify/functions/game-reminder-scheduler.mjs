import { dispatchDueGameReminders } from "./_lib/reminder-dispatch.mjs";

export default async () => {
  try {
    const result = await dispatchDueGameReminders();
    console.log("[DDD Reminders] Scheduled dispatch complete", result);
  } catch (error) {
    console.error("[DDD Reminders] Scheduled dispatch failed", {
      error_type: String(error?.name || "Error")
    });
    throw error;
  }
};

export const config = {
  schedule: "*/15 * * * *"
};
