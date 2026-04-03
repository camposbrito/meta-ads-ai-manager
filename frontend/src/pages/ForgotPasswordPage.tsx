import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Button } from '../components/Button';
import type { FormEvent } from 'react';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetUrl, setResetUrl] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setResetUrl('');
    setIsLoading(true);

    try {
      const response = await authAPI.forgotPassword(email);
      setSuccessMessage(response.data.message);
      if (response.data.resetUrl) {
        setResetUrl(response.data.resetUrl);
      }
    } catch {
      setError('Não foi possível processar sua solicitação agora.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-slate-100">
            Recuperar senha
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-slate-400">
            Informe seu email para receber instruções de redefinição.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300 px-4 py-3 rounded-lg text-sm space-y-2">
              <p>{successMessage}</p>
              {resetUrl && (
                <p className="break-all">
                  Link de reset (dev):{' '}
                  <a className="underline font-medium" href={resetUrl}>
                    {resetUrl}
                  </a>
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 bg-white dark:bg-slate-900 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <Button type="submit" isLoading={isLoading} className="w-full">
              Enviar instruções
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
