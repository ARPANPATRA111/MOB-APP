// DashboardScreen.tsx

import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar,
  Image
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/contexts/ThemeContext';

type RootStackParamList = {
  Dashboard: undefined;
  AddItem: undefined;
  Inventory: undefined;
  Billing: undefined;
  About: undefined;
  Settings: undefined;
};

type DashboardScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Dashboard'>;
};

const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const menuItems = [
    {
      title: 'Add Item to Inventory',
      icon: 'plus-circle',
      screen: 'AddItem',
      color: '#4CAF50'
    },
    {
      title: 'Check Inventory',
      icon: 'boxes',
      screen: 'Inventory',
      color: '#2196F3'
    },
    {
      title: 'Bill Customer',
      icon: 'file-invoice-dollar',
      screen: 'Billing',
      color: '#FF9800'
    },
    {
      title: 'Reports',
      icon: 'file-alt',
      screen: 'Reports',
      color: '#1E910E'
    },    
    {
      title: 'Settings',
      icon: 'cog',
      screen: 'Settings',
      color: '#9E9E9E'
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.headerBackground} />
      <View style={styles.header}>
        <Image 
          source={require('../assets/adaptive-icon.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        <Text style={styles.headerText}>MOB - (Mobile Oriented PoS)</Text>
      </View>
      
      <View style={styles.buttonContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.button, { backgroundColor: item.color }]}
            onPress={() => navigation.navigate(item.screen as any)}
          >
            <View style={styles.buttonContent}>
              <FontAwesome5 name={item.icon} size={24} color="#fff" />
              <Text style={styles.buttonText}>{item.title}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.helpIcon}
        onPress={() => navigation.navigate('About')}
      >
        <Ionicons name="help-circle" size={32} color={theme.primary} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.headerBackground,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 10
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.headerText,
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  button: {
    padding: 20,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  helpIcon: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: theme.cardBackground,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
});

export default DashboardScreen;