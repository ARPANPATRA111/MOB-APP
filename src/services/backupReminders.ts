import * as Notifications from "expo-notifications";
import { getBackupStatus } from "./fullBackup";
import { setSetting } from "../repositories/settingsRepository";
const reminderId = "mopx-backup-reminder";
export const setBackupReminder = async (days: 0 | 1 | 7 | 30) => {
  if (days) {
    await Notifications.setNotificationChannelAsync("backups", {
      name: "Backup reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        "Allow notifications in Android settings to receive backup reminders.",
      );
  }
  await Notifications.cancelScheduledNotificationAsync(reminderId);
  if (days)
    await Notifications.scheduleNotificationAsync({
      identifier: reminderId,
      content: {
        title: "Keep your shop records safe",
        body: "Create a MOPX backup and save a copy outside this phone.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: days * 86400,
        repeats: true,
        channelId: "backups",
      },
    });
  await setSetting("fullBackupStatus", {
    ...(await getBackupStatus()),
    reminderDays: days,
  });
};

/** Restore OS scheduling as well as the stored preference, without a new permission prompt. */
export const restoreBackupReminder = async () => {
  const { reminderDays } = await getBackupStatus();
  const permission = await Notifications.getPermissionsAsync();
  const days =
    permission.granted && [1, 7, 30].includes(reminderDays)
      ? (reminderDays as 1 | 7 | 30)
      : 0;
  await setBackupReminder(days);
};
