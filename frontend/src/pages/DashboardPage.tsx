import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { DollarSign, Eye, MousePointer, Target, TrendingUp, Users } from 'lucide-react';
import { dashboardAPI, adAccountAPI } from '../services/api';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { Button } from '../components/Button';
import type { Insight, AdAccount, MetaAvailableAdAccount } from '../types';

interface Overview {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  total_revenue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

interface OverviewComparison {
  spend_change_pct: number;
  impressions_change_pct: number;
  clicks_change_pct: number;
  conversions_change_pct: number;
  revenue_change_pct: number;
  ctr_change_pct: number;
  cpc_change_pct: number;
  cpa_change_pct: number;
  roas_change_pct: number;
}

interface DashboardMeta {
  source_level: 'account' | 'campaign' | 'ad';
  window_days: number;
  compared_window_days?: number;
  period?: string;
  compared_period?: string;
  last_synced_at?: string | null;
}

const META_OAUTH_STATE_KEY = 'meta_oauth_state';
const META_OAUTH_TOKEN_KEY = 'meta_oauth_access_token';
const META_OAUTH_RETURN_PATH_KEY = 'meta_oauth_return_path';

export function DashboardPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewComparison, setOverviewComparison] = useState<OverviewComparison | null>(null);
  const [overviewMeta, setOverviewMeta] = useState<DashboardMeta | null>(null);
  const [performanceData, setPerformanceData] = useState<Insight[]>([]);
  const [performanceMeta, setPerformanceMeta] = useState<DashboardMeta | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<number>(0);
  const [selectedDays, setSelectedDays] = useState(30);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [syncingAllAccounts, setSyncingAllAccounts] = useState(false);

  const [showConnectForm, setShowConnectForm] = useState(false);
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [manualAccountId, setManualAccountId] = useState('');
  const [availableMetaAccounts, setAvailableMetaAccounts] = useState<MetaAvailableAdAccount[]>([]);
  const [selectedMetaAccountId, setSelectedMetaAccountId] = useState('');
  const [loadingMetaAccounts, setLoadingMetaAccounts] = useState(false);
  const [connectingAccount, setConnectingAccount] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectMessage, setConnectMessage] = useState<string | null>(null);

  const metaAppId = import.meta.env.VITE_META_APP_ID || '';
  const metaRedirectUri = import.meta.env.VITE_META_REDIRECT_URI || `${window.location.origin}/meta/callback`;
  const metaScopes =
    import.meta.env.VITE_META_SCOPES || 'ads_management,ads_read,business_management';

  const clearConnectAlerts = () => {
    setConnectError(null);
    setConnectMessage(null);
  };

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, performanceRes, accountsRes] = await Promise.all([
        dashboardAPI.getOverview(selectedDays),
        dashboardAPI.getPerformance(selectedDays),
        adAccountAPI.list(),
      ]);

      const overviewData = overviewRes.data as {
        overview: Overview;
        comparison?: OverviewComparison;
        meta?: DashboardMeta;
        pending_suggestions?: number;
      };
      const performancePayload = performanceRes.data as {
        data: Insight[];
        meta?: DashboardMeta;
      };

      setOverview(overviewData.overview);
      setOverviewComparison(overviewData.comparison || null);
      setOverviewMeta(overviewData.meta || null);
      setPendingSuggestions(overviewData.pending_suggestions || 0);
      setPerformanceMeta(performancePayload.meta || null);
      setPerformanceData(performancePayload.data);
      setAdAccounts(accountsRes.data.accounts);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDays]);

  const loadMetaAccounts = useCallback(
    async (tokenOverride?: string) => {
      const tokenToUse = (tokenOverride ?? metaAccessToken).trim();
      clearConnectAlerts();

      if (!tokenToUse) {
        setConnectError('Informe um access token do Meta para listar as contas.');
        return;
      }

      setLoadingMetaAccounts(true);
      try {
        const response = await adAccountAPI.getMetaAccounts(tokenToUse);
        const accounts = response.data.accounts;
        setAvailableMetaAccounts(accounts);

        if (accounts.length > 0) {
          setSelectedMetaAccountId(accounts[0].id);
          setManualAccountId(accounts[0].id);
          setConnectMessage('Contas carregadas. Escolha a conta e confirme a conexão.');
        } else {
          setSelectedMetaAccountId('');
          setManualAccountId('');
          setConnectError('Nenhuma conta de anúncio disponível para este token.');
        }
      } catch (error) {
        const errorMessage =
          (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
          'Não foi possível carregar contas do Meta.';
        setConnectError(errorMessage);
      } finally {
        setLoadingMetaAccounts(false);
      }
    },
    [metaAccessToken]
  );

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const oauthAccessToken = sessionStorage.getItem(META_OAUTH_TOKEN_KEY);
    if (!oauthAccessToken) {
      return;
    }

    sessionStorage.removeItem(META_OAUTH_TOKEN_KEY);
    setShowConnectForm(true);
    setMetaAccessToken(oauthAccessToken);
    void loadMetaAccounts(oauthAccessToken);

    if (window.location.search) {
      navigate('/', { replace: true });
    }
  }, [loadMetaAccounts, navigate]);

  const handleStartMetaOAuth = () => {
    clearConnectAlerts();

    if (!metaAppId) {
      setConnectError('Configure VITE_META_APP_ID para iniciar o OAuth do Meta.');
      return;
    }

    const oauthState =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    localStorage.setItem(META_OAUTH_STATE_KEY, oauthState);
    localStorage.setItem(META_OAUTH_RETURN_PATH_KEY, '/?meta_oauth=success');

    const params = new URLSearchParams({
      client_id: metaAppId,
      redirect_uri: metaRedirectUri,
      response_type: 'token',
      scope: metaScopes,
      state: oauthState,
    });

    window.location.assign(`https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`);
  };

  const handleConnectAccount = async () => {
    clearConnectAlerts();

    const tokenToUse = metaAccessToken.trim();
    const accountIdToUse = selectedMetaAccountId || manualAccountId.trim();

    if (!tokenToUse) {
      setConnectError('Informe o access token do Meta para conectar a conta.');
      return;
    }

    if (!accountIdToUse) {
      setConnectError('Selecione ou informe o ID da conta de anúncios.');
      return;
    }

    setConnectingAccount(true);
    try {
      await adAccountAPI.connect({
        accessToken: tokenToUse,
        accountId: accountIdToUse,
      });

      setConnectMessage('Conta conectada com sucesso. A sincronização inicial foi iniciada.');
      setShowConnectForm(false);
      setMetaAccessToken('');
      setManualAccountId('');
      setSelectedMetaAccountId('');
      setAvailableMetaAccounts([]);
      await loadDashboardData();
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Não foi possível conectar a conta.';
      setConnectError(errorMessage);
    } finally {
      setConnectingAccount(false);
    }
  };

  const handleSync = async (id: string) => {
    setSyncingAccountId(id);
    try {
      await adAccountAPI.sync(id);
      await loadDashboardData();
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setSyncingAccountId(null);
    }
  };

  const handleSyncAll = async () => {
    if (adAccounts.length === 0) {
      return;
    }

    setSyncingAllAccounts(true);
    try {
      for (const account of adAccounts) {
        try {
          await adAccountAPI.sync(account.id);
        } catch (error) {
          console.error(`Error syncing account ${account.id}:`, error);
        }
      }
      await loadDashboardData();
    } finally {
      setSyncingAllAccounts(false);
    }
  };

  const handleCampaignDrillDown = (metric: 'spend' | 'impressions' | 'clicks' | 'conversions') => {
    navigate(`/campaigns?sort=${metric}&order=desc&days=${selectedDays}`);
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
          {overviewMeta && (
            <>
              <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-medium">
                Fonte: {overviewMeta.source_level}
              </span>
              <span className="rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-xs font-medium">
                Janela: {overviewMeta.window_days}d
              </span>
              <span className="rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-xs font-medium">
                Última sync:{' '}
                {overviewMeta.last_synced_at
                  ? new Date(overviewMeta.last_synced_at).toLocaleString()
                  : 'Nunca'}
              </span>
            </>
          )}
          <select
            value={selectedDays}
            onChange={(e) => setSelectedDays(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value={7}>Ultimos 7 dias</option>
            <option value={30}>Ultimos 30 dias</option>
            <option value={90}>Ultimos 90 dias</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Gasto Total"
          value={`R$ ${overview?.total_spend?.toFixed(2) || '0,00'}`}
          icon={<DollarSign className="h-6 w-6" />}
          change={overviewComparison?.spend_change_pct}
          onClick={() => handleCampaignDrillDown('spend')}
          actionLabel="Ver campanhas com maior gasto"
        />
        <MetricCard
          title="Impressoes"
          value={overview?.total_impressions?.toLocaleString() || '0'}
          icon={<Eye className="h-6 w-6" />}
          change={overviewComparison?.impressions_change_pct}
          onClick={() => handleCampaignDrillDown('impressions')}
          actionLabel="Ver campanhas com mais impressões"
        />
        <MetricCard
          title="Cliques"
          value={overview?.total_clicks?.toLocaleString() || '0'}
          icon={<MousePointer className="h-6 w-6" />}
          change={overviewComparison?.clicks_change_pct}
          onClick={() => handleCampaignDrillDown('clicks')}
          actionLabel="Ver campanhas com mais cliques"
        />
        <MetricCard
          title="Conversoes"
          value={overview?.total_conversions?.toLocaleString() || '0'}
          icon={<Target className="h-6 w-6" />}
          change={overviewComparison?.conversions_change_pct}
          onClick={() => handleCampaignDrillDown('conversions')}
          actionLabel="Ver campanhas com mais conversões"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">CTR</p>
              <p className="text-2xl font-bold text-gray-900">{overview?.ctr?.toFixed(2) || '0'}%</p>
              {overviewComparison && (
                <p className="text-xs text-gray-500 mt-1">
                  {overviewComparison.ctr_change_pct >= 0 ? '+' : ''}
                  {overviewComparison.ctr_change_pct.toFixed(1)}% vs período anterior
                </p>
              )}
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">CPC</p>
              <p className="text-2xl font-bold text-gray-900">R$ {overview?.cpc?.toFixed(2) || '0,00'}</p>
              {overviewComparison && (
                <p className="text-xs text-gray-500 mt-1">
                  {overviewComparison.cpc_change_pct >= 0 ? '+' : ''}
                  {overviewComparison.cpc_change_pct.toFixed(1)}% vs período anterior
                </p>
              )}
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ROAS</p>
              <p className="text-2xl font-bold text-gray-900">{overview?.roas?.toFixed(2) || '0'}x</p>
              {overviewComparison && (
                <p className="text-xs text-gray-500 mt-1">
                  {overviewComparison.roas_change_pct >= 0 ? '+' : ''}
                  {overviewComparison.roas_change_pct.toFixed(1)}% vs período anterior
                </p>
              )}
            </div>
            <TrendingUp className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
      </div>

      <Card title="Desempenho ao Longo do Tempo" description="Gasto e conversoes por dia">
        {performanceMeta && (
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-medium">
              Fonte: {performanceMeta.source_level}
            </span>
            <span className="rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-xs font-medium">
              Período: {performanceMeta.period || `${selectedDays} dias`}
            </span>
          </div>
        )}
        {performanceData.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
            <p className="text-sm text-gray-600">
              Sem dados suficientes para o período selecionado.
            </p>
            {adAccounts.length > 0 && (
              <Button
                className="mt-3"
                variant="secondary"
                onClick={handleSyncAll}
                isLoading={syncingAllAccounts}
              >
                Sincronizar agora
              </Button>
            )}
          </div>
        ) : (
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
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="conversions"
                  stroke="#16a34a"
                  name="Conversoes"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card
        title="Contas de Anuncios"
        description="Contas conectadas ao Meta Ads"
        action={
          <Button size="sm" onClick={() => setShowConnectForm((prev) => !prev)}>
            <Users className="h-4 w-4 mr-2" />
            Conectar Nova Conta
          </Button>
        }
      >
        {connectMessage && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {connectMessage}
          </div>
        )}
        {connectError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {connectError}
          </div>
        )}

        {showConnectForm && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
            <details className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-blue-900">
                Help: como conectar via OAuth Meta
              </summary>
              <div className="mt-3 text-sm text-blue-900 space-y-2">
                <p className="font-medium">Passo a passo:</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Clique em "Conectar via OAuth Meta".</li>
                  <li>Faça login no Facebook/Meta e autorize os escopos solicitados.</li>
                  <li>Voce sera redirecionado para esta pagina automaticamente.</li>
                  <li>Clique em "Buscar Contas", selecione a conta e confirme em "Confirmar Conexao".</li>
                </ol>
                <p>
                  Se o botao OAuth nao abrir, valide as variaveis de ambiente
                  {' '}
                  <code>VITE_META_APP_ID</code>
                  {' '}
                  e
                  {' '}
                  <code>VITE_META_REDIRECT_URI</code>.
                </p>
                <p>
                  Se o callback falhar, confira se a URL de callback da Meta esta igual a
                  {' '}
                  <code>/meta/callback</code>
                  {' '}
                  no frontend.
                </p>
              </div>
            </details>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleStartMetaOAuth}>
                Conectar via OAuth Meta
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void loadMetaAccounts()}
                isLoading={loadingMetaAccounts}
                disabled={!metaAccessToken.trim()}
              >
                Buscar Contas
              </Button>
            </div>

            <div className="space-y-2">
              <label htmlFor="metaAccessToken" className="block text-sm font-medium text-gray-700">
                Access Token Meta
              </label>
              <input
                id="metaAccessToken"
                type="text"
                value={metaAccessToken}
                onChange={(e) => setMetaAccessToken(e.target.value)}
                placeholder="EAAB..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {availableMetaAccounts.length > 0 ? (
              <div className="space-y-2">
                <label htmlFor="metaAccountSelect" className="block text-sm font-medium text-gray-700">
                  Conta de anuncios
                </label>
                <select
                  id="metaAccountSelect"
                  value={selectedMetaAccountId}
                  onChange={(e) => {
                    setSelectedMetaAccountId(e.target.value);
                    setManualAccountId(e.target.value);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {availableMetaAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.meta_account_id}) - {account.currency}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="manualAccountId" className="block text-sm font-medium text-gray-700">
                  ID da conta de anuncios
                </label>
                <input
                  id="manualAccountId"
                  type="text"
                  value={manualAccountId}
                  onChange={(e) => setManualAccountId(e.target.value)}
                  placeholder="act_1234567890 ou 1234567890"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleConnectAccount} isLoading={connectingAccount}>
                Confirmar Conexao
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowConnectForm(false);
                  setAvailableMetaAccounts([]);
                  setSelectedMetaAccountId('');
                  clearConnectAlerts();
                }}
              >
                Fechar
              </Button>
            </div>
          </div>
        )}

        {adAccounts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Nenhuma conta conectada ainda</div>
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
                    Ultima sincronizacao:{' '}
                    {account.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : 'Nunca'}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleSync(account.id)}
                  isLoading={syncingAccountId === account.id}
                >
                  Sincronizar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Sugestoes Pendentes" description="Otimizacoes recomendadas pela IA">
        {pendingSuggestions > 0 ? (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-4">
            <p className="text-sm text-yellow-800">
              Você tem {pendingSuggestions} sugestão(ões) pendente(s) para revisar.
            </p>
            <Button className="mt-3" size="sm" onClick={() => navigate('/optimization')}>
              Abrir Otimização
            </Button>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Sem sugestões pendentes no momento.</p>
            <p className="text-sm mt-1">Sincronize as contas e execute análise para gerar novas recomendações.</p>
            <div className="mt-3 flex justify-center gap-2">
              {adAccounts.length > 0 && (
                <Button size="sm" variant="secondary" onClick={handleSyncAll} isLoading={syncingAllAccounts}>
                  Sincronizar agora
                </Button>
              )}
              <Button size="sm" onClick={() => navigate('/optimization')}>
                Executar análise
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
