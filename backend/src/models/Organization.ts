import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

interface OrganizationAttributes {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'agency';
  max_ad_accounts: number;
  max_daily_syncs: number;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  subscription_ends_at?: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface OrganizationCreationAttributes extends Optional<OrganizationAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Organization extends Model<OrganizationAttributes, OrganizationCreationAttributes> implements OrganizationAttributes {
  public id!: string;
  public name!: string;
  public slug!: string;
  public plan!: 'free' | 'pro' | 'agency';
  public max_ad_accounts!: number;
  public max_daily_syncs!: number;
  public stripe_customer_id!: string | null;
  public stripe_subscription_id!: string | null;
  public subscription_status!: string | null;
  public subscription_ends_at!: Date | null;
  public is_active!: boolean;
  public created_at!: Date;
  public updated_at!: Date;
}

Organization.init(
  {
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
  },
  {
    sequelize,
    tableName: 'organizations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default Organization;
