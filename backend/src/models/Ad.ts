import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import AdSet from './AdSet';

interface AdAttributes {
  id: string;
  ad_set_id: string;
  meta_ad_id: string;
  name: string;
  status: string;
  creative_type?: string | null;
  ad_type?: string | null;
  headline?: string | null;
  primary_text?: string | null;
  description?: string | null;
  call_to_action?: string | null;
  link_url?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface AdCreationAttributes extends Optional<AdAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Ad extends Model<AdAttributes, AdCreationAttributes> implements AdAttributes {
  public id!: string;
  public ad_set_id!: string;
  public meta_ad_id!: string;
  public name!: string;
  public status!: string;
  public creative_type!: string | null;
  public ad_type!: string | null;
  public headline!: string | null;
  public primary_text!: string | null;
  public description!: string | null;
  public call_to_action!: string | null;
  public link_url!: string | null;
  public image_url!: string | null;
  public video_url!: string | null;
  public thumbnail_url!: string | null;
  public is_active!: boolean;
  public created_at!: Date;
  public updated_at!: Date;

  // Associations
  public ad_set?: AdSet;
}

Ad.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ad_set_id: {
      type: DataTypes.UUID,
      allowNull: false,
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
  },
  {
    sequelize,
    tableName: 'ads',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default Ad;
