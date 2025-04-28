// App.tsx

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { ThemeProvider } from './src/contexts/ThemeContext';
import ErrorBoundary from './ErrorBoundary';
import DashboardScreen from './screens/DashboardScreen';
import AddItemScreen from './screens/AddItemScreen';
import InventoryScreen from './screens/InventoryScreen';
import BillingScreen from './screens/BillingScreen';
import BillReceiptScreen from './screens/BillReceiptScreen';
import AboutScreen from './screens/AboutScreen';
import SettingsScreen from './screens/SettingsScreen';
import ReportsScreen from './screens/ReportsScreen';

export type RootStackParamList = {
  Dashboard: undefined;
  AddItem: undefined;
  Inventory: undefined;
  Billing: undefined;
  BillReceipt: { billId: string };
  About: undefined;
  Settings: undefined;
  Reports: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const App = () => {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <NavigationContainer>
          <Stack.Navigator 
            initialRouteName="Dashboard"
            screenOptions={{
              headerStyle: {
                elevation: 0,
                shadowOpacity: 0,
                backgroundColor: 'transparent',
              },
              headerTintColor: '#000',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
              ...TransitionPresets.SlideFromRightIOS,
            }}
          >
            <Stack.Screen 
              name="Dashboard" 
              component={DashboardScreen} 
              options={{ 
                headerShown: false,
                ...TransitionPresets.ScaleFromCenterAndroid,
              }} 
            />
            <Stack.Screen 
              name="AddItem" 
              component={AddItemScreen} 
              options={{ 
                title: 'Add Item',
                ...TransitionPresets.SlideFromLeftIOS,
              }}
            />
            <Stack.Screen 
              name="Inventory" 
              component={InventoryScreen} 
              options={{ 
                title: 'Inventory',
                ...TransitionPresets.SlideFromRightIOS,
              }}
            />
            <Stack.Screen 
              name="Billing" 
              component={BillingScreen} 
              options={{ 
                title: 'Billing',
                ...TransitionPresets.SlideFromRightIOS,
              }}
            />
            <Stack.Screen 
              name="BillReceipt" 
              component={BillReceiptScreen} 
              options={{ 
                title: 'Receipt',
                ...TransitionPresets.ModalSlideFromBottomIOS,
              }}
            />
            <Stack.Screen 
              name="About" 
              component={AboutScreen} 
              options={{ 
                title: 'About',
                ...TransitionPresets.SlideFromRightIOS,
              }}
            />
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen} 
              options={{ 
                title: 'Settings',
                ...TransitionPresets.ModalPresentationIOS,
              }}
            />
            <Stack.Screen 
              name="Reports" 
              component={ReportsScreen} 
              options={{
                title: 'Sales Reports',
                ...TransitionPresets.SlideFromRightIOS,
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </ErrorBoundary>
    </ThemeProvider>
  );
};

export default App;