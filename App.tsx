import 'react-native-gesture-handler';
import 'react-native-get-random-values';

import React, { useState, useEffect } from 'react';
import { StatusBar, ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootNavigator } from './src/app/navigation';
import { DatabaseProvider } from './src/db/DatabaseProvider';
import { LoginScreen } from './src/features/auth';
import { authService } from './src/services/authService';
import { httpTransport } from './src/sync/httpTransport';
import { syncEngine } from './src/sync/syncEngine';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Initialize auth state on app start
    const initAuth = async () => {
      try {
        const user = await authService.initialize();
        
        if (user) {
          // User is logged in - configure HTTP transport
          httpTransport.setAuthToken(user.id);
          syncEngine.setTransport(httpTransport);
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    await authService.logout();
    httpTransport.setAuthToken(null);
    setIsLoggedIn(false);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
      <DatabaseProvider>
        {isLoggedIn ? (
          <NavigationContainer>
            <RootNavigator onLogout={handleLogout} />
          </NavigationContainer>
        ) : (
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        )}
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
});
