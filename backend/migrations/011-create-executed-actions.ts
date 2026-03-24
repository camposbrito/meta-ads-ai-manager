import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('executed_actions', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'organizations',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
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
    suggestion_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'optimization_suggestions',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    action_type: {
      type: DataTypes.ENUM('pause_ad', 'pause_adset', 'pause_campaign', 'duplicate_ad', 'increase_budget', 'decrease_budget', 'modify_targeting', 'modify_creative'),
      allowNull: false,
    },
    entity_type: {
      type: DataTypes.ENUM('campaign', 'ad_set', 'ad'),
      allowNull: false,
    },
    entity_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    meta_entity_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    previous_state: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON string with previous state',
    },
    new_state: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON string with new state',
    },
    executed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    execution_method: {
      type: DataTypes.ENUM('manual', 'automatic'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'success', 'failed', 'partial'),
      defaultValue: 'pending',
      allowNull: false,
    },
    meta_response: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON string with Meta API response',
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
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

  await queryInterface.addIndex('executed_actions', ['organization_id']);
  await queryInterface.addIndex('executed_actions', ['ad_account_id']);
  await queryInterface.addIndex('executed_actions', ['action_type']);
  await queryInterface.addIndex('executed_actions', ['status']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('executed_actions');
}
