import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, Image, Linking, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const AboutScreen: React.FC = () => {
  const handleEmailPress = () => {
    Linking.openURL('mailto:Thispc119@gmail.com');
  };

  const handlePortfolioPress = () => {
    Linking.openURL('https://arpanpatra.vercel.app/');
  };

  const handleCallPress = () => {
    Linking.openURL('tel:9111155305');
  };

  const handleWhatsAppPress = () => {
    const phoneNumber = '9111155305';
    const message = 'Hi, I’d like to get in touch with you regarding your app!';
    const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url);
  };

  return (
    <LinearGradient
      colors={['#6a11cb', '#2575fc']}
      style={styles.container}
    >
      <SafeAreaView style={styles.innerContainer}>
        <View style={styles.profileContainer}>
          <Image
            source={require('../assets/Arpan.png')} // Replace with your image URL
            style={styles.profileImage}
          />
          <Text style={styles.name}>Arpan Patra</Text>
          <Text style={styles.role}>Full-Stack App Developer</Text>
        </View>
        <View style={styles.skillsContainer}>
          <Text style={styles.sectionTitle}>Skills & Expertise</Text>
          <Text style={styles.skillText}>
            🚀 React Native, React.js, Node.js, TypeScript, Python
          </Text>
          <Text style={styles.skillText}>
            🔧 Web & Mobile App Development, API Design, UI/UX
          </Text>
        </View>
        <View style={styles.contactContainer}>
          <Text style={styles.sectionTitle}>Get in Touch</Text>
          <TouchableOpacity style={styles.contactItem} onPress={handleEmailPress}>
            <Ionicons name="mail" size={24} color="#fff" />
            <Text style={styles.contactText}>Thispc119@gmail.com</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactItem} onPress={handlePortfolioPress}>
            <Ionicons name="globe" size={24} color="#fff" />
            <Text style={styles.contactText}>ArpanPatra.com</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactItem} onPress={handleCallPress}>
            <Ionicons name="call" size={24} color="#fff" />
            <Text style={styles.contactText}>9111155305</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactItem} onPress={handleWhatsAppPress}>k
            <Ionicons name="logo-whatsapp" size={24} color="#fff" />
            <Text style={styles.contactText}>Message on WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#fff',
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  role: {
    fontSize: 16,
    color: '#e0e0e0',
  },
  skillsContainer: {
    width: '100%',
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  skillText: {
    fontSize: 16,
    color: '#f5f5f5',
    marginBottom: 5,
    textAlign: 'center',
  },
  contactContainer: {
    width: '100%',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  contactText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 10,
    textDecorationLine: 'underline',
  },
});

export default AboutScreen;
