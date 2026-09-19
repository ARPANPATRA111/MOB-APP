import { requireOptionalNativeModule } from 'expo-modules-core';
interface RetailNative {
  packBackup(directory: string, destination: string, password: string): Promise<string>;
  unpackBackup(source: string, destination: string, password: string): Promise<string>;
  sha256(uri: string): Promise<string>;
  renderReceipt(text: string, width: number): Promise<string>;
  setStatusBarAppearance(lightBar: boolean): Promise<void>;
  pairedPrinters(): Promise<{ name: string; address: string }[]>;
  printReceipt(
    transport: string,
    address: string,
    port: number,
    imageUri: string
  ): Promise<boolean>;
}
export const retailNative = (): RetailNative => {
  const module = requireOptionalNativeModule<RetailNative>('RetailTools');
  if (!module)
    throw new Error(
      'Install the MOPX Android build to use backups and thermal printers. Expo Go does not include these features.'
    );
  return module;
};

/**
 * Status bar icon tint, without React Native's StatusBar module and the
 * Window.statusBarColor calls Android 15 deprecated. Best effort: on a build
 * without the native module the bars keep the theme's XML tint rather than
 * taking a render down with them.
 */
export const setStatusBarAppearance = (lightBar: boolean) => {
  const module = requireOptionalNativeModule<RetailNative>('RetailTools');
  void module?.setStatusBarAppearance(lightBar).catch(() => {});
};
