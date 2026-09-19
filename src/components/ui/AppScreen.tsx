import React, { forwardRef, useContext, useImperativeHandle, useRef, useState } from "react";
import {
  ScrollView,
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
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <ScrollView
          ref={scroller}
          refreshControl={refreshControl}
          style={style}
          contentContainerStyle={[padding, contentStyle]}
        >
          {children}
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
            {footer}
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
        {children}
      </View>
      {footer && (
        <View style={{ paddingBottom: bottom, backgroundColor: theme.chrome }}>
          {footer}
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
