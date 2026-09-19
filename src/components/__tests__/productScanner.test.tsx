import React from "react";
import { act, create } from "react-test-renderer";
import { CameraView } from "expo-camera";
import ProductScanner from "../ProductScanner";

/**
 * Drives the scanner's state machine with synthetic barcode frames, the way
 * expo-camera delivers them, and checks the guarantees the cashier relies on:
 * one accept per presentation, no reads after the camera is frozen, and
 * continuous mode pausing while feedback is shown.
 */

let mockCameraProps: any = null;
jest.mock("expo-camera", () => ({
  CameraView: (props: any) => {
    mockCameraProps = props;
    return null;
  },
  useCameraPermissions: () => [{ granted: true }, jest.fn(async () => ({ granted: true }))],
}));
jest.mock("expo-audio", () => ({
  useAudioPlayer: () => ({ seekTo: jest.fn(async () => {}), play: jest.fn() }),
}));
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../repositories/settingsRepository", () => ({
  getSetting: jest.fn(async () => false),
  setSetting: jest.fn(async () => {}),
}));
jest.mock("../../contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: { primary: "#00f", text: "#000", textSecondary: "#666", background: "#fff", cardBackground: "#fff", inputBackground: "#eee", divider: "#ddd", disabled: "#ccc", onPrimary: "#fff", primarySoft: "#eef", dangerStrong: "#c00", dangerSoft: "#fee", danger: "#c00", success: "#0a0", mode: "light" },
  }),
}));
jest.mock("../../contexts/TypographyContext", () => {
  const RN = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return { AppText: (p: any) => ReactActual.createElement(RN.Text, p), useTypography: () => ({ scale: 1 }) };
});


const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const render = async (element: React.ReactElement) => {
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(element);
  });
  return tree;
};

const findButton = (tree: ReturnType<typeof create>, label: string) =>
  tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === "function")[0];

const openScanner = async (tree: ReturnType<typeof create>, label: string) => {
  await act(async () => {
    findButton(tree, label).props.onPress();
  });
  await flush();
  await flush();
  expect(mockCameraProps).not.toBeNull();
};

const frame = (code: string) => {
  act(() => {
    mockCameraProps?.onBarcodeScanned?.({ data: code, type: "ean13" });
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  mockCameraProps = null;
});
afterEach(() => {
  jest.useRealTimers();
});

test("single mode accepts one read, freezes the camera and closes", async () => {
  const onScan = jest.fn(async () => {});
  const tree = await render(<ProductScanner label="Scan" onScan={onScan} />);
  await openScanner(tree, "Scan");
  for (let t = 0; t <= 1000; t += 200) {
    frame("8901234567890");
    act(() => {
      jest.advanceTimersByTime(200);
    });
  }
  await flush();
  // The camera is unmounted before the async accept resolves, and a frame that
  // still arrives through the old handler is ignored.
  expect(tree.root.findAllByType(CameraView as any)).toHaveLength(0);
  frame("8901234567890");
  act(() => {
    jest.advanceTimersByTime(1500);
  });
  await flush();
  expect(onScan).toHaveBeenCalledTimes(1);
});

test("continuous mode counts a product left under the camera once", async () => {
  const onScan = jest.fn(async () => ({ title: "Added" }));
  const tree = await render(<ProductScanner label="Scan" mode="continuous" onScan={onScan} />);
  await openScanner(tree, "Scan");
  // Product presented and held through the read delay.
  for (let t = 0; t <= 1000; t += 200) {
    frame("111");
    act(() => {
      jest.advanceTimersByTime(200);
    });
  }
  await flush();
  expect(onScan).toHaveBeenCalledTimes(1);
  // Still under the camera for three more seconds, frames every 250 ms.
  for (let t = 0; t < 3000; t += 250) {
    frame("111");
    act(() => {
      jest.advanceTimersByTime(250);
    });
  }
  await flush();
  expect(onScan).toHaveBeenCalledTimes(1);
  // Removed for a second, then presented again: a second unit.
  act(() => {
    jest.advanceTimersByTime(1200);
  });
  for (let t = 0; t <= 1000; t += 200) {
    frame("111");
    act(() => {
      jest.advanceTimersByTime(200);
    });
  }
  await flush();
  expect(onScan).toHaveBeenCalledTimes(2);
});

test("continuous mode pauses other products while feedback shows, then resumes", async () => {
  const onScan = jest.fn(async (code: string) => {
    if (code === "bad") throw new Error("No product with barcode bad");
    return { title: "Added" };
  });
  const tree = await render(<ProductScanner label="Scan" mode="continuous" onScan={onScan} />);
  await openScanner(tree, "Scan");
  for (let t = 0; t <= 1000; t += 200) {
    frame("bad");
    act(() => {
      jest.advanceTimersByTime(200);
    });
  }
  await flush();
  expect(onScan).toHaveBeenCalledTimes(1);
  // Error banner is up for 3 s: a different product is ignored meanwhile.
  frame("222");
  act(() => {
    jest.advanceTimersByTime(1100);
  });
  await flush();
  expect(onScan).toHaveBeenCalledTimes(1);
  act(() => {
    jest.advanceTimersByTime(2500);
  });
  for (let t = 0; t <= 1000; t += 200) {
    frame("222");
    act(() => {
      jest.advanceTimersByTime(200);
    });
  }
  await flush();
  expect(onScan).toHaveBeenCalledTimes(2);
  expect(onScan).toHaveBeenLastCalledWith("222");
});

test("a code that leaves the frame during the hold is not accepted", async () => {
  const onScan = jest.fn(async () => ({ title: "Added" }));
  const tree = await render(<ProductScanner label="Scan" mode="continuous" onScan={onScan} />);
  await openScanner(tree, "Scan");
  frame("333");
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  await flush();
  expect(onScan).not.toHaveBeenCalled();
});
