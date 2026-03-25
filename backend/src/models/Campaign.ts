import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import AdAccount from './AdAccount';

interface CampaignAttributes {
  id: string;
  ad_account_id: string;
  meta_campaign_id: string;
  name: string;
  objective?: string | null;
  status: string;
  buying_type?: string | null;
  special_ad_category?: string | null;
  daily_budget?: number | null;
  lifetime_budget?: number | null;
  start_time?: Date | null;
  stop_time?: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface CampaignCreationAttributes extends Optional<CampaignAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Campaign extends Model<CampaignAttributes, CampaignCreationAttributes> implements CampaignAttributes {
  public id!: string;
  public ad_account_id!: string;
  public meta_campaign_id!: string;
  public name!: string;
  public objective!: string | null;
  public status!: string;
  public buying_type!: string | null;
  public special_ad_category!: string | null;
  public daily_budget!: number | null;
  public lifetime_budget!: number | null;
  public start_time!: Date | null;
  public stop_time!: Date | null;
  public is_active!: boolean;
  public created_at!: Date;
  public updated_at!: Date;

  // Associations
  public adAccount?: AdAccount;
}

Campaign.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ad_account_id: {
      type: DataTypes.UUID,
      allowNull: false,
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
  },
  {
    sequelize,
    tableName: 'campaigns',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default Campaign;
