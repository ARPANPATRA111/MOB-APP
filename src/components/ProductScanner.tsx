import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useAudioPlayer } from "expo-audio";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { AppText } from "../contexts/TypographyContext";
import { getSetting, setSetting } from "../repositories/settingsRepository";
import AppButton from "./ui/AppButton";
import { Notice } from "./ui/CommerceUI";

/** Hold time before a code is accepted; long enough to avoid misreads, short enough to feel instant. */
const READ_DELAY_MS = 1000;
/** How long the "Added …" chip stays up; scanning pauses meanwhile. */
const FEEDBACK_MS = 1400;
/** Unknown-code banner duration. */
const ERROR_MS = 3000;
/** A code seen again within this gap is the same physical presentation, not a new item. */
const PRESENCE_GAP_MS = 900;

/** Retail 1D symbologies only; QR and other 2D codes are deliberately ignored. */
const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "itf14"] as const;

export interface ScanFeedback {
  title: string;
  subtitle?: string;
}

/** Torch preference survives across scanner sessions (and app restarts). */
let torchPreference: boolean | null = null;
const loadTorch = async () => {
  if (torchPreference === null)
    torchPreference = Boolean(await getSetting("scannerTorch", false).catch(() => false));
  return torchPreference;
};
const saveTorch = (on: boolean) => {
  torchPreference = on;
  void setSetting("scannerTorch", on).catch(() => {});
};

/**
 * One-shot or continuous barcode scanner.
 *
 * - `single` (default): the first accepted code is handed to `onScan`, then the camera closes.
 * - `continuous`: stays open for a whole basket. Each accepted code shows a short
 *   "Added" chip while scanning pauses; the same code is not re-added while it is
 *   still in frame, so a product left under the camera counts once.
 *
 * The camera view is unmounted *before* any async work or close animation, which
 * is what prevents the duplicate reads the modal's exit animation used to allow.
 */
export default function ProductScanner({
  onScan,
  label = "Scan barcode",
  compact = false,
  variant = "secondary",
  mode = "single",
  summary,
  icon = "barcode-outline",
  style,
}: {
  onScan: (code: string) => Promise<ScanFeedback | void> | ScanFeedback | void;
  label?: string;
  compact?: boolean;
  variant?: "primary" | "secondary";
  mode?: "single" | "continuous";
  /** Live line under the title in continuous mode, e.g. "3 items · ₹672". */
  summary?: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  style?: React.ComponentProps<typeof AppButton>["style"];
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  // The viewfinder is sized from the live window, so a short landscape or
  // freeform window still fits the frame between the two control rows.
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const frameHeight = Math.round(Math.min(200, windowHeight * 0.38));
  const frameWidth = Math.round(Math.min(280, windowWidth * 0.8));
  const [permission, requestPermission] = useCameraPermissions();
  const focused = useIsFocused();
  const [open, setOpen] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; title: string; subtitle?: string } | null>(null);
  const [error, setError] = useState("");
  const [torch, setTorch] = useState(false);
  const [count, setCount] = useState(0);
  const session = useRef(0);
  const armed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presence = useRef<{ code: string; lastSeen: number } | null>(null);
  const pending = useRef<{ code: string; lastSeen: number } | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const player = useAudioPlayer(require("../../assets/BEEP_SOUND.mp3"));

  const clearTimers = () => {
    if (timer.current) clearTimeout(timer.current);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    timer.current = null;
    feedbackTimer.current = null;
  };
  const disarm = useCallback(() => {
    session.current++;
    armed.current = false;
    clearTimers();
    progress.stopAnimation();
    progress.setValue(0);
  }, [progress]);
  const close = useCallback(() => {
    disarm();
    setCameraOn(false);
    setReading(null);
    setFeedback(null);
    setOpen(false);
  }, [disarm]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") close();
    });
    return () => {
      sub.remove();
      disarm();
    };
  }, [close, disarm]);
  useEffect(() => {
    if (!focused) close();
  }, [focused, close]);

  const beep = () =>
    void player
      .seekTo(0)
      .then(() => player.play())
      .catch(() => {});

  const showFeedback = (next: NonNullable<typeof feedback>, ms: number, then: () => void) => {
    setFeedback(next);
    feedbackTimer.current = setTimeout(() => {
      setFeedback(null);
      then();
    }, ms);
  };

  const accept = async (code: string, token: number) => {
    // Freeze the camera first: no more reads can arrive while we work or animate out.
    if (mode === "single") setCameraOn(false);
    try {
      const result = (await onScan(code)) as ScanFeedback | undefined;
      if (token !== session.current) return;
      beep();
      if (mode === "single") {
        close();
        return;
      }
      setCount((n) => n + 1);
      presence.current = { code, lastSeen: Date.now() };
      showFeedback(
        { kind: "ok", title: result?.title ?? "Added", subtitle: result?.subtitle },
        FEEDBACK_MS,
        () => {
          armed.current = true;
        },
      );
    } catch (e) {
      if (token !== session.current) return;
      const message = (e as Error).message || "Unknown barcode";
      if (mode === "single") {
        setError(message);
        setCameraOn(true);
        armed.current = true;
        return;
      }
      presence.current = { code, lastSeen: Date.now() };
      showFeedback({ kind: "error", title: "Unknown item", subtitle: message }, ERROR_MS, () => {
        armed.current = true;
      });
    }
  };

  const onBarcode = (code: string) => {
    if (!open || !cameraOn || !code) return;
    const now = Date.now();
    // Same code still under the camera since the last accept: refresh and ignore.
    if (presence.current?.code === code && now - presence.current.lastSeen < PRESENCE_GAP_MS) {
      presence.current.lastSeen = now;
      return;
    }
    // A code being held for the read: keep note of when it was last visible.
    if (pending.current?.code === code) {
      pending.current.lastSeen = now;
      return;
    }
    if (!armed.current) return;
    armed.current = false;
    presence.current = null;
    pending.current = { code, lastSeen: now };
    setReading(code);
    setError("");
    progress.setValue(0);
    const token = ++session.current;
    Animated.timing(progress, { toValue: 1, duration: READ_DELAY_MS - 100, useNativeDriver: false }).start();
    timer.current = setTimeout(() => {
      if (token !== session.current) return;
      const seen = pending.current?.lastSeen ?? 0;
      pending.current = null;
      setReading(null);
      progress.setValue(0);
      // The code left the frame during the hold: treat it as a glance, not a scan.
      if (Date.now() - seen > 600) {
        armed.current = true;
        return;
      }
      void accept(code, token);
    }, READ_DELAY_MS);
  };

  const openScanner = () => {
    void (async () => {
      try {
        TextInput.State.currentlyFocusedInput()?.blur();
        Keyboard.dismiss();
        setError("");
        if (!permission?.granted && !(await requestPermission()).granted) {
          setError("Camera access is needed to scan. You can type the code instead.");
          return;
        }
        setTorch(await loadTorch());
        setCount(0);
        setFeedback(null);
        setReading(null);
        presence.current = null;
        pending.current = null;
        session.current++;
        armed.current = true;
        setCameraOn(true);
        setOpen(true);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  };

  const toggleTorch = () => {
    const next = !torch;
    setTorch(next);
    saveTorch(next);
  };

  return (
    <>
      {!open && !compact && <Notice message={error} error />}
      <AppButton
        theme={theme}
        label={label}
        icon={icon}
        variant={variant}
        compact={compact}
        onPress={openScanner}
        style={style}
      />
      <Modal visible={open} animationType="slide" statusBarTranslucent onRequestClose={close}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {open && cameraOn && permission?.granted && focused && (
            <CameraView
              style={StyleSheet.absoluteFill}
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
              onBarcodeScanned={(result) => onBarcode(result.data)}
            />
          )}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View style={styles.dim} />
            <View style={{ flexDirection: "row", height: frameHeight }}>
              <View style={[styles.dim, { flex: 1 }]} />
              <View style={{ width: frameWidth, height: frameHeight }}>
                {(["tl", "tr", "bl", "br"] as const).map((corner) => (
                  <View
                    key={corner}
                    style={[
                      styles.corner,
                      corner.includes("t") ? { top: -2, borderTopWidth: 3 } : { bottom: -2, borderBottomWidth: 3 },
                      corner.includes("l") ? { left: -2, borderLeftWidth: 3 } : { right: -2, borderRightWidth: 3 },
                      corner === "tl" && { borderTopLeftRadius: 14 },
                      corner === "tr" && { borderTopRightRadius: 14 },
                      corner === "bl" && { borderBottomLeftRadius: 14 },
                      corner === "br" && { borderBottomRightRadius: 14 },
                      { borderColor: reading ? theme.primary : feedback?.kind === "ok" ? "#30d158" : "#fff" },
                    ]}
                  />
                ))}
              </View>
              <View style={[styles.dim, { flex: 1 }]} />
            </View>
            <View style={[styles.dim, { flex: 1 }]} />
          </View>

          {/* Top bar: close, title/summary, torch */}
          <View
            style={{
              position: "absolute",
              top: insets.top + 8,
              left: 12,
              right: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Pressable accessibilityRole="button" accessibilityLabel="Close scanner" onPress={close} style={styles.roundButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
            <View style={{ flex: 1, alignItems: "center" }}>
              <AppText style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
                {mode === "continuous" ? "Scan products" : "Scan barcode"}
              </AppText>
              {mode === "continuous" && !!summary && (
                <AppText style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>{summary}</AppText>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={torch ? "Turn torch off" : "Turn torch on"}
              accessibilityState={{ selected: torch }}
              onPress={toggleTorch}
              style={[styles.roundButton, torch && { backgroundColor: "#fff" }]}
            >
              <Ionicons name={torch ? "flash" : "flash-outline"} size={22} color={torch ? "#000" : "#fff"} />
            </Pressable>
          </View>

          {/* Feedback chip just under the viewfinder */}
          {feedback && (
            <View pointerEvents="none" style={{ position: "absolute", left: 24, right: 24, top: "50%", marginTop: frameHeight / 2 + 12, alignItems: "center" }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 14,
                  maxWidth: "100%",
                  backgroundColor: feedback.kind === "ok" ? "rgba(48,209,88,0.96)" : "rgba(255,69,58,0.96)",
                }}
              >
                <Ionicons name={feedback.kind === "ok" ? "checkmark-circle" : "alert-circle"} size={22} color="#fff" />
                <View style={{ flexShrink: 1 }}>
                  <AppText numberOfLines={1} style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                    {feedback.title}
                  </AppText>
                  {!!feedback.subtitle && (
                    <AppText numberOfLines={2} style={{ color: "rgba(255,255,255,0.9)", fontSize: 12 }}>
                      {feedback.subtitle}
                    </AppText>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Bottom: reading progress / hint / Done */}
          <View style={{ position: "absolute", left: 20, right: 20, bottom: insets.bottom + 20, alignItems: "center", gap: 14 }}>
            {reading ? (
              <>
                <AppText style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>Reading {reading}</AppText>
                <View style={{ height: 5, width: "100%", backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 3 }}>
                  <Animated.View
                    style={{
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: theme.primary,
                      width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                    }}
                  />
                </View>
              </>
            ) : error && mode === "single" ? (
              <View style={{ backgroundColor: "rgba(255,69,58,0.95)", borderRadius: 12, padding: 12, alignSelf: "stretch" }}>
                <AppText style={{ color: "#fff", fontSize: 14, textAlign: "center" }}>{error}</AppText>
              </View>
            ) : (
              <AppText style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, textAlign: "center" }}>
                {mode === "continuous"
                  ? "Hold each product under the camera. Move it away before the next one."
                  : "Point the camera at the barcode. It reads once, then closes."}
              </AppText>
            )}
            {mode === "continuous" && (
              <AppButton
                theme={theme}
                label={count ? `Done · ${count} scanned` : "Done"}
                icon="checkmark"
                onPress={close}
                style={{ alignSelf: "stretch", minHeight: 52 }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: "rgba(0,0,0,0.5)", flex: 1 },
  corner: { position: "absolute", width: 30, height: 30 },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
});
