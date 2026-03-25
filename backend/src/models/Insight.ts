import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import AdAccount from './AdAccount';
import Campaign from './Campaign';
import AdSet from './AdSet';
import Ad from './Ad';

interface InsightAttributes {
  id: string;
  ad_account_id: string;
  campaign_id?: string | null;
  ad_set_id?: string | null;
  ad_id?: string | null;
  date: string;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  cpa: number;
  roas: number;
  frequency: number;
  created_at: Date;
  updated_at: Date;
}

interface InsightCreationAttributes extends Optional<InsightAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Insight extends Model<InsightAttributes, InsightCreationAttributes> implements InsightAttributes {
  public id!: string;
  public ad_account_id!: string;
  public campaign_id!: string | null;
  public ad_set_id!: string | null;
  public ad_id!: string | null;
  public date!: string;
  public impressions!: number;
  public reach!: number;
  public clicks!: number;
  public ctr!: number;
  public cpc!: number;
  public cpm!: number;
  public spend!: number;
  public conversions!: number;
  public conversion_value!: number;
  public cpa!: number;
  public roas!: number;
  public frequency!: number;
  public created_at!: Date;
  public updated_at!: Date;

  // Associations
  public ad_account?: AdAccount;
  public campaign?: Campaign;
  public adSet?: AdSet;
  public ad?: Ad;
}

Insight.init(
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
    campaign_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    ad_set_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    ad_id: {
      type: DataTypes.UUID,
      allowNull: true,
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
    },
    cpc: {
      type: DataTypes.DECIMAL(15, 4),
      defaultValue: 0,
      allowNull: false,
    },
    cpm: {
      type: DataTypes.DECIMAL(15, 4),
      defaultValue: 0,
      allowNull: false,
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
    },
    roas: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      allowNull: false,
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
  },
  {
    sequelize,
    tableName: 'insights',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default Insight;
