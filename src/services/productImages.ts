import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { createLocalId } from "../db/schema";
import { ensureImageDir } from "./imageStorage";

/**
 * Product photos are stored twice: a compressed main image for the editor and
 * previews, and a tiny thumbnail for lists. Lists used to decode the full
 * camera-sized file for every 44 px avatar, which is what made scrolling and
 * saving stutter after a handful of photographed products.
 */
export const MAIN_MAX_PX = 640;
export const THUMB_PX = 144;
const MAIN_QUALITY = 0.7;
const THUMB_QUALITY = 0.72;
export const THUMB_SUFFIX = ".thumb.jpg";

/** Thumbnail path for a stored product photo (may not exist for older photos). */
export const thumbUriFor = (uri: string): string =>
  uri.endsWith(".jpg") ? uri.slice(0, -4) + THUMB_SUFFIX : uri + THUMB_SUFFIX;

export const isThumbUri = (uri: string): boolean => uri.endsWith(THUMB_SUFFIX);

const resizeTo = async (uri: string, width: number, height: number, max: number, quality: number) => {
  const longest = Math.max(width || max, height || max);
  const scale = longest > max ? max / longest : 1;
  const target =
    (width || 0) >= (height || 0)
      ? { width: Math.round((width || max) * scale) }
      : { height: Math.round((height || max) * scale) };
  return ImageManipulator.manipulateAsync(uri, [{ resize: target }], {
    compress: quality,
    format: ImageManipulator.SaveFormat.JPEG,
  });
};

/**
 * Compresses a picked/captured image into the app's image directory and writes
 * its thumbnail next to it. Returns the main image URI to store on the product.
 * Typical output: 40–90 KB main, 5–8 KB thumbnail.
 */
export const storeProductPhoto = async (
  sourceUri: string,
  width?: number,
  height?: number,
): Promise<string> => {
  const directory = await ensureImageDir();
  const id = createLocalId("product");
  const mainUri = directory + id + ".jpg";
  const main = await resizeTo(sourceUri, width ?? 0, height ?? 0, MAIN_MAX_PX, MAIN_QUALITY);
  await FileSystem.moveAsync({ from: main.uri, to: mainUri }).catch(async () => {
    await FileSystem.copyAsync({ from: main.uri, to: mainUri });
  });
  // Thumbnail from the already-shrunk main image: cheap and avoids a second full decode.
  const thumb = await resizeTo(mainUri, main.width, main.height, THUMB_PX, THUMB_QUALITY);
  await FileSystem.moveAsync({ from: thumb.uri, to: thumbUriFor(mainUri) }).catch(async () => {
    await FileSystem.copyAsync({ from: thumb.uri, to: thumbUriFor(mainUri) });
  });
  return mainUri;
};

/** Removes a stored photo and its thumbnail; ignores files that are already gone. */
export const removeProductPhoto = async (uri: string | null | undefined) => {
  if (!uri) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  await FileSystem.deleteAsync(thumbUriFor(uri), { idempotent: true }).catch(() => {});
};
