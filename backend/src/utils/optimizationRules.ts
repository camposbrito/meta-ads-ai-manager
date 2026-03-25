import { AppError } from '../middleware/errorHandler';
import { PerformanceMetrics } from './metrics';

export interface RuleCondition {
  field: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq' | 'between';
  value: number | number[];
}

const fieldMap: Record<string, keyof PerformanceMetrics> = {
  cpa: 'cpa',
  ctr: 'ctr',
  cpc: 'cpc',
  cpm: 'cpm',
  roas: 'roas',
  spend: 'spend',
  conversions: 'conversions',
  impressions: 'impressions',
  clicks: 'clicks',
  frequency: 'frequency',
  reach: 'reach',
};

const emptyMetrics: PerformanceMetrics = {
  impressions: 0,
  reach: 0,
  clicks: 0,
  spend: 0,
  conversions: 0,
  conversionValue: 0,
  ctr: 0,
  cpc: 0,
  cpm: 0,
  cpa: 0,
  roas: 0,
  frequency: 0,
};

export function getMetricValue(metrics: PerformanceMetrics, field: string): number {
  const metricKey = fieldMap[field];
  if (!metricKey) {
    throw new AppError(`Unsupported metric field: ${field}`, 400);
  }

  return Number(metrics[metricKey]);
}

export function evaluateConditions(
  conditions: RuleCondition[],
  metrics: PerformanceMetrics
): boolean {
  return conditions.every((condition) => {
    const value = getMetricValue(metrics, condition.field);

    switch (condition.operator) {
      case 'gt':
        return value > Number(condition.value);
      case 'lt':
        return value < Number(condition.value);
      case 'gte':
        return value >= Number(condition.value);
      case 'lte':
        return value <= Number(condition.value);
      case 'eq':
        return value === Number(condition.value);
      case 'neq':
        return value !== Number(condition.value);
      case 'between': {
        if (!Array.isArray(condition.value) || condition.value.length !== 2) {
          throw new AppError(`Field ${condition.field} requires a [min, max] range`, 400);
        }

        const [min, max] = condition.value.map((item) => Number(item));
        return value >= min && value <= max;
      }
      default:
        throw new AppError(`Unsupported operator: ${String(condition.operator)}`, 400);
    }
  });
}

export function validateRuleConditions(conditions: RuleCondition[]): void {
  conditions.forEach((condition) => {
    getMetricValue(emptyMetrics, condition.field);

    if (condition.operator === 'between') {
      if (!Array.isArray(condition.value) || condition.value.length !== 2) {
        throw new AppError(`Field ${condition.field} requires a [min, max] range`, 400);
      }
      return;
    }

    if (typeof condition.value !== 'number') {
      throw new AppError(`Field ${condition.field} requires a numeric value`, 400);
    }
  });
}
