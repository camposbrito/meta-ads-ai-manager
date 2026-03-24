import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Organization from './Organization';
import AdAccount from './AdAccount';
import OptimizationSuggestion from './OptimizationSuggestion';
import User from './User';

interface ExecutedActionAttributes {
  id: string;
  organization_id: string;
  ad_account_id: string;
  suggestion_id?: string | null;
  action_type: 'pause_ad' | 'pause_adset' | 'pause_campaign' | 'duplicate_ad' | 'increase_budget' | 'decrease_budget' | 'modify_targeting' | 'modify_creative';
  entity_type: 'campaign' | 'ad_set' | 'ad';
  entity_id: string;
  meta_entity_id: string;
  previous_state?: string | null;
  new_state?: string | null;
  executed_by?: string | null;
  execution_method: 'manual' | 'automatic';
  status: 'pending' | 'success' | 'failed' | 'partial';
  meta_response?: string | null;
  error_message?: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ExecutedActionCreationAttributes extends Optional<ExecutedActionAttributes, 'id' | 'created_at' | 'updated_at'> {}

class ExecutedAction extends Model<ExecutedActionAttributes, ExecutedActionCreationAttributes> implements ExecutedActionAttributes {
  public id!: string;
  public organization_id!: string;
  public ad_account_id!: string;
  public suggestion_id!: string | null;
  public action_type!: 'pause_ad' | 'pause_adset' | 'pause_campaign' | 'duplicate_ad' | 'increase_budget' | 'decrease_budget' | 'modify_targeting' | 'modify_creative';
  public entity_type!: 'campaign' | 'ad_set' | 'ad';
  public entity_id!: string;
  public meta_entity_id!: string;
  public previous_state!: string | null;
  public new_state!: string | null;
  public executed_by!: string | null;
  public execution_method!: 'manual' | 'automatic';
  public status!: 'pending' | 'success' | 'failed' | 'partial';
  public meta_response!: string | null;
  public error_message!: string | null;
  public created_at!: Date;
  public updated_at!: Date;

  // Associations
  public organization?: Organization;
  public ad_account?: AdAccount;
  public suggestion?: OptimizationSuggestion;
  public executor?: User;
}

ExecutedAction.init(
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
    suggestion_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    action_type: {
      type: DataTypes.ENUM('pause_ad', 'pause_adset', 'pause_campaign', 'duplicate_ad', 'increase_budget', 'decrease_budget', 'modify_targeting', 'modify_creative'),
      allowNull: false,
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
    previous_state: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    new_state: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    executed_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    execution_method: {
      type: DataTypes.ENUM('manual', 'automatic'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'success', 'failed', 'partial'),
      defaultValue: 'pending',
      allowNull: false,
    },
    meta_response: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    error_message: {
      type: DataTypes.TEXT,
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
    tableName: 'executed_actions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default ExecutedAction;
