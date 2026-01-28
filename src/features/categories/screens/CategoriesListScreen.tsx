import React, { useCallback } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Fab, EmptyState } from '../../../shared/ui';
import { CategoriesStackScreenProps } from '../../../app/navigation/types';
import { useCategories } from '../hooks/useCategories';
import { CategoryListItem } from '../components/CategoryListItem';

type Props = CategoriesStackScreenProps<'CategoriesList'>;

export const CategoriesListScreen: React.FC<Props> = ({ navigation }) => {
  const { categories, loading, error, refresh, deleteCategory } = useCategories();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleEditPress = (categoryId: string) => {
    navigation.navigate('CategoryForm', { categoryId });
  };

  const handleDeletePress = (categoryId: string) => {
    Alert.alert(
      'Delete Category',
      'Are you sure you want to delete this category? Todos in this category will have no category.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCategory(categoryId),
        },
      ]
    );
  };

  const handleCreatePress = () => {
    navigation.navigate('CategoryForm', {});
  };

  if (error) {
    return (
      <View style={styles.container}>
        <EmptyState title="Error loading categories" message={error} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {categories.length === 0 && !loading ? (
        <EmptyState
          title="No categories yet"
          message="Tap the + button to create your first category"
        />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CategoryListItem
              category={item}
              onEdit={() => handleEditPress(item.id)}
              onDelete={() => handleDeletePress(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={refresh}
        />
      )}
      <Fab onPress={handleCreatePress} style={styles.fab} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  listContent: {
    padding: 16,
  },
  fab: {
    backgroundColor: '#2196F3',
  },
});
