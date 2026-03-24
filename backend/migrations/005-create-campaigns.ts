import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('campaigns', {
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
    meta_campaign_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    objective: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    buying_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    special_ad_category: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    daily_budget: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    lifetime_budget: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    stop_time: {
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

  await queryInterface.addIndex('campaigns', ['ad_account_id']);
  await queryInterface.addIndex('campaigns', ['meta_campaign_id']);
  await queryInterface.addIndex('campaigns', ['status']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('campaigns');
}
