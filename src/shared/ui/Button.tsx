import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

const variantStyles: Record<ButtonVariant, { button: ViewStyle; text: TextStyle }> = {
  primary: {
    button: { backgroundColor: '#4CAF50' },
    text: { color: '#FFFFFF' },
  },
  secondary: {
    button: { backgroundColor: '#E0E0E0' },
    text: { color: '#333333' },
  },
  danger: {
    button: { backgroundColor: '#F44336' },
    text: { color: '#FFFFFF' },
  },
};

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}) => {
  const isDisabled = disabled || loading;
  const { button: buttonVariant, text: textVariant } = variantStyles[variant];

  return (
    <TouchableOpacity
      style={[
        styles.button,
        buttonVariant,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={textVariant.color} size="small" />
      ) : (
        <Text style={[styles.text, textVariant]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
