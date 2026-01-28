import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CategoriesStackParamList } from './types';
import { CategoriesListScreen } from '../../features/categories/screens/CategoriesListScreen';
import { CategoryFormScreen } from '../../features/categories/screens/CategoryFormScreen';

const Stack = createNativeStackNavigator<CategoriesStackParamList>();

export const CategoriesNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#2196F3' },
        headerTintColor: '#FFF',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="CategoriesList"
        component={CategoriesListScreen}
        options={{ title: 'Categories' }}
      />
      <Stack.Screen
        name="CategoryForm"
        component={CategoryFormScreen}
        options={({ route }) => ({
          title: route.params?.categoryId ? 'Edit Category' : 'Create Category',
        })}
      />
    </Stack.Navigator>
  );
};
