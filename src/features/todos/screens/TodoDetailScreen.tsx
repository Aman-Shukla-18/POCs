import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button } from '../../../shared/ui';
import { TodosStackScreenProps } from '../../../app/navigation/types';
import { todoRepository } from '../repository';
import { formatDateTime } from '../../../shared/utils';
import type Todo from '../../../db/models/Todo';
import type Category from '../../../db/models/Category';

type Props = TodosStackScreenProps<'TodoDetail'>;

export const TodoDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { todoId } = route.params;
  const [todo, setTodo] = useState<Todo | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTodo = async () => {
      try {
        const foundTodo = await todoRepository.getById(todoId);
        setTodo(foundTodo);
        if (foundTodo?.categoryId) {
          const foundCategory = await foundTodo.category.fetch();
          setCategory(foundCategory);
        }
      } catch (err) {
        console.error('Failed to load todo:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTodo();
  }, [todoId]);

  const handleEdit = () => {
    navigation.navigate('TodoForm', { todoId });
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Todo',
      'Are you sure you want to delete this todo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await todoRepository.delete(todoId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!todo) {
    return (
      <View style={styles.centered}>
        <Text>Todo not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{todo.title}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>
            {todo.description || 'No description provided'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          <Text style={styles.category}>
            {category?.title || 'No category'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View
            style={[
              styles.statusBadge,
              todo.isCompleted ? styles.completedBadge : styles.pendingBadge,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                todo.isCompleted ? styles.completedText : styles.pendingText,
              ]}
            >
              {todo.isCompleted ? 'Completed' : 'Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Created</Text>
          <Text style={styles.meta}>{formatDateTime(todo.createdAt)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last Updated</Text>
          <Text style={styles.meta}>{formatDateTime(todo.updatedAt)}</Text>
        </View>

        <View style={styles.actions}>
          <Button title="Edit" onPress={handleEdit} style={styles.editButton} />
          <Button
            title="Delete"
            onPress={handleDelete}
            variant="danger"
            style={styles.deleteButton}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  description: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
  },
  category: {
    fontSize: 16,
    color: '#555',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  completedBadge: {
    backgroundColor: '#E8F5E9',
  },
  pendingBadge: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  completedText: {
    color: '#4CAF50',
  },
  pendingText: {
    color: '#FF9800',
  },
  meta: {
    fontSize: 14,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  editButton: {
    flex: 1,
  },
  deleteButton: {
    flex: 1,
  },
});
