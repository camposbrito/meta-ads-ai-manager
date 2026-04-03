import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { adAccountAPI, organizationAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { FormEvent } from 'react';
import type { AdAccount, MetaAvailableAdAccount } from '../types';

const META_OAUTH_STATE_KEY = 'meta_oauth_state';
const META_OAUTH_TOKEN_KEY = 'meta_oauth_access_token';
const META_OAUTH_RETURN_PATH_KEY = 'meta_oauth_return_path';

type SettingsSection = 'general' | 'team' | 'integrations' | 'notifications';

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [organizationName, setOrganizationName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [showMetaConfig, setShowMetaConfig] = useState(false);
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [manualAccountId, setManualAccountId] = useState('');
  const [availableMetaAccounts, setAvailableMetaAccounts] = useState<MetaAvailableAdAccount[]>([]);
  const [selectedMetaAccountId, setSelectedMetaAccountId] = useState('');
  const [loadingMetaAccounts, setLoadingMetaAccounts] = useState(false);
  const [connectingMetaAccount, setConnectingMetaAccount] = useState(false);
  const [integrationError, setIntegrationError] = useState('');
  const [integrationMessage, setIntegrationMessage] = useState('');

  const metaAppId = import.meta.env.VITE_META_APP_ID || '';
  const metaRedirectUri = import.meta.env.VITE_META_REDIRECT_URI || `${window.location.origin}/meta/callback`;
  const metaScopes =
    import.meta.env.VITE_META_SCOPES || 'ads_management,ads_read,business_management';

  const clearIntegrationAlerts = () => {
    setIntegrationError('');
    setIntegrationMessage('');
  };

  const loadAdAccounts = async () => {
    setLoadingIntegrations(true);
    try {
      const response = await adAccountAPI.list();
      setAdAccounts(response.data.accounts);
    } catch (error) {
      console.error('Error loading ad accounts:', error);
      setIntegrationError('Nao foi possivel carregar as integracoes Meta Ads.');
    } finally {
      setLoadingIntegrations(false);
    }
  };

  useEffect(() => {
    const loadOrganization = async () => {
      try {
        const response = await organizationAPI.get();
        setOrganizationName(response.data.organization.name || '');
      } catch (error) {
        console.error('Error loading organization settings:', error);
      } finally {
        setLoading(false);
      }
    };

    setContactEmail(user?.email || '');
    void loadOrganization();
    void loadAdAccounts();
  }, [user?.email]);

  useEffect(() => {
    const section = searchParams.get('section');
    if (section === 'general' || section === 'team' || section === 'integrations' || section === 'notifications') {
      setActiveSection(section);
    }
  }, [searchParams]);

  useEffect(() => {
    const oauthAccessToken = sessionStorage.getItem(META_OAUTH_TOKEN_KEY);
    if (!oauthAccessToken) {
      return;
    }

    sessionStorage.removeItem(META_OAUTH_TOKEN_KEY);
    setActiveSection('integrations');
    setShowMetaConfig(true);
    setMetaAccessToken(oauthAccessToken);
    void loadMetaAccounts(oauthAccessToken);

    const updated = new URLSearchParams(searchParams);
    updated.delete('meta_oauth');
    setSearchParams(updated, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSaveGeneralSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveMessage('');
    setSaving(true);

    try {
      await organizationAPI.update({ name: organizationName });
      setSaveMessage('Configuracoes salvas com sucesso.');
    } catch (error) {
      console.error('Error saving organization settings:', error);
      setSaveMessage('Nao foi possivel salvar as alteracoes.');
    } finally {
      setSaving(false);
    }
  };

  const loadMetaAccounts = async (tokenOverride?: string) => {
    const tokenToUse = (tokenOverride ?? metaAccessToken).trim();
    clearIntegrationAlerts();

    if (!tokenToUse) {
      setIntegrationError('Informe um access token do Meta para listar as contas.');
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
        setIntegrationMessage('Contas carregadas. Escolha uma conta e confirme a conexao.');
      } else {
        setSelectedMetaAccountId('');
        setManualAccountId('');
        setIntegrationError('Nenhuma conta de anuncios disponivel para este token.');
      }
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Nao foi possivel carregar contas do Meta.';
      setIntegrationError(errorMessage);
    } finally {
      setLoadingMetaAccounts(false);
    }
  };

  const handleStartMetaOAuth = () => {
    clearIntegrationAlerts();

    if (!metaAppId) {
      setIntegrationError('Configure VITE_META_APP_ID para iniciar o OAuth do Meta.');
      return;
    }

    const oauthState =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    localStorage.setItem(META_OAUTH_STATE_KEY, oauthState);
    localStorage.setItem(
      META_OAUTH_RETURN_PATH_KEY,
      '/settings?section=integrations&meta_oauth=success'
    );

    const params = new URLSearchParams({
      client_id: metaAppId,
      redirect_uri: metaRedirectUri,
      response_type: 'token',
      scope: metaScopes,
      state: oauthState,
    });

    window.location.assign(`https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`);
  };

  const handleConnectMetaAccount = async () => {
    clearIntegrationAlerts();

    const tokenToUse = metaAccessToken.trim();
    const accountIdToUse = selectedMetaAccountId || manualAccountId.trim();

    if (!tokenToUse) {
      setIntegrationError('Informe o access token do Meta para conectar a conta.');
      return;
    }

    if (!accountIdToUse) {
      setIntegrationError('Selecione ou informe o ID da conta de anuncios.');
      return;
    }

    setConnectingMetaAccount(true);
    try {
      await adAccountAPI.connect({
        accessToken: tokenToUse,
        accountId: accountIdToUse,
      });

      setIntegrationMessage('Conta Meta Ads conectada com sucesso.');
      setMetaAccessToken('');
      setManualAccountId('');
      setSelectedMetaAccountId('');
      setAvailableMetaAccounts([]);
      setShowMetaConfig(false);
      await loadAdAccounts();
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Nao foi possivel conectar a conta Meta Ads.';
      setIntegrationError(errorMessage);
    } finally {
      setConnectingMetaAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Configuracoes</h1>

      <div className="flex space-x-4 border-b border-gray-200">
        {(['general', 'team', 'integrations', 'notifications'] as SettingsSection[]).map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`pb-3 px-1 font-medium text-sm capitalize transition-colors ${
              activeSection === section
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {section === 'general'
              ? 'Geral'
              : section === 'team'
                ? 'Equipe'
                : section === 'integrations'
                  ? 'Integracoes'
                  : 'Notificacoes'}
          </button>
        ))}
      </div>

      {activeSection === 'general' && (
        <Card title="Configuracoes Gerais">
          <form className="space-y-4" onSubmit={handleSaveGeneralSettings}>
            {saveMessage && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm">
                {saveMessage}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email de Contato</label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" isLoading={saving} disabled={loading}>
                Salvar Alteracoes
              </Button>
            </div>
          </form>
        </Card>
      )}

      {activeSection === 'team' && (
        <Card
          title="Membros da Equipe"
          action={
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Convidar
            </Button>
          }
        >
          <div className="space-y-4">
            {[
              { name: 'Joao Silva', email: 'joao@empresa.com', role: 'Admin' },
              { name: 'Maria Santos', email: 'maria@empresa.com', role: 'Membro' },
            ].map((member, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{member.name}</p>
                  <p className="text-sm text-gray-500">{member.email}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                    {member.role}
                  </span>
                  {index > 0 && (
                    <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeSection === 'integrations' && (
        <Card title="Integracoes">
          <div className="space-y-4">
            {integrationMessage && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {integrationMessage}
              </div>
            )}
            {integrationError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {integrationError}
              </div>
            )}

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">Meta</span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Meta Ads</h4>
                  <p className="text-sm text-gray-500">
                    {loadingIntegrations
                      ? 'Carregando...'
                      : adAccounts.length > 0
                        ? `${adAccounts.length} conta(s) conectada(s)`
                        : 'Nenhuma conta conectada'}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowMetaConfig((prev) => !prev);
                  clearIntegrationAlerts();
                }}
              >
                {showMetaConfig ? 'Fechar' : adAccounts.length > 0 ? 'Adicionar Conta' : 'Configurar'}
              </Button>
            </div>

            {showMetaConfig && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
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
                  <label htmlFor="settingsMetaAccessToken" className="block text-sm font-medium text-gray-700">
                    Access Token Meta
                  </label>
                  <input
                    id="settingsMetaAccessToken"
                    type="text"
                    value={metaAccessToken}
                    onChange={(event) => setMetaAccessToken(event.target.value)}
                    placeholder="EAAB..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                {availableMetaAccounts.length > 0 ? (
                  <div className="space-y-2">
                    <label htmlFor="settingsMetaAccountSelect" className="block text-sm font-medium text-gray-700">
                      Conta de anuncios
                    </label>
                    <select
                      id="settingsMetaAccountSelect"
                      value={selectedMetaAccountId}
                      onChange={(event) => {
                        setSelectedMetaAccountId(event.target.value);
                        setManualAccountId(event.target.value);
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
                    <label htmlFor="settingsManualAccountId" className="block text-sm font-medium text-gray-700">
                      ID da conta de anuncios
                    </label>
                    <input
                      id="settingsManualAccountId"
                      type="text"
                      value={manualAccountId}
                      onChange={(event) => setManualAccountId(event.target.value)}
                      placeholder="act_1234567890 ou 1234567890"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                )}

                <Button onClick={handleConnectMetaAccount} isLoading={connectingMetaAccount}>
                  Confirmar Conexao
                </Button>
              </div>
            )}

            {adAccounts.length > 0 && (
              <div className="space-y-2">
                {adAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{account.name}</p>
                      <p className="text-xs text-gray-500">ID: {account.meta_account_id}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {account.last_synced_at
                        ? `Ultima sync: ${new Date(account.last_synced_at).toLocaleString()}`
                        : 'Ainda sem sync'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg opacity-60">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">GA4</span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Google Analytics 4</h4>
                  <p className="text-sm text-gray-500">Em breve</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" disabled>
                Indisponivel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {activeSection === 'notifications' && (
        <Card title="Preferencias de Notificacao">
          <div className="space-y-4">
            {[
              { label: 'Sugestoes de otimizacao disponiveis', enabled: true },
              { label: 'Relatorios diarios de desempenho', enabled: false },
              { label: 'Alertas de orcamento', enabled: true },
              { label: 'Atualizacoes de sincronizacao', enabled: false },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-700">{item.label}</span>
                <button
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    item.enabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      item.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
