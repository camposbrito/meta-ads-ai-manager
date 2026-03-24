import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('organizations', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    plan: {
      type: DataTypes.ENUM('free', 'pro', 'agency'),
      defaultValue: 'free',
      allowNull: false,
    },
    max_ad_accounts: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
    },
    max_daily_syncs: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
    },
    stripe_customer_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    stripe_subscription_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    subscription_status: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    subscription_ends_at: {
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

  await queryInterface.addIndex('organizations', ['slug']);
  await queryInterface.addIndex('organizations', ['stripe_customer_id']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('organizations');
}
