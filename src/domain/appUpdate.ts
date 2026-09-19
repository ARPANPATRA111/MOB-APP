/**
 * Update announcements are a small JSON document the shop owner edits in the
 * public repository. Nothing about the device is sent anywhere: the app only
 * downloads the file and compares versions locally.
 */
export interface UpdateManifest {
  /** Newest published version, e.g. "2.4.0". */
  latestVersion: string;
  /** Optional: versions below this should be told the update is important. */
  minSupportedVersion?: string;
  title?: string;
  message?: string;
  /** Where to get the new build (release page, store listing or direct APK). */
  url?: string;
}

export interface PendingUpdate {
  version: string;
  title: string;
  message: string;
  url: string | null;
  important: boolean;
}

const parse = (v: string) =>
  v
    .trim()
    .split(/[.+-]/)
    .slice(0, 3)
    .map((n) => Number.parseInt(n, 10) || 0);

/** Semantic-ish compare on the first three numeric parts. */
export const compareVersions = (a: string, b: string): number => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
};

/** Validates a downloaded manifest; anything malformed is treated as "no update". */
export const readManifest = (raw: unknown): UpdateManifest | null => {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.latestVersion !== "string" || !/^\d+\.\d+(\.\d+)?/.test(m.latestVersion)) return null;
  return {
    latestVersion: m.latestVersion,
    minSupportedVersion: typeof m.minSupportedVersion === "string" ? m.minSupportedVersion : undefined,
    title: typeof m.title === "string" ? m.title.slice(0, 80) : undefined,
    message: typeof m.message === "string" ? m.message.slice(0, 300) : undefined,
    url: typeof m.url === "string" && /^https:\/\//.test(m.url) ? m.url : undefined,
  };
};

/** Decides whether `current` should be told about the manifest's version. */
export const pendingUpdateFor = (current: string, manifest: UpdateManifest): PendingUpdate | null => {
  if (compareVersions(manifest.latestVersion, current) <= 0) return null;
  const important = !!manifest.minSupportedVersion && compareVersions(current, manifest.minSupportedVersion) < 0;
  return {
    version: manifest.latestVersion,
    title: manifest.title ?? `MOPX ${manifest.latestVersion} is available`,
    message:
      manifest.message ??
      (important
        ? "This version is no longer supported. Please update to keep your shop running smoothly."
        : "A newer version of MOPX is ready with improvements."),
    url: manifest.url ?? null,
    important,
  };
};
