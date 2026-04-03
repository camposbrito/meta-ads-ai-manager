import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { adAccountAPI, integrationAPI, organizationAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import type { FormEvent } from 'react';
import type { AdAccount, Ga4Integration, MetaAvailableAdAccount } from '../types';

const META_OAUTH_STATE_KEY = 'meta_oauth_state';
const META_OAUTH_TOKEN_KEY = 'meta_oauth_access_token';
const META_OAUTH_RETURN_PATH_KEY = 'meta_oauth_return_path';

type SettingsSection = 'general' | 'team' | 'integrations' | 'notifications';

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const { user } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
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
  const [ga4Integration, setGa4Integration] = useState<Ga4Integration | null>(null);
  const [showGa4Config, setShowGa4Config] = useState(false);
  const [ga4PropertyId, setGa4PropertyId] = useState('');
  const [ga4MeasurementId, setGa4MeasurementId] = useState('');
  const [ga4ServiceAccountEmail, setGa4ServiceAccountEmail] = useState('');
  const [ga4PrivateKey, setGa4PrivateKey] = useState('');
  const [savingGa4, setSavingGa4] = useState(false);
  const [testingGa4, setTestingGa4] = useState(false);
  const [disconnectingGa4, setDisconnectingGa4] = useState(false);

  const metaAppId = import.meta.env.VITE_META_APP_ID || '';
  const metaRedirectUri = import.meta.env.VITE_META_REDIRECT_URI || `${window.location.origin}/meta/callback`;
  const metaScopes =
    import.meta.env.VITE_META_SCOPES || 'ads_management,ads_read,business_management';

  const clearIntegrationAlerts = () => {
    setIntegrationError('');
    setIntegrationMessage('');
  };

  const applyGa4DefaultsFromIntegration = (integration: Ga4Integration | null) => {
    setGa4PropertyId(integration?.property_id || '');
    setGa4MeasurementId(integration?.measurement_id || '');
    setGa4ServiceAccountEmail(integration?.service_account_email || '');
    setGa4PrivateKey('');
  };

  const loadIntegrations = async () => {
    setLoadingIntegrations(true);
    try {
      const [accountsResponse, ga4Response] = await Promise.all([
        adAccountAPI.list(),
        integrationAPI.getGa4(),
      ]);

      setAdAccounts(accountsResponse.data.accounts);
      setGa4Integration(ga4Response.data.integration);
      applyGa4DefaultsFromIntegration(ga4Response.data.integration);
    } catch (error) {
      console.error('Error loading integrations:', error);
      setIntegrationError('Nao foi possivel carregar as integracoes.');
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
    void loadIntegrations();
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
      await loadIntegrations();
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Nao foi possivel conectar a conta Meta Ads.';
      setIntegrationError(errorMessage);
    } finally {
      setConnectingMetaAccount(false);
    }
  };

  const handleSaveGa4Integration = async () => {
    clearIntegrationAlerts();
    setSavingGa4(true);

    try {
      const response = await integrationAPI.saveGa4({
        propertyId: ga4PropertyId.trim(),
        measurementId: ga4MeasurementId.trim() || undefined,
        serviceAccountEmail: ga4ServiceAccountEmail.trim(),
        privateKey: ga4PrivateKey.trim() || undefined,
      });

      setGa4Integration(response.data.integration);
      applyGa4DefaultsFromIntegration(response.data.integration);
      setIntegrationMessage('Integracao GA4 salva com sucesso.');
      setShowGa4Config(false);
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Nao foi possivel salvar a integracao GA4.';
      setIntegrationError(errorMessage);
    } finally {
      setSavingGa4(false);
    }
  };

  const handleTestGa4Integration = async () => {
    clearIntegrationAlerts();
    setTestingGa4(true);

    try {
      const response = await integrationAPI.testGa4();
      setGa4Integration(response.data.integration);
      setIntegrationMessage('Conexao com GA4 validada com sucesso.');
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Nao foi possivel validar a integracao GA4.';
      setIntegrationError(errorMessage);
    } finally {
      setTestingGa4(false);
    }
  };

  const handleDisconnectGa4Integration = async () => {
    clearIntegrationAlerts();
    setDisconnectingGa4(true);

    try {
      await integrationAPI.disconnectGa4();
      setGa4Integration(null);
      applyGa4DefaultsFromIntegration(null);
      setShowGa4Config(false);
      setIntegrationMessage('Integracao GA4 desconectada.');
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Nao foi possivel desconectar a integracao GA4.';
      setIntegrationError(errorMessage);
    } finally {
      setDisconnectingGa4(false);
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tema da Interface</label>
              <select
                value={theme}
                onChange={(event) => setTheme(event.target.value as 'light' | 'dark' | 'system')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="system">Sistema</option>
                <option value="light">Claro</option>
                <option value="dark">Escuro</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Tema ativo: {resolvedTheme === 'dark' ? 'Escuro' : 'Claro'}</p>
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

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">GA4</span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Google Analytics 4</h4>
                  <p className="text-sm text-gray-500">
                    {loadingIntegrations
                      ? 'Carregando...'
                      : ga4Integration
                        ? `Conectado (Property ${ga4Integration.property_id})`
                        : 'Nao conectado'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {ga4Integration && (
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={testingGa4}
                    onClick={() => void handleTestGa4Integration()}
                  >
                    Testar
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowGa4Config((prev) => !prev);
                    clearIntegrationAlerts();
                  }}
                >
                  {showGa4Config ? 'Fechar' : ga4Integration ? 'Editar' : 'Configurar'}
                </Button>
              </div>
            </div>

            {showGa4Config && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                <details className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-medium text-blue-900">
                    Guia rápido: como conectar o GA4
                  </summary>
                  <div className="mt-3 space-y-2 text-sm text-blue-900">
                    <p className="font-medium">Checklist de configuração:</p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Crie uma Service Account no Google Cloud do projeto do GA4.</li>
                      <li>No GA4, adicione esse e-mail em "Admin &gt; Property Access Management" com papel Viewer.</li>
                      <li>Copie o Property ID numérico (ex.: 123456789).</li>
                      <li>Cole a private key do JSON da Service Account (aceita com \n ou quebra de linha real).</li>
                      <li>Clique em "Salvar GA4" e depois "Testar".</li>
                    </ol>
                    <p className="font-medium pt-1">Erros comuns:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Property ID com prefixo inválido ou não numérico.</li>
                      <li>E-mail da Service Account sem permissão no GA4.</li>
                      <li>Private key truncada ou com aspas extras.</li>
                    </ul>
                  </div>
                </details>

                <div className="space-y-2">
                  <label htmlFor="ga4PropertyId" className="block text-sm font-medium text-gray-700">
                    GA4 Property ID
                  </label>
                  <input
                    id="ga4PropertyId"
                    type="text"
                    value={ga4PropertyId}
                    onChange={(event) => setGa4PropertyId(event.target.value)}
                    placeholder="123456789"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="ga4MeasurementId" className="block text-sm font-medium text-gray-700">
                    Measurement ID (opcional)
                  </label>
                  <input
                    id="ga4MeasurementId"
                    type="text"
                    value={ga4MeasurementId}
                    onChange={(event) => setGa4MeasurementId(event.target.value)}
                    placeholder="G-XXXXXXXXXX"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="ga4ServiceAccountEmail" className="block text-sm font-medium text-gray-700">
                    Service Account Email
                  </label>
                  <input
                    id="ga4ServiceAccountEmail"
                    type="email"
                    value={ga4ServiceAccountEmail}
                    onChange={(event) => setGa4ServiceAccountEmail(event.target.value)}
                    placeholder="ga4-reader@project-id.iam.gserviceaccount.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="ga4PrivateKey" className="block text-sm font-medium text-gray-700">
                    Service Account Private Key
                  </label>
                  <textarea
                    id="ga4PrivateKey"
                    value={ga4PrivateKey}
                    onChange={(event) => setGa4PrivateKey(event.target.value)}
                    rows={5}
                    placeholder={
                      ga4Integration?.has_credentials
                        ? 'Deixe vazio para manter a chave atual'
                        : '-----BEGIN PRIVATE KEY-----'
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button isLoading={savingGa4} onClick={() => void handleSaveGa4Integration()}>
                    Salvar GA4
                  </Button>
                  {ga4Integration && (
                    <Button
                      variant="secondary"
                      isLoading={disconnectingGa4}
                      onClick={() => void handleDisconnectGa4Integration()}
                    >
                      Desconectar
                    </Button>
                  )}
                </div>
              </div>
            )}

            {ga4Integration?.last_tested_at && (
              <div className="text-xs text-gray-500">
                Ultimo teste: {new Date(ga4Integration.last_tested_at).toLocaleString()}
              </div>
            )}
            {ga4Integration?.last_error && (
              <div className="text-xs text-red-600">Ultimo erro GA4: {ga4Integration.last_error}</div>
            )}
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
