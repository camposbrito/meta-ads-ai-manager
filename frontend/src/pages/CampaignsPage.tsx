import { Fragment, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, ChevronDown, ChevronRight } from 'lucide-react';
import { dashboardAPI } from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import type { Ad, Campaign } from '../types';
import { useI18n } from '../contexts/I18nContext';

export function CampaignsPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedDays, setSelectedDays] = useState<number>(() => {
    const parsed = Number.parseInt(searchParams.get('days') || '30', 10);
    return [7, 30, 90].includes(parsed) ? parsed : 30;
  });
  const [expandedCampaignIds, setExpandedCampaignIds] = useState<Record<string, boolean>>({});
  const [campaignAds, setCampaignAds] = useState<Record<string, Ad[]>>({});
  const [loadingCampaignAds, setLoadingCampaignAds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void loadCampaigns(selectedDays);
  }, [selectedDays]);

  const loadCampaigns = async (days: number) => {
    try {
      const response = await dashboardAPI.getCampaigns(days);
      setCampaigns(response.data.campaigns);
      setExpandedCampaignIds({});
      setCampaignAds({});
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = filter === 'all'
    ? campaigns
    : campaigns.filter((c) => (c.status || '').toLowerCase() === filter.toLowerCase());

  const sortField = searchParams.get('sort');
  const sortOrder = searchParams.get('order') === 'asc' ? 'asc' : 'desc';

  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    if (!sortField) {
      return 0;
    }

    const getNumericValue = (campaign: Campaign): number => {
      switch (sortField) {
        case 'spend':
          return Number(campaign.spend || 0);
        case 'impressions':
          return Number(campaign.impressions || 0);
        case 'clicks':
          return Number(campaign.clicks || 0);
        case 'conversions':
          return Number(campaign.conversions || 0);
        default:
          return 0;
      }
    };

    const aValue = getNumericValue(a);
    const bValue = getNumericValue(b);
    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const groupedCampaigns = sortedCampaigns.reduce<Record<string, Campaign[]>>((acc, campaign) => {
    const key = `${campaign.ad_account_id || 'no-account'}::${campaign.ad_account_name || 'Conta desconhecida'}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(campaign);
    return acc;
  }, {});

  const accountGroups = Object.entries(groupedCampaigns)
    .map(([key, accountCampaigns]) => {
      const [, accountName] = key.split('::');
      return {
        key,
        accountName,
        campaigns: accountCampaigns,
      };
    })
    .sort((a, b) => a.accountName.localeCompare(b.accountName));

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'paused':
        return 'bg-yellow-100 text-yellow-700';
      case 'deleted':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const formatCurrency = (value: number | string | null | undefined) => {
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return '-';
    }

    return `R$ ${parsed.toFixed(2)}`;
  };

  const formatInteger = (value: number | null | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return '-';
    }

    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const formatPercentage = (value: number | null | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return '-';
    }

    return `${value.toFixed(2)}%`;
  };

  const toggleCampaignDetails = async (campaign: Campaign) => {
    const isExpanded = Boolean(expandedCampaignIds[campaign.id]);
    setExpandedCampaignIds((prev) => ({ ...prev, [campaign.id]: !isExpanded }));

    if (isExpanded || campaignAds[campaign.id] || loadingCampaignAds[campaign.id]) {
      return;
    }

    setLoadingCampaignAds((prev) => ({ ...prev, [campaign.id]: true }));
    try {
      const response = await dashboardAPI.getCampaignAds(campaign.id, selectedDays);
      setCampaignAds((prev) => ({ ...prev, [campaign.id]: response.data.ads }));
    } catch (error) {
      console.error('Error loading campaign ads:', error);
      setCampaignAds((prev) => ({ ...prev, [campaign.id]: [] }));
    } finally {
      setLoadingCampaignAds((prev) => ({ ...prev, [campaign.id]: false }));
    }
  };

  const renderAdsDetails = (campaign: Campaign) => {
    const isExpanded = Boolean(expandedCampaignIds[campaign.id]);
    if (!isExpanded) {
      return null;
    }

    const isLoadingAds = Boolean(loadingCampaignAds[campaign.id]);
    const ads = campaignAds[campaign.id] || [];

    return (
      <tr>
        <td colSpan={13} className="bg-gray-50 px-4 py-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm font-medium text-gray-800 mb-3">Anúncios da campanha</p>
            {isLoadingAds ? (
              <div className="text-sm text-gray-500">Carregando anúncios...</div>
            ) : ads.length === 0 ? (
              <div className="text-sm text-gray-500">Nenhum anúncio com métricas no período selecionado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Anúncio</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Status</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Gasto</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Imp.</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Cliques</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">CTR</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">CPC</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Conv.</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ads.map((ad) => (
                      <tr key={ad.id} className="border-b border-gray-50">
                        <td className="py-2 px-2 text-sm text-gray-700">
                          <p className="font-medium">{ad.name}</p>
                          {ad.headline && <p className="text-xs text-gray-500">{ad.headline}</p>}
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-600">{ad.status}</td>
                        <td className="py-2 px-2 text-xs text-gray-600">{formatCurrency(ad.spend)}</td>
                        <td className="py-2 px-2 text-xs text-gray-600">{formatInteger(ad.impressions)}</td>
                        <td className="py-2 px-2 text-xs text-gray-600">{formatInteger(ad.clicks)}</td>
                        <td className="py-2 px-2 text-xs text-gray-600">{formatPercentage(ad.ctr)}</td>
                        <td className="py-2 px-2 text-xs text-gray-600">{formatCurrency(ad.cpc)}</td>
                        <td className="py-2 px-2 text-xs text-gray-600">{formatInteger(ad.conversions)}</td>
                        <td className="py-2 px-2 text-xs text-gray-600">
                          {typeof ad.roas === 'number' && Number.isFinite(ad.roas) ? ad.roas.toFixed(2) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const renderCampaignTable = (campaignList: Campaign[]) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Campanha</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Objetivo</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Orçamento Diário</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Gasto ({selectedDays}d)</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Impressões</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Cliques</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">CTR</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">CPC</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Conversões</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">ROAS</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Conta</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {campaignList.map((campaign) => (
            <Fragment key={campaign.id}>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <p className="font-medium text-gray-900">{campaign.name}</p>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(campaign.status)}`}
                  >
                    {campaign.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">{campaign.objective || '-'}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(campaign.daily_budget)}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(campaign.spend)}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{formatInteger(campaign.impressions)}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{formatInteger(campaign.clicks)}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{formatPercentage(campaign.ctr)}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{formatCurrency(campaign.cpc)}</td>
                <td className="py-3 px-4 text-sm text-gray-600">{formatInteger(campaign.conversions)}</td>
                <td className="py-3 px-4 text-sm text-gray-600">
                  {typeof campaign.roas === 'number' && Number.isFinite(campaign.roas)
                    ? campaign.roas.toFixed(2)
                    : '-'}
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">{campaign.ad_account_name || '-'}</td>
                <td className="py-3 px-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void toggleCampaignDetails(campaign)}
                    isLoading={Boolean(loadingCampaignAds[campaign.id])}
                  >
                    {expandedCampaignIds[campaign.id] ? (
                      <ChevronDown className="h-4 w-4 mr-1" />
                    ) : (
                      <ChevronRight className="h-4 w-4 mr-1" />
                    )}
                    {expandedCampaignIds[campaign.id] ? 'Ocultar' : 'Ver anúncios'}
                  </Button>
                </td>
              </tr>
              {renderAdsDetails(campaign)}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortField && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Lista ordenada por <strong>{sortField}</strong> ({sortOrder === 'asc' ? 'crescente' : 'decrescente'}).
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('campaigns.title', 'Campanhas')}</h1>

        <div className="flex items-center gap-2">
          <select
            value={selectedDays}
            onChange={(e) => {
              const days = Number(e.target.value);
              setSelectedDays(days);
              const nextParams = new URLSearchParams(searchParams);
              nextParams.set('days', String(days));
              setSearchParams(nextParams, { replace: true });
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">Todas</option>
            <option value="active">Ativas</option>
            <option value="paused">Pausadas</option>
            <option value="deleted">Excluídas</option>
          </select>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Nenhuma campanha</h3>
            <p className="text-gray-500 mt-1">
              Conecte uma conta do Meta Ads para visualizar suas campanhas.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {accountGroups.map((group) => (
            <Card
              key={group.key}
              title={group.accountName}
              description={`${group.campaigns.length} campanha(s) no período selecionado`}
            >
              {renderCampaignTable(group.campaigns)}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
