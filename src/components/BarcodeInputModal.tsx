import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Theme } from '../../src/contexts/ThemeContext';

interface BarcodeInputModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (barcode: string) => void;
  theme: Theme;
}

const BarcodeInputModal: React.FC<BarcodeInputModalProps> = ({
  visible,
  onClose,
  onSubmit,
  theme,
}) => {
  const [barcode, setBarcode] = useState('');
  const styles = createStyles(theme);

  const handleSubmit = () => {
    if (barcode.trim()) {
      onSubmit(barcode);
      setBarcode('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enter Barcode Manually</Text>
              <TouchableOpacity onPress={onClose}>
                <FontAwesome5 name="times" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              value={barcode}
              onChangeText={setBarcode}
              placeholder="Scan or enter barcode"
              placeholderTextColor={theme.placeholder}
              autoFocus={true}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitButton, !barcode.trim() && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={!barcode.trim()}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    keyboardAvoidingView: {
      width: '100%',
      alignItems: 'center',
    },
    modalContainer: {
      width: '90%',
      backgroundColor: theme.cardBackground,
      borderRadius: 10,
      padding: 20,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.text,
    },
    input: {
      height: 50,
      borderWidth: 1,
      borderColor: theme.placeholder,
      borderRadius: 8,
      paddingHorizontal: 15,
      fontSize: 16,
      color: theme.text,
      backgroundColor: theme.background,
      marginBottom: 20,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    cancelButton: {
      flex: 1,
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.placeholder,
      borderRadius: 8,
      padding: 15,
      alignItems: 'center',
      marginRight: 10,
    },
    cancelButtonText: {
      color: theme.text,
      fontWeight: 'bold',
    },
    submitButton: {
      flex: 1,
      backgroundColor: theme.primary,
      borderRadius: 8,
      padding: 15,
      alignItems: 'center',
    },
    submitButtonDisabled: {
      backgroundColor: theme.placeholder,
    },
    submitButtonText: {
      color: '#fff',
      fontWeight: 'bold',
    },
  });

export default BarcodeInputModal;