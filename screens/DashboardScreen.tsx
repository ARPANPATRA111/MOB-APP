// src/screens/DashboardScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  Dashboard: undefined;
  AddItem: undefined;
  Inventory: undefined;
  Billing: undefined;
};

type DashboardScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Dashboard'>;
};

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4a89dc" />
      <View style={styles.header}>
        <Text style={styles.headerText}>MOB - (Mobile Oriented PoS)</Text>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('AddItem')}
        >
          <Text style={styles.buttonText}>Add Item to Inventory</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Billing')}
        >
          <Text style={styles.buttonText}>Bill Customer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 14,
    backgroundColor: '#4a89dc',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 29,
    fontWeight: 'bold',
    color: '#fff',
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // padding: 10,
  },
  button: {
    backgroundColor: '#4a89dc',
    padding: 25,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default DashboardScreen;