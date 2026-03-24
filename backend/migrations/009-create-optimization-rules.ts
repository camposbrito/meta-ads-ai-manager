import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('optimization_rules', {
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rule_type: {
      type: DataTypes.ENUM('pause_ad', 'duplicate_ad', 'increase_budget', 'decrease_budget'),
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    conditions: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'JSON string with rule conditions',
    },
    actions: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'JSON string with actions to perform',
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    min_spend_threshold: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false,
      comment: 'Minimum spend before rule applies',
    },
    min_impressions_threshold: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      allowNull: false,
      comment: 'Minimum impressions before rule applies',
    },
    evaluation_period_days: {
      type: DataTypes.INTEGER,
      defaultValue: 7,
      allowNull: false,
      comment: 'Number of days to evaluate for rule',
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

  await queryInterface.addIndex('optimization_rules', ['organization_id']);
  await queryInterface.addIndex('optimization_rules', ['rule_type']);
  await queryInterface.addIndex('optimization_rules', ['is_active']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('optimization_rules');
}
