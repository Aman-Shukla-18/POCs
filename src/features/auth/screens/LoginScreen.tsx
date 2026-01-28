import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button, TextField } from '../../../shared/ui';
import { authService } from '../../../services/authService';
import { httpTransport } from '../../../sync/httpTransport';
import { syncEngine } from '../../../sync/syncEngine';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!email.includes('@')) {
      newErrors.email = 'Invalid email format';
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
    } else if (password.length < 3) {
      newErrors.password = 'Password must be at least 3 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      if (isLogin) {
        // Login
        const user = await authService.login(email.trim(), password);
        
        // Set auth token on HTTP transport
        httpTransport.setAuthToken(user.id);
        
        // Configure sync engine to use HTTP transport
        syncEngine.setTransport(httpTransport);
        
        // Auto-sync to pull user's data from server
        console.log('[Login] Starting auto-sync to fetch user data...');
        const syncResult = await syncEngine.sync();
        console.log('[Login] Auto-sync complete:', syncResult);
        
        Alert.alert('Success', `Welcome back, ${user.email}!`);
        onLoginSuccess();
      } else {
        // Register
        await authService.register(email.trim(), password);
        
        // After registration, auto-login
        const user = await authService.login(email.trim(), password);
        
        // Set auth token on HTTP transport
        httpTransport.setAuthToken(user.id);
        
        // Configure sync engine to use HTTP transport
        syncEngine.setTransport(httpTransport);
        
        // Auto-sync (for new users, this will be empty but establishes lastPulledAt)
        console.log('[Login] Starting auto-sync for new user...');
        const syncResult = await syncEngine.sync();
        console.log('[Login] Auto-sync complete:', syncResult);
        
        Alert.alert('Success', `Account created! Welcome, ${user.email}!`);
        onLoginSuccess();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setErrors({});
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Todo App</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Sign in to sync your todos' : 'Create an account'}
          </Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
          />

          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            error={errors.password}
          />

          <Button
            title={isLogin ? 'Sign In' : 'Create Account'}
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitButton}
          />

          <Button
            title={isLogin ? 'Need an account? Register' : 'Already have an account? Sign In'}
            onPress={toggleMode}
            variant="secondary"
            disabled={loading}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            WatermelonDB POC - Offline-first sync demo
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});
