import { useState, useEffect } from 'react';
import { Plus, Mail, Shield, User } from 'lucide-react';
import { organizationAPI } from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import type { TeamMember } from '../types';
import type { FormEvent } from 'react';
import { useI18n } from '../contexts/I18nContext';

export function TeamPage() {
  const { t } = useI18n();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [inviteData, setInviteData] = useState({
    name: '',
    email: '',
    role: 'member' as 'admin' | 'member',
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const response = await organizationAPI.getMembers();
      setMembers(response.data.members);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetInviteForm = () => {
    setInviteData({ name: '', email: '', role: 'member' });
    setInviteError('');
    setTemporaryPassword('');
  };

  const handleCloseInviteModal = () => {
    resetInviteForm();
    setShowInviteModal(false);
  };

  const handleInviteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteError('');
    setTemporaryPassword('');
    setIsInviting(true);

    try {
      const response = await organizationAPI.addMember(inviteData);
      setTemporaryPassword(response.data.temporary_password || '');
      await loadMembers();
    } catch {
      setInviteError('Não foi possível convidar o membro. Verifique os dados e tente novamente.');
    } finally {
      setIsInviting(false);
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
        <h1 className="text-2xl font-bold text-gray-900">{t('team.title', 'Equipe')}</h1>
        <Button
          onClick={() => {
            resetInviteForm();
            setShowInviteModal(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Convidar Membro
        </Button>
      </div>

      <Card>
        <div className="space-y-4">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{member.name}</p>
                  <p className="text-sm text-gray-500">{member.email}</p>
                  {member.last_login_at && (
                    <p className="text-xs text-gray-400">
                      Último acesso: {new Date(member.last_login_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span
                  className={`flex items-center px-3 py-1 text-xs font-medium rounded-full ${
                    member.role === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  <Shield className="h-3 w-3 mr-1" />
                  {member.role === 'admin' ? 'Admin' : 'Membro'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Convidar Membro
              </h2>
              <form id="invite-member-form" className="space-y-4" onSubmit={handleInviteSubmit}>
                {inviteError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm">
                    {inviteError}
                  </div>
                )}

                {temporaryPassword && (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">
                    Usuário criado. Senha temporária: <strong>{temporaryPassword}</strong>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={inviteData.name}
                    onChange={(event) =>
                      setInviteData((prev) => ({ ...prev, name: event.target.value }))
                    }
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={inviteData.email}
                    onChange={(event) =>
                      setInviteData((prev) => ({ ...prev, email: event.target.value }))
                    }
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="email@empresa.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cargo
                  </label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={inviteData.role}
                    onChange={(event) =>
                      setInviteData((prev) => ({
                        ...prev,
                        role: event.target.value as 'admin' | 'member',
                      }))
                    }
                  >
                    <option value="member">Membro</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </form>
            </div>
            <div className="flex justify-end space-x-3 px-6 py-4 bg-gray-50 rounded-b-xl">
              <Button
                variant="secondary"
                onClick={handleCloseInviteModal}
              >
                Cancelar
              </Button>
              <Button type="submit" form="invite-member-form" isLoading={isInviting}>
                <Mail className="h-4 w-4 mr-2" />
                Criar Membro
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
