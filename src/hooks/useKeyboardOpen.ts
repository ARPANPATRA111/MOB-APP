import { useEffect, useState } from "react";
import { KeyboardController, KeyboardEvents } from "react-native-keyboard-controller";

/**
 * True from the moment the keyboard starts to open until it starts to close.
 * Uses the `will*` events so chrome that should get out of the way (tab bar,
 * bottom action bars) disappears with the keyboard animation instead of after it.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(() => KeyboardController.isVisible());
  useEffect(() => {
    // The did* events are a safety net for keyboards that skip the will* pair.
    const subscriptions = [
      KeyboardEvents.addListener("keyboardWillShow", () => setOpen(true)),
      KeyboardEvents.addListener("keyboardDidShow", () => setOpen(true)),
      KeyboardEvents.addListener("keyboardWillHide", () => setOpen(false)),
      KeyboardEvents.addListener("keyboardDidHide", () => setOpen(false)),
    ];
    return () => subscriptions.forEach((s) => s.remove());
  }, []);
  return open;
}
