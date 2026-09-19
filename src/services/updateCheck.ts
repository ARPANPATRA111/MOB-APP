import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import { compareVersions, pendingUpdateFor, readManifest, type PendingUpdate } from "../domain/appUpdate";
import { getSetting, setSetting } from "../repositories/settingsRepository";
import { notifyDataChanged } from "./dataEvents";

/** Edited by the shop owner in the public repository to announce a release. */
export const UPDATE_MANIFEST_URL =
  "https://raw.githubusercontent.com/ARPANPATRA111/MOB-APP/main/docs/update.json";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CHANNEL = "updates";

export const currentVersion = () => Constants.expoConfig?.version ?? "0.0.0";

/** Last update the app learned about, if it is still newer than what is installed. */
export const getPendingUpdate = async (): Promise<PendingUpdate | null> => {
  const stored = await getSetting<PendingUpdate | null>("pendingUpdate", null);
  if (!stored?.version) return null;
  return compareVersions(stored.version, currentVersion()) > 0 ? stored : null;
};

const fetchManifest = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(UPDATE_MANIFEST_URL, {
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) return null;
    return readManifest(await response.json());
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Lenient, privacy-preserving update check: at most once a day, silent on any
 * failure, and it never prompts for notification permission by itself. The OS
 * notification only fires when the user already allowed notifications (for
 * example by turning on backup reminders); otherwise the in-app row is enough.
 */
export const checkForUpdates = async (force = false): Promise<PendingUpdate | null> => {
  const now = Date.now();
  const last = await getSetting<number>("updateCheckAt", 0);
  if (!force && now - last < CHECK_INTERVAL_MS) return getPendingUpdate();
  await setSetting("updateCheckAt", now);
  const manifest = await fetchManifest().catch(() => null);
  if (!manifest) return getPendingUpdate();
  const pending = pendingUpdateFor(currentVersion(), manifest);
  await setSetting("pendingUpdate", pending);
  notifyDataChanged();
  if (!pending) return null;
  const notified = await getSetting<string>("updateNotifiedVersion", "");
  if (notified !== pending.version) {
    const permission = await Notifications.getPermissionsAsync().catch(() => null);
    if (permission?.granted) {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: "App updates",
        importance: Notifications.AndroidImportance.LOW,
      }).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: `mopx-update-${pending.version}`,
        content: { title: pending.title, body: pending.message },
        trigger: null,
      }).catch(() => {});
      await setSetting("updateNotifiedVersion", pending.version);
    }
  }
  return pending;
};

export type OtaResult = "installed" | "none" | "unavailable";

/**
 * EAS Update (over-the-air JS updates) check. Automatic checks also run at
 * launch; this is the explicit path behind Settings → Check for updates.
 * Returns "installed" once a newer bundle has been downloaded; the caller
 * decides when to reload so it never interrupts an open bill.
 */
export const checkOtaUpdate = async (): Promise<OtaResult> => {
  if (__DEV__ || !Updates.isEnabled || Updates.isEmbeddedLaunch === undefined) return "unavailable";
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return "none";
    const fetched = await Updates.fetchUpdateAsync();
    return fetched.isNew ? "installed" : "none";
  } catch {
    return "unavailable";
  }
};

export const applyOtaUpdate = () => Updates.reloadAsync();
