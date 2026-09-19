import { useFonts } from "expo-font";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import * as SplashScreen from "expo-splash-screen";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { TypographyProvider } from "./src/contexts/TypographyContext";
import ProductPickerScreen from "./screens/ProductPickerScreen";
import BusinessDetailsScreen from "./screens/BusinessDetailsScreen";
import SetupScreen from "./screens/SetupScreen";
import { getBusinessProfile } from "./src/repositories/settingsRepository";
import { getDatabase } from "./src/db/database";
import { checkForUpdates } from "./src/services/updateCheck";
import React, { useCallback, useEffect, useState } from "react";
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  useNavigationContainerRef,
  type CompositeNavigationProp,
  type NavigatorScreenParams,
} from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from "@react-navigation/native-stack";
import {
  createBottomTabNavigator,
  type BottomTabNavigationProp,
} from "@react-navigation/bottom-tabs";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform, StatusBar, View } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import { CurrencyProvider } from "./src/contexts/CurrencyContext";
import { storageService } from "./src/services/storage";
import AppTabBar from "./src/components/ui/AppTabBar";
import StackHeader from "./src/components/ui/StackHeader";
import TabHeader from "./src/components/ui/TabHeader";
import AppButton from "./src/components/ui/AppButton";
import { Copy, Notice, Panel } from "./src/components/ui/CommerceUI";
import { ToastProvider } from "./src/components/ui/ToastProvider";
import { DialogProvider } from "./src/components/ui/DialogProvider";
import { useReducedMotion } from "./src/components/ui/Skeleton";
import ExitHint from "./src/components/ui/ExitHint";
import ErrorBoundary from "./ErrorBoundary";
import DashboardScreen from "./screens/DashboardScreen";
import AddItemScreen from "./screens/AddItemScreen";
import InventoryScreen from "./screens/InventoryScreen";
import BillingScreen from "./screens/BillingScreen";
import BillReviewScreen from "./screens/BillReviewScreen";
import BillReceiptScreen from "./screens/BillReceiptScreen";
import AboutScreen from "./screens/AboutScreen";
import SettingsScreen from "./screens/SettingsScreen";
import ReportsScreen from "./screens/ReportsScreen";
import RecentActivityScreen from "./screens/RecentActivityScreen";
import NotificationsScreen from "./screens/NotificationsScreen";
import ManagementScreen from "./screens/ManagementScreen";
import ParkedBillsScreen from "./screens/ParkedBillsScreen";
import PurchasesScreen from "./screens/PurchasesScreen";
import SuppliersScreen from "./screens/SuppliersScreen";
import CreditScreen from "./screens/CreditScreen";
import StockHistoryScreen from "./screens/StockHistoryScreen";
import ImportScreen from "./screens/ImportScreen";
import BackupScreen from "./screens/BackupScreen";
import PrinterScreen from "./screens/PrinterScreen";
/**
 * The native splash (a disc icon that fits Android's safe circle and reads on
 * light and dark) is held on screen until fonts, theme and the database are
 * ready and at least SPLASH_MIN_MS have passed since JS started, then fades.
 * Keeping the native view instead of re-drawing it in JS avoids the size and
 * position jump different Android skins would otherwise show. Resuming from
 * background never shows it.
 */
void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 350, fade: true });
const SPLASH_MIN_MS = 2000;
const launchedAt = Date.now();

export type MainTabParamList = {
  Dashboard: undefined;
  Inventory: undefined;
  NewBill: undefined;
  Reports: undefined;
  Settings: undefined;
};
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  AddItem: { productId?: string } | undefined;
  Billing: undefined;
  BillReview: undefined;
  BillReceipt: { billId: string };
  About: undefined;
  RecentActivity:
    { start?: number; end?: number; productId?: string } | undefined;
  Notifications: undefined;
  Management: undefined;
  BusinessDetails: undefined;
  ProductPicker: undefined;
  ParkedBills: undefined;
  Purchases: undefined;
  Suppliers: undefined;
  Credit: { billId?: string } | undefined;
  StockHistory: undefined;
  Import: undefined;
  Backup: undefined;
  Printer: undefined;
};
export type AppNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const NullScreen = () => null;
function MainTabs() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      id={undefined}
      backBehavior="initialRoute"
      screenOptions={{
        header: (props) => <TabHeader {...props} />,
        sceneStyle: { backgroundColor: theme.background },
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => (
        <AppTabBar
          {...props}
          theme={theme}
          onAction={() => props.navigation.navigate("Billing")}
        />
      )}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{ title: "Stock" }}
      />
      <Tab.Screen name="NewBill" component={NullScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
function AppNavigator() {
  const { theme } = useTheme();
  const reduced = useReducedMotion();
  const navigationRef = useNavigationContainerRef();
  const base = theme.mode === "dark" ? DarkTheme : DefaultTheme;
  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        ...base,
        colors: {
          ...base.colors,
          primary: theme.primary,
          background: theme.background,
          card: theme.chrome,
          text: theme.text,
          border: theme.chromeBorder,
          notification: theme.primary,
        },
      }}
    >
      <Stack.Navigator
        id={undefined}
        screenOptions={{
          headerStyle: { backgroundColor: theme.chrome },
          headerTintColor: theme.text,
          headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
          animation: reduced ? "none" : "slide_from_right",
          header: (props) => <StackHeader {...props} />,
          statusBarStyle: theme.mode === "light" ? "dark" : "light",
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddItem"
          component={AddItemScreen}
          options={({ route }) => ({
            title: route.params?.productId ? "Edit product" : "Add product",
          })}
        />
        <Stack.Screen
          name="Billing"
          component={BillingScreen}
          options={{ title: "New bill" }}
        />
        <Stack.Screen
          name="BillReview"
          component={BillReviewScreen}
          options={{ title: "Review & payment" }}
        />
        <Stack.Screen
          name="BillReceipt"
          component={BillReceiptScreen}
          options={{ title: "Receipt" }}
        />
        <Stack.Screen
          name="Management"
          component={ManagementScreen}
          options={{ title: "Management" }}
        />
        <Stack.Screen
          name="ParkedBills"
          component={ParkedBillsScreen}
          options={{ title: "Parked bills" }}
        />
        <Stack.Screen
          name="Purchases"
          component={PurchasesScreen}
          options={{ title: "Purchases" }}
        />
        <Stack.Screen name="Suppliers" component={SuppliersScreen} />
        <Stack.Screen
          name="Credit"
          component={CreditScreen}
          options={{ title: "Customer credit" }}
        />
        <Stack.Screen
          name="StockHistory"
          component={StockHistoryScreen}
          options={{ title: "Stock history" }}
        />
        <Stack.Screen
          name="Import"
          component={ImportScreen}
          options={{ title: "Import products" }}
        />
        <Stack.Screen
          name="Backup"
          component={BackupScreen}
          options={{ title: "Backup & restore" }}
        />
        <Stack.Screen
          name="Printer"
          component={PrinterScreen}
          options={{ title: "Receipt printer" }}
        />
        <Stack.Screen
          name="RecentActivity"
          component={RecentActivityScreen}
          options={{ title: "Receipts" }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: "Stock alerts" }}
        />
        <Stack.Screen
          name="ProductPicker"
          component={ProductPickerScreen}
          options={{ title: "Add to cart", presentation: "modal" }}
        />
        <Stack.Screen
          name="BusinessDetails"
          component={BusinessDetailsScreen}
          options={{ title: "Business details" }}
        />
        <Stack.Screen
          name="About"
          component={AboutScreen}
          options={{ title: "About MOPX" }}
        />
      </Stack.Navigator>
      <ExitHint navigationRef={navigationRef} />
    </NavigationContainer>
  );
}
function AppShell() {
  const { theme, isReady } = useTheme();
  const [dataReady, setDataReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const [splashHeld, setSplashHeld] = useState(true);
  useEffect(() => {
    const t = setTimeout(
      () => setSplashHeld(false),
      Math.max(0, SPLASH_MIN_MS - (Date.now() - launchedAt)),
    );
    return () => clearTimeout(t);
  }, []);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const appReady = isReady && dataReady && (fontsLoaded || fontError);
  useEffect(() => {
    if ((appReady && !splashHeld) || error)
      void SplashScreen.hideAsync().catch(() => {});
  }, [appReady, splashHeld, error]);

  const retry = useCallback(() => {
    setError("");
    setAttempt((n) => n + 1);
  }, []);
  useEffect(() => {
    let mounted = true;
    storageService
      .ensureDataLayerReady()
      .then(async () => {
        const profile = await getBusinessProfile();
        const db = await getDatabase();
        const history = await db.getFirstAsync<{ n: number }>(
          "SELECT COUNT(*) AS n FROM sales",
        );
        if (mounted) {
          setNeedsSetup(!profile?.businessName?.trim() && !history?.n);
          setDataReady(true);
          // Quiet daily update check, well after first paint.
          setTimeout(() => void checkForUpdates().catch(() => {}), 8000);
        }
      })
      .catch((e) => {
        if (mounted)
          setError(e instanceof Error ? e.message : "Could not open shop data");
      });
    return () => {
      mounted = false;
    };
  }, [attempt]);
  useEffect(() => {
    // Edge-to-edge: the app paints behind both system bars and only the icon
    // tint follows the theme. RN adds its own scrims on Android < 10, so old
    // devices keep legible buttons without any per-device code here.
    void SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});
    if (Platform.OS === "android")
      NavigationBar.setStyle(theme.mode === "dark" ? "dark" : "light");
  }, [theme.background, theme.mode]);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={theme.mode === "light" ? "dark-content" : "light-content"}
      />
      {error ? (
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <Panel>
            <Copy large>Could not open your shop</Copy>
            <Notice message={error} error />
            <Copy muted>
              Your stored records have not been removed. Retry to reopen the
              database.
            </Copy>
            <AppButton theme={theme} label="Try again" onPress={retry} />
          </Panel>
        </View>
      ) : appReady ? (
        needsSetup ? (
          <SetupScreen onComplete={() => setNeedsSetup(false)} />
        ) : (
          <AppNavigator />
        )
      ) : null}
    </View>
  );
}
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ThemeProvider>
            <TypographyProvider>
              <ErrorBoundary>
                <CurrencyProvider>
                  <ToastProvider>
                    <DialogProvider>
                      <AppShell />
                    </DialogProvider>
                  </ToastProvider>
                </CurrencyProvider>
              </ErrorBoundary>
            </TypographyProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
