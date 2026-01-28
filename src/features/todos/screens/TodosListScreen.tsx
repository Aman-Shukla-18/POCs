import React, { useCallback, useLayoutEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Fab, EmptyState, SyncButton } from '../../../shared/ui';
import { TodosStackScreenProps } from '../../../app/navigation/types';
import { useTodos } from '../hooks/useTodos';
import { useSync } from '../../../sync';
import { TodoListItem } from '../components/TodoListItem';

type Props = TodosStackScreenProps<'TodosList'>;

export const TodosListScreen: React.FC<Props> = ({ navigation }) => {
  const { todos, loading, error, refresh, toggleComplete, deleteTodo } = useTodos();
  const { sync, isSyncing } = useSync();

  const handleSync = useCallback(async () => {
    const result = await sync();
    if (result.success) {
      Alert.alert(
        'Sync Complete',
        `Pulled: ${result.pulled}, Pushed: ${result.pushed}, Conflicts: ${result.conflicts}`
      );
      refresh();
    } else {
      Alert.alert('Sync Failed', result.error || 'Unknown error');
    }
  }, [sync, refresh]);

  const HeaderRight = useCallback(
    () => <SyncButton onPress={handleSync} isSyncing={isSyncing} />,
    [handleSync, isSyncing]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: HeaderRight,
    });
  }, [navigation, HeaderRight]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleTodoPress = (todoId: string) => {
    navigation.navigate('TodoDetail', { todoId });
  };

  const handleEditPress = (todoId: string) => {
    navigation.navigate('TodoForm', { todoId });
  };

  const handleDeletePress = (todoId: string) => {
    Alert.alert(
      'Delete Todo',
      'Are you sure you want to delete this todo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTodo(todoId),
        },
      ]
    );
  };

  const handleCreatePress = () => {
    navigation.navigate('TodoForm', {});
  };

  if (error) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Error loading todos"
          message={error}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {todos.length === 0 && !loading ? (
        <EmptyState
          title="No todos yet"
          message="Tap the + button to create your first todo"
        />
      ) : (
        <FlatList
          data={todos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TodoListItem
              todo={item}
              onPress={() => handleTodoPress(item.id)}
              onToggleComplete={() => toggleComplete(item.id)}
              onEdit={() => handleEditPress(item.id)}
              onDelete={() => handleDeletePress(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={refresh}
        />
      )}
      <Fab onPress={handleCreatePress} />
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
});
