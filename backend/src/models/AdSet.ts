import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Campaign from './Campaign';

interface AdSetAttributes {
  id: string;
  campaign_id: string;
  meta_adset_id: string;
  name: string;
  status: string;
  daily_budget?: number | null;
  lifetime_budget?: number | null;
  bid_amount?: number | null;
  bid_strategy?: string | null;
  optimization_goal?: string | null;
  targeting?: string | null;
  start_time?: Date | null;
  end_time?: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface AdSetCreationAttributes extends Optional<AdSetAttributes, 'id' | 'created_at' | 'updated_at'> {}

class AdSet extends Model<AdSetAttributes, AdSetCreationAttributes> implements AdSetAttributes {
  public id!: string;
  public campaign_id!: string;
  public meta_adset_id!: string;
  public name!: string;
  public status!: string;
  public daily_budget!: number | null;
  public lifetime_budget!: number | null;
  public bid_amount!: number | null;
  public bid_strategy!: string | null;
  public optimization_goal!: string | null;
  public targeting!: string | null;
  public start_time!: Date | null;
  public end_time!: Date | null;
  public is_active!: boolean;
  public created_at!: Date;
  public updated_at!: Date;

  // Associations
  public campaign?: Campaign;
}

AdSet.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    campaign_id: {
      type: DataTypes.UUID,
      allowNull: false,
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
  },
  {
    sequelize,
    tableName: 'ad_sets',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default AdSet;
