import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { DollarSign, Eye, MousePointer, Target, TrendingUp, Users } from 'lucide-react';
import { dashboardAPI, adAccountAPI } from '../services/api';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { Button } from '../components/Button';
import type { Insight, AdAccount } from '../types';

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<Insight[]>([]);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedDays, setSelectedDays] = useState(30);

  useEffect(() => {
    loadDashboardData();
  }, [selectedDays]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [overviewRes, performanceRes, accountsRes] = await Promise.all([
        dashboardAPI.getOverview(selectedDays),
        dashboardAPI.getPerformance(selectedDays),
        adAccountAPI.list(),
      ]);

      setOverview(overviewRes.data.overview);
      setPerformanceData(performanceRes.data.data);
      setAdAccounts(accountsRes.data.accounts);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (id: string) => {
    try {
      await adAccountAPI.sync(id);
      loadDashboardData();
    } catch (error) {
      console.error('Error syncing:', error);
    }
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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center space-x-2">
          <select
            value={selectedDays}
            onChange={(e) => setSelectedDays(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Gasto Total"
          value={`R$ ${overview?.total_spend?.toFixed(2) || '0,00'}`}
          icon={<DollarSign className="h-6 w-6" />}
        />
        <MetricCard
          title="Impressões"
          value={overview?.total_impressions?.toLocaleString() || '0'}
          icon={<Eye className="h-6 w-6" />}
        />
        <MetricCard
          title="Cliques"
          value={overview?.total_clicks?.toLocaleString() || '0'}
          icon={<MousePointer className="h-6 w-6" />}
        />
        <MetricCard
          title="Conversões"
          value={overview?.total_conversions?.toLocaleString() || '0'}
          icon={<Target className="h-6 w-6" />}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">CTR</p>
              <p className="text-2xl font-bold text-gray-900">{overview?.ctr?.toFixed(2) || '0'}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">CPC</p>
              <p className="text-2xl font-bold text-gray-900">R$ {overview?.cpc?.toFixed(2) || '0,00'}</p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ROAS</p>
              <p className="text-2xl font-bold text-gray-900">{overview?.roas?.toFixed(2) || '0'}x</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card title="Desempenho ao Longo do Tempo" description="Gasto e conversões por dia">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="spend" stroke="#2563eb" name="Gasto (R$)" />
              <Line yAxisId="right" type="monotone" dataKey="conversions" stroke="#16a34a" name="Conversões" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Connected Accounts */}
      <Card
        title="Contas de Anúncios"
        description="Contas conectadas ao Meta Ads"
        action={
          <Button size="sm">
            <Users className="h-4 w-4 mr-2" />
            Conectar Nova Conta
          </Button>
        }
      >
        {adAccounts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhuma conta conectada ainda
          </div>
        ) : (
          <div className="space-y-4">
            {adAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{account.name}</p>
                  <p className="text-sm text-gray-500">ID: {account.meta_account_id}</p>
                  <p className="text-xs text-gray-400">
                    Última sincronização: {account.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : 'Nunca'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleSync(account.id)}
                >
                  Sincronizar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pending Suggestions */}
      <Card title="Sugestões Pendentes" description="Otimizações recomendadas pela IA">
        <div className="text-center py-8 text-gray-500">
          Nenhuma sugestão pendente no momento
        </div>
      </Card>
    </div>
  );
}
