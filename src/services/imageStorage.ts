import * as FileSystem from 'expo-file-system/legacy';

/**
 * App-owned directory for product images. Only files inside this directory are
 * ever deleted by the cleanup utility — external/user files are never touched.
 */
export const PRODUCT_IMAGE_DIR = `${FileSystem.documentDirectory ?? ''}product_images/`;

export const ensureImageDir = async (): Promise<string> => {
  const info = await FileSystem.getInfoAsync(PRODUCT_IMAGE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PRODUCT_IMAGE_DIR, { intermediates: true });
  }
  return PRODUCT_IMAGE_DIR;
};

const isAppOwned = (uri: string): boolean => uri.startsWith(PRODUCT_IMAGE_DIR);

export interface OrphanCleanupResult {
  /** File URIs that are (or would be) removed. */
  orphans: string[];
  /** True when nothing was actually deleted (preview). */
  dryRun: boolean;
  removed: number;
}

/**
 * Remove images in the app-owned directory that no product references. Pass
 * `dryRun: true` to preview without deleting. Never deletes files outside
 * PRODUCT_IMAGE_DIR, and never deletes a referenced file.
 */
export const cleanupOrphanImages = async (
  referencedUris: (string | undefined | null)[],
  options: { dryRun?: boolean } = {}
): Promise<OrphanCleanupResult> => {
  const dryRun = options.dryRun ?? false;
  const dir = await ensureImageDir();

  const referenced = new Set(
    referencedUris.filter((uri): uri is string => Boolean(uri) && isAppOwned(uri as string))
  );

  let names: string[] = [];
  try {
    names = await FileSystem.readDirectoryAsync(dir);
  } catch {
    return { orphans: [], dryRun, removed: 0 };
  }

  const orphans: string[] = [];
  for (const name of names) {
    const fullUri = `${dir}${name}`;
    if (!referenced.has(fullUri)) {
      orphans.push(fullUri);
    }
  }

  if (dryRun) {
    return { orphans, dryRun, removed: 0 };
  }

  let removed = 0;
  for (const uri of orphans) {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      removed += 1;
    } catch (error) {
      console.error('Failed to delete orphan image', uri, error);
    }
  }

  return { orphans, dryRun, removed };
};
