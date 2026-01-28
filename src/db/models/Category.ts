import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, children } from '@nozbe/watermelondb/decorators';
import type { Associations } from '@nozbe/watermelondb/Model';

export default class Category extends Model {
  static table = 'categories';

  static associations: Associations = {
    todos: { type: 'has_many', foreignKey: 'category_id' },
  };

  @field('title') title!: string;
  @readonly @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;

  @children('todos') todos: any;
}
