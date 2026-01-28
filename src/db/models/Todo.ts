import { Model, Relation } from '@nozbe/watermelondb';
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators';
import type { Associations } from '@nozbe/watermelondb/Model';
import Category from './Category';

export default class Todo extends Model {
  static table = 'todos';

  static associations: Associations = {
    categories: { type: 'belongs_to', key: 'category_id' },
  };

  @field('title') title!: string;
  @field('description') description?: string;
  @field('is_completed') isCompleted!: boolean;
  @field('category_id') categoryId?: string;
  @readonly @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;

  @relation('categories', 'category_id') category!: Relation<Category>;
}
