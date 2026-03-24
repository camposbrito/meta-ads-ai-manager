import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('insights', {
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
    campaign_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'campaigns',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    ad_set_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'ad_sets',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    ad_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'ads',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    impressions: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      allowNull: false,
    },
    reach: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      allowNull: false,
    },
    clicks: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      allowNull: false,
    },
    ctr: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      allowNull: false,
      comment: 'Click-through rate',
    },
    cpc: {
      type: DataTypes.DECIMAL(15, 4),
      defaultValue: 0,
      allowNull: false,
      comment: 'Cost per click',
    },
    cpm: {
      type: DataTypes.DECIMAL(15, 4),
      defaultValue: 0,
      allowNull: false,
      comment: 'Cost per mille',
    },
    spend: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false,
    },
    conversions: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      allowNull: false,
    },
    conversion_value: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false,
    },
    cpa: {
      type: DataTypes.DECIMAL(15, 4),
      defaultValue: 0,
      allowNull: false,
      comment: 'Cost per action',
    },
    roas: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      allowNull: false,
      comment: 'Return on ad spend',
    },
    frequency: {
      type: DataTypes.DECIMAL(10, 4),
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

  await queryInterface.addIndex('insights', ['ad_account_id']);
  await queryInterface.addIndex('insights', ['campaign_id']);
  await queryInterface.addIndex('insights', ['ad_set_id']);
  await queryInterface.addIndex('insights', ['ad_id']);
  await queryInterface.addIndex('insights', ['date']);
  await queryInterface.addIndex('insights', ['date', 'ad_account_id']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('insights');
}
