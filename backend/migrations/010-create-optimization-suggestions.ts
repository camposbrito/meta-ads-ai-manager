import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('optimization_suggestions', {
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
    rule_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'optimization_rules',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
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
    suggestion_type: {
      type: DataTypes.ENUM('pause', 'duplicate', 'increase_budget', 'decrease_budget', 'modify_targeting', 'modify_creative'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Explanation of why this suggestion was made',
    },
    expected_impact: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    confidence_score: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true,
      comment: 'Score from 0 to 1 indicating confidence',
    },
    current_metrics: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON string with current performance metrics',
    },
    proposed_changes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON string with proposed changes',
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'executed', 'expired'),
      defaultValue: 'pending',
      allowNull: false,
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    executed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
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

  await queryInterface.addIndex('optimization_suggestions', ['organization_id']);
  await queryInterface.addIndex('optimization_suggestions', ['ad_account_id']);
  await queryInterface.addIndex('optimization_suggestions', ['status']);
  await queryInterface.addIndex('optimization_suggestions', ['entity_type', 'entity_id']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('optimization_suggestions');
}
