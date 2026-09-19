import React, { forwardRef, useContext, useImperativeHandle, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
  type RefreshControlProps,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  HeaderHeightContext,
  HeaderShownContext,
} from "@react-navigation/elements";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import {
  KeyboardAwareScrollView,
  KeyboardAvoidingView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import type { Theme } from "../../contexts/ThemeContext";

/**
 * Widest the content column ever gets. Phones are narrower than this so nothing
 * changes there; on a tablet, an unfolded foldable or a landscape window the
 * column centres instead of stretching a billing form across 1000 px.
 */
export const CONTENT_MAX_WIDTH = 640;

const styles = StyleSheet.create({
  column: { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
  filledColumn: { flex: 1, width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" },
});

export interface AppScreenHandle {
  scrollToTop: () => void;
}
interface Props {
  theme: Theme;
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  keyboardAware?: boolean;
  footer?: React.ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}
const AppScreen = forwardRef<AppScreenHandle, Props>(function AppScreen(
  {
    theme,
    children,
    scroll = true,
    style,
    contentStyle,
    keyboardAware = true,
    footer,
    refreshControl,
  },
  ref,
) {
  const scroller = useRef<ScrollView | null>(null);
  useImperativeHandle(ref, () => ({
    scrollToTop: () => scroller.current?.scrollTo({ y: 0, animated: true }),
  }));
  const insets = useSafeAreaInsets();
  const headerShown = useContext(HeaderShownContext);
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const tabHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const [footerHeight, setFooterHeight] = useState(88);
  const bottom = tabHeight ? 0 : insets.bottom;
  const padding = {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: footer ? footerHeight + 16 : bottom + 20,
  };
  const body = scroll ? (
    <>
      {keyboardAware ? (
        <KeyboardAwareScrollView
          ref={scroller as never}
          bottomOffset={footer ? footerHeight + 12 : 20}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          style={style}
          contentContainerStyle={[padding, contentStyle]}
        >
          <View style={styles.column}>{children}</View>
        </KeyboardAwareScrollView>
      ) : (
        <ScrollView
          ref={scroller}
          refreshControl={refreshControl}
          style={style}
          contentContainerStyle={[padding, contentStyle]}
        >
          <View style={styles.column}>{children}</View>
        </ScrollView>
      )}
      {footer && (
        <KeyboardStickyView
          style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
          offset={{ opened: bottom }}
        >
          <View
            onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
            style={{ paddingBottom: bottom, backgroundColor: theme.chrome }}
          >
            <View style={styles.column}>{footer}</View>
          </View>
        </KeyboardStickyView>
      )}
    </>
  ) : (
    <KeyboardAvoidingView
      enabled={keyboardAware}
      behavior="padding"
      keyboardVerticalOffset={headerShown ? headerHeight : insets.top}
      style={{ flex: 1 }}
    >
      <View
        style={[
          { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
          contentStyle,
          style,
        ]}
      >
        <View style={styles.filledColumn}>{children}</View>
      </View>
      {footer && (
        <View style={{ paddingBottom: bottom, backgroundColor: theme.chrome }}>
          <View style={styles.column}>{footer}</View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background }}
      edges={headerShown ? ["left", "right"] : ["top", "left", "right"]}
    >
      {body}
    </SafeAreaView>
  );
});

export default AppScreen;
