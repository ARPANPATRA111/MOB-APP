import React from 'react';
import {
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  RefreshControlProps,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderShownContext } from '@react-navigation/elements';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { Theme } from '../../contexts/ThemeContext';

interface Props {
  theme: Theme;
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  keyboardAware?: boolean;
  footer?: React.ReactNode;
  /** Pull-to-refresh control. Only applies when `scroll` is true. */
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

/** Fallback reserved space before the footer has reported its real height. */
const FOOTER_ESTIMATE = 88;

const AppScreen: React.FC<Props> = ({
  theme,
  children,
  scroll = true,
  style,
  contentStyle,
  keyboardAware = false,
  footer,
  refreshControl,
}) => {
  const insets = useSafeAreaInsets();
  // The stack navigator does NOT zero out the top inset for screen content, so
  // applying the `top` safe-area edge under a navigation header double-pads the
  // screen and pushes everything down by a status-bar height. Only claim the
  // top edge on headerless screens (Dashboard), where we own the whole canvas.
  const headerShown = React.useContext(HeaderShownContext);
  // Non-zero only on screens hosted inside the tab navigator. The tab bar draws
  // over the bottom of the screen and already absorbs the bottom safe area, so
  // both the content and any floating footer have to sit above it.
  const tabBarHeight = React.useContext(BottomTabBarHeightContext) ?? 0;
  const [footerHeight, setFooterHeight] = React.useState(FOOTER_ESTIMATE);

  const onFooterLayout = React.useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setFooterHeight((current) => (Math.abs(current - height) > 1 ? height : current));
  }, []);

  // The footer floats over the content, so the body has to reserve exactly its
  // measured height (which already includes the bottom safe area). Non-scroll
  // screens host their own FlatList, which supplies its own trailing space.
  const restingBottom = tabBarHeight || Math.max(insets.bottom, 16);
  const scrollBottomPadding = footer ? footerHeight + tabBarHeight + 12 : restingBottom + 16;
  const staticBottomPadding = footer ? footerHeight + tabBarHeight : tabBarHeight;

  const content = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
      contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }, contentStyle]}
      style={style}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.nonScrollContent, { paddingBottom: staticBottomPadding }, contentStyle]}>
      {children}
    </View>
  );

  const body = (
    <>
      {content}
      {footer ? (
        <View style={[styles.footer, { bottom: tabBarHeight }]} onLayout={onFooterLayout}>
          {footer}
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.background }]}
      edges={headerShown ? ['left', 'right'] : ['top', 'left', 'right']}
    >
      {keyboardAware ? (
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          {body}
        </KeyboardAvoidingView>
      ) : body}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  // Same gutter as the scrolling variant — list screens were previously flush
  // against the display edges while card screens were inset by 16.
  nonScrollContent: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});

export default AppScreen;
