import { useState, useCallback } from 'react';
import { categoryRepository } from '../repository';
import Category from '../../../db/models/Category';
import { logger } from '../../../shared/utils';

const TAG = 'useCategories';

interface UseCategoriesResult {
  categories: Category[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useCategories = (): UseCategoriesResult => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedCategories = await categoryRepository.getAll();
      setCategories(fetchedCategories);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load categories';
      setError(message);
      logger.error(TAG, 'Failed to refresh categories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      await categoryRepository.delete(id);
      // Remove from local state
      setCategories((prev) => prev.filter((cat) => cat.id !== id));
    } catch (err) {
      logger.error(TAG, 'Failed to delete category:', err);
      // Refresh to get correct state on error
      await refresh();
    }
  }, [refresh]);

  return {
    categories,
    loading,
    error,
    refresh,
    deleteCategory,
  };
};
