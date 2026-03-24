import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Organization from './Organization';

interface AdAccountAttributes {
  id: string;
  organization_id: string;
  meta_account_id: string;
  meta_business_id?: string | null;
  name: string;
  currency: string;
  access_token_encrypted: string;
  token_expires_at?: Date | null;
  is_active: boolean;
  last_synced_at?: Date | null;
  daily_sync_count: number;
  last_sync_date?: string | null;
  created_at: Date;
  updated_at: Date;
}

interface AdAccountCreationAttributes extends Optional<AdAccountAttributes, 'id' | 'created_at' | 'updated_at'> {}

class AdAccount extends Model<AdAccountAttributes, AdAccountCreationAttributes> implements AdAccountAttributes {
  public id!: string;
  public organization_id!: string;
  public meta_account_id!: string;
  public meta_business_id!: string | null;
  public name!: string;
  public currency!: string;
  public access_token_encrypted!: string;
  public token_expires_at!: Date | null;
  public is_active!: boolean;
  public last_synced_at!: Date | null;
  public daily_sync_count!: number;
  public last_sync_date!: string | null;
  public created_at!: Date;
  public updated_at!: Date;

  // Associations
  public organization?: Organization;
}

AdAccount.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    meta_account_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    meta_business_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(10),
      defaultValue: 'USD',
      allowNull: false,
    },
    access_token_encrypted: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    token_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    last_synced_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    daily_sync_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    last_sync_date: {
      type: DataTypes.DATEONLY,
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
  },
  {
    sequelize,
    tableName: 'ad_accounts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default AdAccount;
