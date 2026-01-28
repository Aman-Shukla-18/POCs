import { Q } from '@nozbe/watermelondb';
import { database, categoriesCollection } from '../../db';
import Category from '../../db/models/Category';
import { generateId, nowMs, logger } from '../../shared/utils';

const TAG = 'CategoryRepository';

export interface CreateCategoryInput {
  title: string;
}

export interface UpdateCategoryInput {
  title?: string;
}

class CategoryRepository {
  async getAll(): Promise<Category[]> {
    try {
      const categories = await categoriesCollection
        .query(Q.sortBy('created_at', Q.desc))
        .fetch();
      logger.debug(TAG, `Fetched ${categories.length} categories`);
      return categories as Category[];
    } catch (error) {
      logger.error(TAG, 'Failed to fetch categories:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Category | null> {
    try {
      const category = await categoriesCollection.find(id);
      return category as Category;
    } catch {
      logger.debug(TAG, `Category not found with id: ${id}`);
      return null;
    }
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const now = nowMs();

    try {
      const newCategory = await database.write(async () => {
        const category = await categoriesCollection.create((cat: any) => {
          cat._raw.id = generateId();
          cat.title = input.title;
          cat._raw.created_at = now;
          cat._raw.updated_at = now;
        });
        return category;
      });

      logger.info(TAG, `Created category: ${newCategory.id}`);
      return newCategory as Category;
    } catch (error) {
      logger.error(TAG, 'Failed to create category:', error);
      throw error;
    }
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    try {
      const category = await categoriesCollection.find(id);
      const now = nowMs();

      const updatedCategory = await database.write(async () => {
        await category.update((cat: any) => {
          if (input.title !== undefined) {
            cat.title = input.title;
          }
          cat._raw.updated_at = now;
        });
        return category;
      });

      logger.info(TAG, `Updated category: ${id}`);
      return updatedCategory as Category;
    } catch (error) {
      logger.error(TAG, `Failed to update category ${id}:`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const category = await categoriesCollection.find(id);

      await database.write(async () => {
        // Mark as deleted (soft delete for sync compatibility)
        await category.markAsDeleted();
      });

      logger.info(TAG, `Deleted category: ${id}`);
    } catch (error) {
      logger.error(TAG, `Failed to delete category ${id}:`, error);
      throw error;
    }
  }

  async permanentlyDelete(id: string): Promise<void> {
    try {
      const category = await categoriesCollection.find(id);

      await database.write(async () => {
        await category.destroyPermanently();
      });

      logger.info(TAG, `Permanently deleted category: ${id}`);
    } catch (error) {
      logger.error(TAG, `Failed to permanently delete category ${id}:`, error);
      throw error;
    }
  }
}

export const categoryRepository = new CategoryRepository();
