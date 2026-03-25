export interface AggregateMetrics {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversionValue: number;
}

export interface PerformanceMetrics extends AggregateMetrics {
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
  frequency: number;
}

export interface InsightLike {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
}

export function emptyAggregateMetrics(): AggregateMetrics {
  return {
    impressions: 0,
    reach: 0,
    clicks: 0,
    spend: 0,
    conversions: 0,
    conversionValue: 0,
  };
}

export function aggregateInsightMetrics(insights: InsightLike[]): AggregateMetrics {
  return insights.reduce(
    (acc, insight) => ({
      impressions: acc.impressions + Number(insight.impressions || 0),
      reach: acc.reach + Number(insight.reach || 0),
      clicks: acc.clicks + Number(insight.clicks || 0),
      spend: acc.spend + Number(insight.spend || 0),
      conversions: acc.conversions + Number(insight.conversions || 0),
      conversionValue: acc.conversionValue + Number(insight.conversion_value || 0),
    }),
    emptyAggregateMetrics()
  );
}

export function calculatePerformanceMetrics(aggregate: AggregateMetrics): PerformanceMetrics {
  return {
    ...aggregate,
    ctr: aggregate.impressions > 0 ? aggregate.clicks / aggregate.impressions : 0,
    cpc: aggregate.clicks > 0 ? aggregate.spend / aggregate.clicks : 0,
    cpm: aggregate.impressions > 0 ? (aggregate.spend / aggregate.impressions) * 1000 : 0,
    cpa: aggregate.conversions > 0 ? aggregate.spend / aggregate.conversions : 0,
    roas: aggregate.spend > 0 ? aggregate.conversionValue / aggregate.spend : 0,
    frequency: aggregate.reach > 0 ? aggregate.impressions / aggregate.reach : 0,
  };
}
