import sequelize from '../config/database';
import Organization from './Organization';
import User from './User';
import RefreshToken from './RefreshToken';
import AdAccount from './AdAccount';
import Campaign from './Campaign';
import AdSet from './AdSet';
import Ad from './Ad';
import Insight from './Insight';
import OptimizationRule from './OptimizationRule';
import OptimizationSuggestion from './OptimizationSuggestion';
import ExecutedAction from './ExecutedAction';
import SyncJob from './SyncJob';
import Ga4Integration from './Ga4Integration';

// Organization associations
Organization.hasMany(User, { foreignKey: 'organization_id', as: 'users' });
Organization.hasMany(AdAccount, { foreignKey: 'organization_id', as: 'adAccounts' });
Organization.hasMany(OptimizationRule, { foreignKey: 'organization_id', as: 'optimizationRules' });
Organization.hasMany(OptimizationSuggestion, { foreignKey: 'organization_id', as: 'optimizationSuggestions' });
Organization.hasMany(ExecutedAction, { foreignKey: 'organization_id', as: 'executedActions' });
Organization.hasOne(Ga4Integration, { foreignKey: 'organization_id', as: 'ga4Integration' });
User.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
AdAccount.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
OptimizationRule.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
OptimizationSuggestion.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
ExecutedAction.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });
Ga4Integration.belongsTo(Organization, { foreignKey: 'organization_id', as: 'organization' });

// User associations
User.hasMany(RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens' });
User.hasMany(OptimizationSuggestion, { foreignKey: 'reviewed_by', as: 'reviewedSuggestions' });
User.hasMany(ExecutedAction, { foreignKey: 'executed_by', as: 'executedActions' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
OptimizationSuggestion.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });
ExecutedAction.belongsTo(User, { foreignKey: 'executed_by', as: 'executor' });

// AdAccount associations
AdAccount.hasMany(Campaign, { foreignKey: 'ad_account_id', as: 'campaigns' });
AdAccount.hasMany(Insight, { foreignKey: 'ad_account_id', as: 'insights' });
AdAccount.hasMany(OptimizationSuggestion, { foreignKey: 'ad_account_id', as: 'optimizationSuggestions' });
AdAccount.hasMany(ExecutedAction, { foreignKey: 'ad_account_id', as: 'executedActions' });
AdAccount.hasMany(SyncJob, { foreignKey: 'ad_account_id', as: 'syncJobs' });
Campaign.belongsTo(AdAccount, { foreignKey: 'ad_account_id', as: 'adAccount' });
Insight.belongsTo(AdAccount, { foreignKey: 'ad_account_id', as: 'adAccount' });
OptimizationSuggestion.belongsTo(AdAccount, { foreignKey: 'ad_account_id', as: 'adAccount' });
ExecutedAction.belongsTo(AdAccount, { foreignKey: 'ad_account_id', as: 'adAccount' });
SyncJob.belongsTo(AdAccount, { foreignKey: 'ad_account_id', as: 'adAccount' });

// Campaign associations
Campaign.hasMany(AdSet, { foreignKey: 'campaign_id', as: 'adSets' });
Campaign.hasMany(Insight, { foreignKey: 'campaign_id', as: 'insights' });
AdSet.belongsTo(Campaign, { foreignKey: 'campaign_id', as: 'campaign' });
Insight.belongsTo(Campaign, { foreignKey: 'campaign_id', as: 'campaign' });

// AdSet associations
AdSet.hasMany(Ad, { foreignKey: 'ad_set_id', as: 'ads' });
AdSet.hasMany(Insight, { foreignKey: 'ad_set_id', as: 'insights' });
Ad.belongsTo(AdSet, { foreignKey: 'ad_set_id', as: 'adSet' });
Insight.belongsTo(AdSet, { foreignKey: 'ad_set_id', as: 'adSet' });

// Ad associations
Ad.hasMany(Insight, { foreignKey: 'ad_id', as: 'insights' });
Insight.belongsTo(Ad, { foreignKey: 'ad_id', as: 'ad' });

// OptimizationRule associations
OptimizationRule.hasMany(OptimizationSuggestion, { foreignKey: 'rule_id', as: 'suggestions' });
OptimizationSuggestion.belongsTo(OptimizationRule, { foreignKey: 'rule_id', as: 'rule' });

// OptimizationSuggestion associations
OptimizationSuggestion.hasMany(ExecutedAction, { foreignKey: 'suggestion_id', as: 'executedActions' });
ExecutedAction.belongsTo(OptimizationSuggestion, { foreignKey: 'suggestion_id', as: 'suggestion' });

export {
  sequelize,
  Organization,
  User,
  RefreshToken,
  AdAccount,
  Campaign,
  AdSet,
  Ad,
  Insight,
  OptimizationRule,
  OptimizationSuggestion,
  ExecutedAction,
  SyncJob,
  Ga4Integration,
};

export default sequelize;
