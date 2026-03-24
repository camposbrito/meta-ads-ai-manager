import { useState, useEffect } from 'react';
import { Plus, Mail, Shield, User } from 'lucide-react';
import { organizationAPI } from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';

interface Member {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member';
  last_login_at?: string | null;
  created_at: string;
}

export function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);

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
        <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
        <Button onClick={() => setShowInviteModal(true)}>
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
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="email@empresa.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cargo
                  </label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="member">Membro</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </form>
            </div>
            <div className="flex justify-end space-x-3 px-6 py-4 bg-gray-50 rounded-b-xl">
              <Button
                variant="secondary"
                onClick={() => setShowInviteModal(false)}
              >
                Cancelar
              </Button>
              <Button onClick={() => setShowInviteModal(false)}>
                <Mail className="h-4 w-4 mr-2" />
                Enviar Convite
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
