import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import AdAccount from './AdAccount';

interface SyncJobAttributes {
  id: string;
  ad_account_id: string;
  job_type: 'full_sync' | 'incremental_sync' | 'insights_sync';
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: Date | null;
  completed_at?: Date | null;
  error_message?: string | null;
  records_synced: number;
  created_at: Date;
  updated_at: Date;
}

interface SyncJobCreationAttributes extends Optional<SyncJobAttributes, 'id' | 'created_at' | 'updated_at'> {}

class SyncJob extends Model<SyncJobAttributes, SyncJobCreationAttributes> implements SyncJobAttributes {
  public id!: string;
  public ad_account_id!: string;
  public job_type!: 'full_sync' | 'incremental_sync' | 'insights_sync';
  public status!: 'pending' | 'running' | 'completed' | 'failed';
  public started_at!: Date | null;
  public completed_at!: Date | null;
  public error_message!: string | null;
  public records_synced!: number;
  public created_at!: Date;
  public updated_at!: Date;

  // Associations
  public ad_account?: AdAccount;
}

SyncJob.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ad_account_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    job_type: {
      type: DataTypes.ENUM('full_sync', 'incremental_sync', 'insights_sync'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'running', 'completed', 'failed'),
      defaultValue: 'pending',
      allowNull: false,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    records_synced: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'sync_jobs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default SyncJob;
