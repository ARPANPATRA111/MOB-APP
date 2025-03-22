// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';
import DashboardScreen from './screens/DashboardScreen';
import AddItemScreen from './screens/AddItemScreen';
import InventoryScreen from './screens/InventoryScreen';

const Stack = createStackNavigator<RootStackParamList>();

const App = () => {
  console.log('App initializing...'); // Debug log
  
  return (
    <ErrorBoundary>
      <NavigationContainer
        fallback={<Text>Loading...</Text>}
        onReady={() => console.log('Navigation ready')}
      >
        <Stack.Navigator 
          initialRouteName="Dashboard"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#4a89dc',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          <Stack.Screen 
            name="Dashboard" 
            component={DashboardScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="AddItem" 
            component={AddItemScreen} 
            options={{ title: 'Add Item' }}
          />
          <Stack.Screen 
            name="Inventory" 
            component={InventoryScreen} 
            options={{ title: 'Inventory' }}
          />

        </Stack.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
};

export default App;