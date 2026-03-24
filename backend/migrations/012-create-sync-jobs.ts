import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('sync_jobs', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ad_account_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'ad_accounts',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
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
  });

  await queryInterface.addIndex('sync_jobs', ['ad_account_id']);
  await queryInterface.addIndex('sync_jobs', ['status']);
  await queryInterface.addIndex('sync_jobs', ['job_type']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('sync_jobs');
}
