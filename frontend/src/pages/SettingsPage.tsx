import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { organizationAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { FormEvent } from 'react';

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general');
  const { user } = useAuth();
  const [organizationName, setOrganizationName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

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
    loadOrganization();
  }, [user?.email]);

  const handleSaveGeneralSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveMessage('');
    setSaving(true);

    try {
      await organizationAPI.update({ name: organizationName });
      setSaveMessage('Configurações salvas com sucesso.');
    } catch (error) {
      console.error('Error saving organization settings:', error);
      setSaveMessage('Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>

      {/* Section Tabs */}
      <div className="flex space-x-4 border-b border-gray-200">
        {['general', 'team', 'integrations', 'notifications'].map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`pb-3 px-1 font-medium text-sm capitalize transition-colors ${
              activeSection === section
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {section === 'general' ? 'Geral' :
             section === 'team' ? 'Equipe' :
             section === 'integrations' ? 'Integrações' : 'Notificações'}
          </button>
        ))}
      </div>

      {/* General Settings */}
      {activeSection === 'general' && (
        <Card title="Configurações Gerais">
          <form className="space-y-4" onSubmit={handleSaveGeneralSettings}>
            {saveMessage && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm">
                {saveMessage}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Empresa
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email de Contato
              </label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" isLoading={saving} disabled={loading}>
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Team Settings */}
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
              { name: 'João Silva', email: 'joao@empresa.com', role: 'Admin' },
              { name: 'Maria Santos', email: 'maria@empresa.com', role: 'Membro' },
            ].map((member, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
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

      {/* Integrations */}
      {activeSection === 'integrations' && (
        <Card title="Integrações">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">Meta</span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Meta Ads</h4>
                  <p className="text-sm text-gray-500">Conectado</p>
                </div>
              </div>
              <Button variant="secondary" size="sm">Configurar</Button>
            </div>
            
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
                Indisponível
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Notifications */}
      {activeSection === 'notifications' && (
        <Card title="Preferências de Notificação">
          <div className="space-y-4">
            {[
              { label: 'Sugestões de otimização disponíveis', enabled: true },
              { label: 'Relatórios diários de desempenho', enabled: false },
              { label: 'Alertas de orçamento', enabled: true },
              { label: 'Atualizações de sincronização', enabled: false },
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
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
