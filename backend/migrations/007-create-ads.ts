import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('ads', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ad_set_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'ad_sets',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    meta_ad_id: {
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
    creative_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ad_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    headline: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    primary_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    call_to_action: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    link_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    video_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    thumbnail_url: {
      type: DataTypes.TEXT,
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

  await queryInterface.addIndex('ads', ['ad_set_id']);
  await queryInterface.addIndex('ads', ['meta_ad_id']);
  await queryInterface.addIndex('ads', ['status']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('ads');
}
