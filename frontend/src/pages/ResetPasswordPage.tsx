import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Button } from '../components/Button';
import type { FormEvent } from 'react';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!token) {
      setError('Token de recuperação inválido.');
      return;
    }

    if (password.length < 8) {
      setError('A nova senha precisa ter no mínimo 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não conferem.');
      return;
    }

    setIsLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setSuccessMessage('Senha redefinida com sucesso. Redirecionando para login...');
      setTimeout(() => navigate('/login'), 1200);
    } catch {
      setError('Token inválido ou expirado.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-slate-100">
            Redefinir senha
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-slate-400">
            Defina uma nova senha para sua conta.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300 px-4 py-3 rounded-lg text-sm">
              {successMessage}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Nova senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1"
              >
                Confirmar senha
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <Button type="submit" isLoading={isLoading} className="w-full">
              Redefinir senha
            </Button>
          </div>

          <div className="text-center">
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              Voltar para login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
