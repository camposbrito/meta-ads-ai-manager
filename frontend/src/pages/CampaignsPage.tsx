import { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import { dashboardAPI } from '../services/api';
import { Card } from '../components/Card';
import type { Campaign } from '../types';

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      const response = await dashboardAPI.getCampaigns();
      setCampaigns(response.data.campaigns);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = filter === 'all'
    ? campaigns
    : campaigns.filter((c) => (c.status || '').toLowerCase() === filter.toLowerCase());

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

  const formatDailyBudget = (dailyBudget: Campaign['daily_budget'] | string | null | undefined) => {
    if (dailyBudget === null || dailyBudget === undefined || dailyBudget === '') {
      return '-';
    }

    const parsed = typeof dailyBudget === 'number' ? dailyBudget : Number.parseFloat(dailyBudget);
    if (!Number.isFinite(parsed)) {
      return '-';
    }

    return `R$ ${parsed.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
        
        {/* Filter */}
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
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Nome
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Objetivo
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Orçamento Diário
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">
                    Conta
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{campaign.name}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          campaign.status
                        )}`}
                      >
                        {campaign.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {campaign.objective || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {formatDailyBudget(campaign.daily_budget)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {campaign.ad_account_name || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
