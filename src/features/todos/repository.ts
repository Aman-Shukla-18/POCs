import { Q } from '@nozbe/watermelondb';
import { database, todosCollection } from '../../db';
import Todo from '../../db/models/Todo';
import { generateId, nowMs, logger } from '../../shared/utils';

const TAG = 'TodoRepository';

export interface CreateTodoInput {
  title: string;
  description?: string;
  categoryId?: string;
}

export interface UpdateTodoInput {
  title?: string;
  description?: string;
  categoryId?: string;
  isCompleted?: boolean;
}

class TodoRepository {
  async getAll(): Promise<Todo[]> {
    try {
      const todos = await todosCollection
        .query(Q.sortBy('created_at', Q.desc))
        .fetch();
      logger.debug(TAG, `Fetched ${todos.length} todos`);
      return todos as Todo[];
    } catch (error) {
      logger.error(TAG, 'Failed to fetch todos:', error);
      throw error;
    }
  }

  async getById(id: string): Promise<Todo | null> {
    try {
      const todo = await todosCollection.find(id);
      return todo as Todo;
    } catch {
      logger.debug(TAG, `Todo not found with id: ${id}`);
      return null;
    }
  }

  async getByCategory(categoryId: string): Promise<Todo[]> {
    try {
      const todos = await todosCollection
        .query(
          Q.where('category_id', categoryId),
          Q.sortBy('created_at', Q.desc)
        )
        .fetch();
      return todos as Todo[];
    } catch (error) {
      logger.error(TAG, `Failed to fetch todos for category ${categoryId}:`, error);
      throw error;
    }
  }

  async create(input: CreateTodoInput): Promise<Todo> {
    const now = nowMs();

    try {
      const newTodo = await database.write(async () => {
        const todo = await todosCollection.create((t: any) => {
          t._raw.id = generateId();
          t.title = input.title;
          t.description = input.description || null;
          t.isCompleted = false;
          t.categoryId = input.categoryId || null;
          t._raw.created_at = now;
          t._raw.updated_at = now;
        });
        return todo;
      });

      logger.info(TAG, `Created todo: ${newTodo.id}`);
      return newTodo as Todo;
    } catch (error) {
      logger.error(TAG, 'Failed to create todo:', error);
      throw error;
    }
  }

  async update(id: string, input: UpdateTodoInput): Promise<Todo> {
    try {
      const todo = await todosCollection.find(id);
      const now = nowMs();

      const updatedTodo = await database.write(async () => {
        await todo.update((t: any) => {
          if (input.title !== undefined) {
            t.title = input.title;
          }
          if (input.description !== undefined) {
            t.description = input.description || null;
          }
          if (input.categoryId !== undefined) {
            t.categoryId = input.categoryId || null;
          }
          if (input.isCompleted !== undefined) {
            t.isCompleted = input.isCompleted;
          }
          t._raw.updated_at = now;
        });
        return todo;
      });

      logger.info(TAG, `Updated todo: ${id}`);
      return updatedTodo as Todo;
    } catch (error) {
      logger.error(TAG, `Failed to update todo ${id}:`, error);
      throw error;
    }
  }

  async toggleComplete(id: string): Promise<Todo> {
    try {
      const todo = await todosCollection.find(id) as Todo;
      const now = nowMs();

      const updatedTodo = await database.write(async () => {
        await todo.update((t: any) => {
          t.isCompleted = !todo.isCompleted;
          t._raw.updated_at = now;
        });
        return todo;
      });

      logger.info(TAG, `Toggled todo completion: ${id} -> ${!todo.isCompleted}`);
      return updatedTodo as Todo;
    } catch (error) {
      logger.error(TAG, `Failed to toggle todo ${id}:`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const todo = await todosCollection.find(id);

      await database.write(async () => {
        // Mark as deleted (soft delete for sync compatibility)
        await todo.markAsDeleted();
      });

      logger.info(TAG, `Deleted todo: ${id}`);
    } catch (error) {
      logger.error(TAG, `Failed to delete todo ${id}:`, error);
      throw error;
    }
  }

  async permanentlyDelete(id: string): Promise<void> {
    try {
      const todo = await todosCollection.find(id);

      await database.write(async () => {
        await todo.destroyPermanently();
      });

      logger.info(TAG, `Permanently deleted todo: ${id}`);
    } catch (error) {
      logger.error(TAG, `Failed to permanently delete todo ${id}:`, error);
      throw error;
    }
  }
}

export const todoRepository = new TodoRepository();
