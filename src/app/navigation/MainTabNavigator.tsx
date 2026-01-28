import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet } from 'react-native';
import { MainTabParamList } from './types';
import { TodosNavigator } from './TodosNavigator';
import { CategoriesNavigator } from './CategoriesNavigator';

const Tab = createBottomTabNavigator<MainTabParamList>();

interface TabIconProps {
  focused: boolean;
  label: string;
  emoji: string;
}

const TabIcon: React.FC<TabIconProps> = ({ focused, label, emoji }) => (
  <Text style={[styles.icon, focused && styles.iconFocused]}>
    {emoji} {label}
  </Text>
);

const TodosTabIcon = ({ focused }: { focused: boolean }) => (
  <TabIcon focused={focused} label="Todos" emoji="📝" />
);

const CategoriesTabIcon = ({ focused }: { focused: boolean }) => (
  <TabIcon focused={focused} label="Categories" emoji="📁" />
);

interface MainTabNavigatorProps {
  onLogout?: () => void;
}

export const MainTabNavigator: React.FC<MainTabNavigatorProps> = ({ onLogout }) => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen name="TodosTab" options={{ tabBarIcon: TodosTabIcon }}>
        {() => <TodosNavigator onLogout={onLogout} />}
      </Tab.Screen>
      <Tab.Screen
        name="CategoriesTab"
        component={CategoriesNavigator}
        options={{ tabBarIcon: CategoriesTabIcon }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
  },
  icon: {
    fontSize: 24,
    color: '#999',
  },
  iconFocused: {
    color: '#4CAF50',
    fontWeight: '600',
  },
});
