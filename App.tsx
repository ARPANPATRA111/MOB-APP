// App.tsx

import React, { useEffect, useState } from 'react';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  type CompositeNavigationProp,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createStackNavigator, type StackNavigationProp } from '@react-navigation/stack';
import {
  createBottomTabNavigator,
  type BottomTabNavigationProp,
} from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, StatusBar, View } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { CurrencyProvider } from './src/contexts/CurrencyContext';
import { storageService } from './src/services/storage';
import { billingSession } from './src/services/billingSession';
import AppSplash from './src/components/ui/AppSplash';
import AppTabBar, { ACTION_TAB_NAME } from './src/components/ui/AppTabBar';
import { ToastProvider } from './src/components/ui/ToastProvider';
import { DialogProvider } from './src/components/ui/DialogProvider';
import ErrorBoundary from './ErrorBoundary';
import DashboardScreen from './screens/DashboardScreen';
import AddItemScreen from './screens/AddItemScreen';
import InventoryScreen from './screens/InventoryScreen';
import BillingScreen from './screens/BillingScreen';
import BillReviewScreen from './screens/BillReviewScreen';
import BillReceiptScreen from './screens/BillReceiptScreen';
import AboutScreen from './screens/AboutScreen';
import SettingsScreen from './screens/SettingsScreen';
import ReportsScreen from './screens/ReportsScreen';
import RecentActivityScreen from './screens/RecentActivityScreen';
import NotificationsScreen from './screens/NotificationsScreen';

/** The four daily destinations, plus the action-only slot for New Bill. */
export type MainTabParamList = {
  Dashboard: undefined;
  Inventory: undefined;
  NewBill: undefined;
  Reports: undefined;
  Settings: undefined;
};

/** Everything pushed *over* the tabs — task flows that own the whole screen. */
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  AddItem: undefined;
  Billing: undefined;
  BillReview: undefined;
  BillReceipt: { billId: string };
  About: undefined;
  RecentActivity: undefined;
  Notifications: undefined;
};

/**
 * Navigation prop for screens hosted inside the tabs. They reach both their tab
 * siblings (`navigate('Inventory')`) and the parent stack (`navigate('AddItem')`).
 */
export type AppNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  StackNavigationProp<RootStackParamList>
>;

const Stack = createStackNavigator<RootStackParamList, undefined>();
const Tab = createBottomTabNavigator<MainTabParamList, undefined>();

/** Placeholder for the action-only tab; the bar intercepts the press. */
const NullScreen = () => null;

const MainTabs = () => {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      id={undefined}
      initialRouteName="Dashboard"
      backBehavior="initialRoute"
      screenOptions={{
        headerStyle: {
          elevation: 0,
          shadowOpacity: 0,
          backgroundColor: theme.chrome,
        },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 18, color: theme.text },
        headerTitleAlign: 'left',
        headerRightContainerStyle: { paddingRight: 12 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.background },
      }}
      tabBar={(props) => (
        <AppTabBar
          {...props}
          theme={theme}
          onAction={() => {
            // Always start from a clean cart, from whichever tab is showing.
            billingSession.clear();
            props.navigation.navigate('Billing');
          }}
        />
      )}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Inventory' }} />
      <Tab.Screen name={ACTION_TAB_NAME} component={NullScreen} options={{ title: 'New Bill' }} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{ title: 'Reports' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { theme } = useTheme();
  const navigationTheme = {
    ...(theme.mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: theme.primary,
      background: theme.background,
      // `card` backs the navigation header. Pinning it to the same chrome token
      // as the tab bar keeps the top and bottom of every screen on one
      // continuous surface in both light and dark mode.
      card: theme.chrome,
      text: theme.text,
      border: theme.chromeBorder,
      notification: theme.primary,
    },
  };

  return (
    <>
      {/* Android runs edge-to-edge (see android/gradle.properties), so the bars
          are transparent and the app paints behind them — only the icon tint is
          ours to set here. */}
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor="transparent" translucent />
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator
          id={undefined}
          initialRouteName="MainTabs"
          screenOptions={{
            headerStyle: {
              elevation: 0,
              shadowOpacity: 0,
              backgroundColor: theme.chrome,
            },
            headerTintColor: theme.text,
            headerTitleStyle: {
              fontWeight: '800',
              fontSize: 18,
              color: theme.text,
            },
            headerTitleAlign: 'left',
            headerLeftContainerStyle: { paddingLeft: 4 },
            headerRightContainerStyle: { paddingRight: 12 },
            headerShadowVisible: false,
            cardStyle: { backgroundColor: theme.background },
          }}
        >
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="AddItem"
            component={AddItemScreen}
            options={{ title: 'Add Product' }}
          />
          <Stack.Screen
            name="Billing"
            component={BillingScreen}
            options={{ title: 'Bill Customer' }}
          />
          <Stack.Screen
            name="BillReview"
            component={BillReviewScreen}
            options={{ title: 'Review Bill' }}
          />
          <Stack.Screen
            name="BillReceipt"
            component={BillReceiptScreen}
            options={{ title: 'Receipt' }}
          />
          <Stack.Screen
            name="About"
            component={AboutScreen}
            options={{ title: 'About' }}
          />
          <Stack.Screen
            name="RecentActivity"
            component={RecentActivityScreen}
            options={{ title: 'Recent Orders' }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ title: 'Alerts' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
};

const AppShell = () => {
  const { theme, isReady } = useTheme();
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Run migrations + legacy migration once at startup so the themed splash
    // only hands off to the app after the data layer is ready. On failure we
    // still release the splash; screens/ErrorBoundary handle the error state.
    storageService
      .ensureDataLayerReady()
      .catch((error) => console.error('Data layer init failed at startup:', error))
      .finally(() => {
        if (mounted) {
          setDataReady(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Paint the native root view with the theme colour too. Without this the
    // window behind the React tree stays the OS default, which flashes white on
    // a dark theme during rotation, keyboard resize and screen transitions.
    SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});

    // Android runs edge-to-edge, so the navigation bar is transparent and the
    // app's own chrome shows through it. The button/pill tint still has to be
    // flipped to follow the *app's* theme — the DayNight resource qualifiers in
    // styles.xml only track the device theme, which is wrong whenever the user
    // has overridden the theme in Settings.
    if (Platform.OS === 'android') {
      NavigationBar.setStyle(theme.mode === 'dark' ? 'light' : 'dark');
    }
  }, [theme.background, theme.mode]);

  const ready = isReady && dataReady;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <AppNavigator />
      <AppSplash theme={theme} visible={!ready} />
    </View>
  );
};

const App = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <CurrencyProvider>
              <ToastProvider>
                <DialogProvider>
                  <AppShell />
                </DialogProvider>
              </ToastProvider>
            </CurrencyProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
