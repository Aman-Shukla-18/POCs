import { useState, useCallback } from 'react';
import { todoRepository } from '../repository';
import Todo from '../../../db/models/Todo';
import { logger } from '../../../shared/utils';

const TAG = 'useTodos';

interface UseTodosResult {
  todos: Todo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  toggleComplete: (id: string) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
}

export const useTodos = (): UseTodosResult => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedTodos = await todoRepository.getAll();
      setTodos(fetchedTodos);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load todos';
      setError(message);
      logger.error(TAG, 'Failed to refresh todos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleComplete = useCallback(async (id: string) => {
    try {
      await todoRepository.toggleComplete(id);
      // Optimistically update the local state
      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === id
            ? { ...todo, isCompleted: !todo.isCompleted } as Todo
            : todo
        )
      );
    } catch (err) {
      logger.error(TAG, 'Failed to toggle todo:', err);
      // Refresh to get correct state on error
      await refresh();
    }
  }, [refresh]);

  const deleteTodo = useCallback(async (id: string) => {
    try {
      await todoRepository.delete(id);
      // Remove from local state
      setTodos((prev) => prev.filter((todo) => todo.id !== id));
    } catch (err) {
      logger.error(TAG, 'Failed to delete todo:', err);
      // Refresh to get correct state on error
      await refresh();
    }
  }, [refresh]);

  return {
    todos,
    loading,
    error,
    refresh,
    toggleComplete,
    deleteTodo,
  };
};
