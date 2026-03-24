import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Organization from './Organization';
import AdAccount from './AdAccount';
import OptimizationRule from './OptimizationRule';
import User from './User';

interface OptimizationSuggestionAttributes {
  id: string;
  organization_id: string;
  ad_account_id: string;
  rule_id?: string | null;
  entity_type: 'campaign' | 'ad_set' | 'ad';
  entity_id: string;
  meta_entity_id: string;
  suggestion_type: 'pause' | 'duplicate' | 'increase_budget' | 'decrease_budget' | 'modify_targeting' | 'modify_creative';
  title: string;
  description: string;
  reason: string;
  expected_impact?: string | null;
  confidence_score?: number | null;
  current_metrics?: string | null;
  proposed_changes?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'executed' | 'expired';
  reviewed_by?: string | null;
  reviewed_at?: Date | null;
  executed_at?: Date | null;
  expires_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface OptimizationSuggestionCreationAttributes extends Optional<OptimizationSuggestionAttributes, 'id' | 'created_at' | 'updated_at'> {}

class OptimizationSuggestion extends Model<OptimizationSuggestionAttributes, OptimizationSuggestionCreationAttributes> implements OptimizationSuggestionAttributes {
  public id!: string;
  public organization_id!: string;
  public ad_account_id!: string;
  public rule_id!: string | null;
  public entity_type!: 'campaign' | 'ad_set' | 'ad';
  public entity_id!: string;
  public meta_entity_id!: string;
  public suggestion_type!: 'pause' | 'duplicate' | 'increase_budget' | 'decrease_budget' | 'modify_targeting' | 'modify_creative';
  public title!: string;
  public description!: string;
  public reason!: string;
  public expected_impact!: string | null;
  public confidence_score!: number | null;
  public current_metrics!: string | null;
  public proposed_changes!: string | null;
  public status!: 'pending' | 'accepted' | 'rejected' | 'executed' | 'expired';
  public reviewed_by!: string | null;
  public reviewed_at!: Date | null;
  public executed_at!: Date | null;
  public expires_at!: Date | null;
  public created_at!: Date;
  public updated_at!: Date;

  // Associations
  public organization?: Organization;
  public ad_account?: AdAccount;
  public rule?: OptimizationRule;
  public reviewer?: User;
}

OptimizationSuggestion.init(
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
    ad_account_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    rule_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    entity_type: {
      type: DataTypes.ENUM('campaign', 'ad_set', 'ad'),
      allowNull: false,
    },
    entity_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    meta_entity_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    suggestion_type: {
      type: DataTypes.ENUM('pause', 'duplicate', 'increase_budget', 'decrease_budget', 'modify_targeting', 'modify_creative'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    expected_impact: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    confidence_score: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true,
    },
    current_metrics: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    proposed_changes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'executed', 'expired'),
      defaultValue: 'pending',
      allowNull: false,
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    executed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
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
    tableName: 'optimization_suggestions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default OptimizationSuggestion;
