import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Organization from './Organization';

interface OptimizationRuleAttributes {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  rule_type: 'pause_ad' | 'duplicate_ad' | 'increase_budget' | 'decrease_budget';
  is_active: boolean;
  conditions: string;
  actions: string;
  priority: number;
  min_spend_threshold: number;
  min_impressions_threshold: number;
  evaluation_period_days: number;
  created_at: Date;
  updated_at: Date;
}

interface OptimizationRuleCreationAttributes extends Optional<OptimizationRuleAttributes, 'id' | 'created_at' | 'updated_at'> {}

class OptimizationRule extends Model<OptimizationRuleAttributes, OptimizationRuleCreationAttributes> implements OptimizationRuleAttributes {
  public id!: string;
  public organization_id!: string;
  public name!: string;
  public description!: string | null;
  public rule_type!: 'pause_ad' | 'duplicate_ad' | 'increase_budget' | 'decrease_budget';
  public is_active!: boolean;
  public conditions!: string;
  public actions!: string;
  public priority!: number;
  public min_spend_threshold!: number;
  public min_impressions_threshold!: number;
  public evaluation_period_days!: number;
  public created_at!: Date;
  public updated_at!: Date;

  // Associations
  public organization?: Organization;
}

OptimizationRule.init(
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rule_type: {
      type: DataTypes.ENUM('pause_ad', 'duplicate_ad', 'increase_budget', 'decrease_budget'),
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    conditions: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    actions: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    min_spend_threshold: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false,
    },
    min_impressions_threshold: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
      allowNull: false,
    },
    evaluation_period_days: {
      type: DataTypes.INTEGER,
      defaultValue: 7,
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
    tableName: 'optimization_rules',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default OptimizationRule;
