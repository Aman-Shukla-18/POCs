import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TodosStackParamList } from './types';
import { TodosListScreen } from '../../features/todos/screens/TodosListScreen';
import { TodoDetailScreen } from '../../features/todos/screens/TodoDetailScreen';
import { TodoFormScreen } from '../../features/todos/screens/TodoFormScreen';

const Stack = createNativeStackNavigator<TodosStackParamList>();

interface TodosNavigatorProps {
  onLogout?: () => void;
}

export const TodosNavigator: React.FC<TodosNavigatorProps> = ({ onLogout }) => {
  const handleLogoutPress = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: onLogout,
        },
      ]
    );
  };

  const LogoutButton = () => (
    <TouchableOpacity onPress={handleLogoutPress} style={styles.logoutButton}>
      <Text style={styles.logoutText}>Logout</Text>
    </TouchableOpacity>
  );

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#4CAF50' },
        headerTintColor: '#FFF',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="TodosList"
        component={TodosListScreen}
        options={{
          title: 'Todos',
          headerLeft: onLogout ? LogoutButton : undefined,
        }}
      />
      <Stack.Screen
        name="TodoDetail"
        component={TodoDetailScreen}
        options={{ title: 'Todo Details' }}
      />
      <Stack.Screen
        name="TodoForm"
        component={TodoFormScreen}
        options={({ route }) => ({
          title: route.params?.todoId ? 'Edit Todo' : 'Create Todo',
        })}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logoutText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
