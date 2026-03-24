import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('ad_sets', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    campaign_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'campaigns',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    meta_adset_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    daily_budget: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    lifetime_budget: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    bid_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    bid_strategy: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    optimization_goal: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    targeting: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON string with targeting configuration',
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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

  await queryInterface.addIndex('ad_sets', ['campaign_id']);
  await queryInterface.addIndex('ad_sets', ['meta_adset_id']);
  await queryInterface.addIndex('ad_sets', ['status']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('ad_sets');
}
