import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export type ConflictWinner = 'local' | 'remote';

export default class SyncEvent extends Model {
  static table = 'sync_events';

  @field('collection_name') collectionName!: string;
  @field('record_id') recordId!: string;
  @field('local_updated_at') localUpdatedAt!: number;
  @field('remote_updated_at') remoteUpdatedAt!: number;
  @field('winner') winner!: ConflictWinner;
  @field('reason') reason!: string;
  @readonly @date('created_at') createdAt!: number;
}
