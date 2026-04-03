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
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Eye,
  Loader2,
  MousePointer,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { dashboardAPI, adAccountAPI } from '../services/api';
import { useI18n } from '../contexts/I18nContext';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { Button } from '../components/Button';
import type {
  Insight,
  AdAccount,
  AdAccountSyncStatus,
  MetaAvailableAdAccount,
  SyncJob,
} from '../types';

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

interface SyncFeedback {
  type: 'info' | 'success' | 'error';
  message: string;
}

const META_OAUTH_STATE_KEY = 'meta_oauth_state';
const META_OAUTH_TOKEN_KEY = 'meta_oauth_access_token';
const META_OAUTH_RETURN_PATH_KEY = 'meta_oauth_return_path';

export function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewComparison, setOverviewComparison] = useState<OverviewComparison | null>(null);
  const [overviewMeta, setOverviewMeta] = useState<DashboardMeta | null>(null);
  const [performanceData, setPerformanceData] = useState<Insight[]>([]);
  const [performanceMeta, setPerformanceMeta] = useState<DashboardMeta | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState<number>(0);
  const [selectedDays, setSelectedDays] = useState(30);
  const [syncingAccounts, setSyncingAccounts] = useState<Record<string, boolean>>({});
  const [syncingAllAccounts, setSyncingAllAccounts] = useState(false);
  const [removingAccountId, setRemovingAccountId] = useState<string | null>(null);
  const [syncStatusByAccount, setSyncStatusByAccount] = useState<Record<string, AdAccountSyncStatus>>({});
  const [loadingSyncStatusByAccount, setLoadingSyncStatusByAccount] = useState<Record<string, boolean>>({});
  const [expandedJobsByAccount, setExpandedJobsByAccount] = useState<Record<string, boolean>>({});
  const [syncFeedbackByAccount, setSyncFeedbackByAccount] = useState<Record<string, SyncFeedback | null>>({});

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

  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      }),
    []
  );

  const loadAccountSyncStatus = useCallback(async (accountId: string) => {
    setLoadingSyncStatusByAccount((prev) => ({ ...prev, [accountId]: true }));
    try {
      const response = await adAccountAPI.getSyncStatus(accountId);
      setSyncStatusByAccount((prev) => ({
        ...prev,
        [accountId]: response.data,
      }));
      return response.data;
    } catch (error) {
      console.error(`Error loading sync status for account ${accountId}:`, error);
      return null;
    } finally {
      setLoadingSyncStatusByAccount((prev) => ({ ...prev, [accountId]: false }));
    }
  }, []);

  const loadAllSyncStatus = useCallback(
    async (accounts: AdAccount[]) => {
      if (accounts.length === 0) {
        setSyncStatusByAccount({});
        return;
      }

      await Promise.all(accounts.map((account) => loadAccountSyncStatus(account.id)));
    },
    [loadAccountSyncStatus]
  );

  const getLatestJob = (status: AdAccountSyncStatus | undefined): SyncJob | null => {
    if (!status || !status.recent_jobs || status.recent_jobs.length === 0) {
      return null;
    }

    return status.recent_jobs[0];
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
      await loadAllSyncStatus(accountsRes.data.accounts);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [loadAllSyncStatus, selectedDays]);

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

  useEffect(() => {
    const hasActiveJob =
      Object.values(syncingAccounts).some(Boolean) ||
      Object.values(syncStatusByAccount).some((status) => {
        const latestJob = status.recent_jobs?.[0];
        return latestJob?.status === 'pending' || latestJob?.status === 'running';
      });

    if (!hasActiveJob || adAccounts.length === 0) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadAllSyncStatus(adAccounts);
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [adAccounts, loadAllSyncStatus, syncStatusByAccount, syncingAccounts]);

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

  const monitorSyncJob = useCallback(
    async (accountId: string, jobId: string): Promise<void> => {
      const maxAttempts = 40;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const statusData = await loadAccountSyncStatus(accountId);
        const trackedJob = statusData?.recent_jobs?.find((job) => job.id === jobId);

        if (!trackedJob) {
          await wait(2500);
          continue;
        }

        if (trackedJob.status === 'completed') {
          setSyncFeedbackByAccount((prev) => ({
            ...prev,
            [accountId]: {
              type: 'success',
              message: `Sincronização concluída. ${trackedJob.records_synced} registros atualizados.`,
            },
          }));
          await loadDashboardData();
          return;
        }

        if (trackedJob.status === 'failed') {
          setSyncFeedbackByAccount((prev) => ({
            ...prev,
            [accountId]: {
              type: 'error',
              message:
                trackedJob.error_message ||
                'A sincronização falhou. Verifique o histórico de jobs abaixo.',
            },
          }));
          return;
        }

        await wait(2500);
      }

      setSyncFeedbackByAccount((prev) => ({
        ...prev,
        [accountId]: {
          type: 'info',
          message:
            'A sincronização ainda está em andamento. Atualize o status desta conta em alguns segundos.',
        },
      }));
    },
    [loadAccountSyncStatus, loadDashboardData, wait]
  );

  const handleSync = async (id: string) => {
    setSyncingAccounts((prev) => ({ ...prev, [id]: true }));
    setSyncFeedbackByAccount((prev) => ({
      ...prev,
      [id]: {
        type: 'info',
        message: 'Sincronização iniciada. Aguardando processamento...',
      },
    }));

    try {
      const response = await adAccountAPI.sync(id);
      const jobId = response.data.job?.id;

      if (!jobId) {
        throw new Error('Não foi possível identificar o job de sincronização.');
      }

      await monitorSyncJob(id, jobId);
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        (error instanceof Error ? error.message : 'Não foi possível iniciar a sincronização.');

      setSyncFeedbackByAccount((prev) => ({
        ...prev,
        [id]: {
          type: 'error',
          message: errorMessage,
        },
      }));
      console.error('Error syncing:', error);
    } finally {
      setSyncingAccounts((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleSyncAll = async () => {
    if (adAccounts.length === 0) {
      return;
    }

    setSyncingAllAccounts(true);
    try {
      await Promise.all(
        adAccounts.map(async (account) => {
          setSyncingAccounts((prev) => ({ ...prev, [account.id]: true }));
          setSyncFeedbackByAccount((prev) => ({
            ...prev,
            [account.id]: {
              type: 'info',
              message: 'Sincronização iniciada em lote.',
            },
          }));

          try {
            await adAccountAPI.sync(account.id);
          } catch (error) {
            const errorMessage =
              (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
              'Não foi possível iniciar a sincronização.';
            setSyncFeedbackByAccount((prev) => ({
              ...prev,
              [account.id]: {
                type: 'error',
                message: errorMessage,
              },
            }));
            console.error(`Error syncing account ${account.id}:`, error);
          } finally {
            setSyncingAccounts((prev) => ({ ...prev, [account.id]: false }));
          }
        })
      );

      await wait(1800);
      await loadAllSyncStatus(adAccounts);
    } finally {
      setSyncingAllAccounts(false);
    }
  };

  const handleRemoveAccount = async (account: AdAccount) => {
    const shouldRemove = window.confirm(
      `Deseja remover a conta "${account.name}" do painel?`
    );

    if (!shouldRemove) {
      return;
    }

    const shouldKeepHistory = window.confirm(
      'Deseja manter o histórico local desta conta?\n\nOK = manter histórico\nCancelar = apagar histórico'
    );

    setRemovingAccountId(account.id);
    clearConnectAlerts();

    try {
      const response = await adAccountAPI.disconnect(account.id, {
        deleteHistory: !shouldKeepHistory,
      });

      setConnectMessage(response.data.message || 'Conta removida com sucesso.');

      setSyncStatusByAccount((prev) => {
        const next = { ...prev };
        delete next[account.id];
        return next;
      });
      setSyncFeedbackByAccount((prev) => {
        const next = { ...prev };
        delete next[account.id];
        return next;
      });
      setExpandedJobsByAccount((prev) => {
        const next = { ...prev };
        delete next[account.id];
        return next;
      });

      await loadDashboardData();
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Não foi possível remover a conta agora.';
      setConnectError(errorMessage);
      console.error('Error removing ad account:', error);
    } finally {
      setRemovingAccountId(null);
    }
  };

  const handlePrepareReconnect = (account: AdAccount) => {
    setShowConnectForm(true);
    setMetaAccessToken('');
    setAvailableMetaAccounts([]);
    setSelectedMetaAccountId('');
    setManualAccountId(account.meta_account_id);
    setConnectError(null);
    setConnectMessage(
      `Reconexão preparada para "${account.name}". Informe um novo token e confirme a conexão.`
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isExpiredMetaTokenError = (message: string | null | undefined): boolean => {
    if (!message) {
      return false;
    }

    return /error validating access token|session has expired|oauth/i.test(message);
  };

  const handleCampaignDrillDown = (metric: 'spend' | 'impressions' | 'clicks' | 'conversions') => {
    navigate(`/campaigns?sort=${metric}&order=desc&days=${selectedDays}`);
  };

  const getJobStatusBadgeClass = (status: SyncJob['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      case 'running':
        return 'bg-blue-100 text-blue-700';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getJobStatusLabel = (status: SyncJob['status']) => {
    switch (status) {
      case 'completed':
        return 'Concluído';
      case 'failed':
        return 'Falhou';
      case 'running':
        return 'Em execução';
      case 'pending':
      default:
        return 'Pendente';
    }
  };

  const getJobTypeLabel = (jobType: SyncJob['job_type']) => {
    switch (jobType) {
      case 'full_sync':
        return 'Completa';
      case 'insights_sync':
        return 'Insights';
      case 'incremental_sync':
      default:
        return 'Incremental';
    }
  };

  const getFeedbackClass = (type: SyncFeedback['type']) => {
    if (type === 'success') {
      return 'border-green-200 bg-green-50 text-green-700';
    }

    if (type === 'error') {
      return 'border-red-200 bg-red-50 text-red-700';
    }

    return 'border-blue-200 bg-blue-50 text-blue-700';
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleString();
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
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title', 'Dashboard')}</h1>
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
            {adAccounts.map((account) => {
              const accountSyncStatus = syncStatusByAccount[account.id];
              const latestJob = getLatestJob(accountSyncStatus);
              const isSyncing = Boolean(syncingAccounts[account.id]);
              const isStatusLoading = Boolean(loadingSyncStatusByAccount[account.id]);
              const feedback = syncFeedbackByAccount[account.id];
              const isExpanded = Boolean(expandedJobsByAccount[account.id]);

              return (
                <div key={account.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <p className="font-medium text-gray-900">{account.name}</p>
                      <p className="text-sm text-gray-500">ID: {account.meta_account_id}</p>
                      <p className="text-xs text-gray-400">
                        Última sincronização:{' '}
                        {account.last_synced_at
                          ? new Date(account.last_synced_at).toLocaleString()
                          : 'Nunca'}
                      </p>

                      {latestJob ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getJobStatusBadgeClass(latestJob.status)}`}
                          >
                            {latestJob.status === 'completed' && <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                            {latestJob.status === 'failed' && <AlertTriangle className="mr-1 h-3.5 w-3.5" />}
                            {(latestJob.status === 'running' || latestJob.status === 'pending') && (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            )}
                            {getJobStatusLabel(latestJob.status)}
                          </span>
                          <span className="text-xs text-gray-500">
                            Job {getJobTypeLabel(latestJob.job_type)} em {formatDateTime(latestJob.created_at)}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          Ainda não há histórico de sincronização desta conta.
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void loadAccountSyncStatus(account.id)}
                        isLoading={isStatusLoading}
                      >
                        Atualizar status
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleSync(account.id)}
                        isLoading={isSyncing}
                      >
                        Sincronizar
                      </Button>
                      {isExpiredMetaTokenError(latestJob?.error_message) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handlePrepareReconnect(account)}
                        >
                          Reconectar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => void handleRemoveAccount(account)}
                        isLoading={removingAccountId === account.id}
                        disabled={isSyncing}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Remover
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setExpandedJobsByAccount((prev) => ({
                            ...prev,
                            [account.id]: !isExpanded,
                          }))
                        }
                      >
                        {isExpanded ? 'Ocultar jobs' : 'Ver jobs'}
                      </Button>
                    </div>
                  </div>

                  {feedback && (
                    <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${getFeedbackClass(feedback.type)}`}>
                      {feedback.message}
                    </div>
                  )}

                  {latestJob?.status === 'failed' && latestJob.error_message && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      <p className="font-medium">Erro do último job:</p>
                      <p className="mt-1 break-all">{latestJob.error_message}</p>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Criado em</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Tipo</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Registros</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Concluído em</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Erro</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(accountSyncStatus?.recent_jobs || []).map((job) => (
                            <tr key={job.id} className="border-b border-gray-100">
                              <td className="px-3 py-2 text-xs text-gray-600">{formatDateTime(job.created_at)}</td>
                              <td className="px-3 py-2 text-xs text-gray-600">{getJobTypeLabel(job.job_type)}</td>
                              <td className="px-3 py-2 text-xs text-gray-600">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 font-medium ${getJobStatusBadgeClass(job.status)}`}
                                >
                                  {getJobStatusLabel(job.status)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-600">
                                {Number(job.records_synced || 0)}
                              </td>
                              <td className="px-3 py-2 text-xs text-gray-600">
                                {formatDateTime(job.completed_at)}
                              </td>
                              <td className="px-3 py-2 text-xs text-red-600">
                                {job.error_message || '-'}
                              </td>
                            </tr>
                          ))}
                          {(!accountSyncStatus?.recent_jobs || accountSyncStatus.recent_jobs.length === 0) && (
                            <tr>
                              <td colSpan={6} className="px-3 py-4 text-center text-xs text-gray-500">
                                Sem jobs de sincronização para esta conta.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
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
