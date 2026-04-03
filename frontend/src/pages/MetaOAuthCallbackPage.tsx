import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';

const META_OAUTH_STATE_KEY = 'meta_oauth_state';
const META_OAUTH_TOKEN_KEY = 'meta_oauth_access_token';

export function MetaOAuthCallbackPage() {
  const navigate = useNavigate();
  const callbackData = useMemo(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hashParams.get('access_token');
    const state = hashParams.get('state');
    const errorReason = hashParams.get('error_reason') || hashParams.get('error_description');

    if (errorReason) {
      return {
        error: 'A autorização no Meta foi cancelada ou falhou.',
        accessToken: null as string | null,
      };
    }

    if (!accessToken) {
      return {
        error: 'Callback inválido: token de acesso não recebido.',
        accessToken: null as string | null,
      };
    }

    const expectedState = localStorage.getItem(META_OAUTH_STATE_KEY);
    if (expectedState && state !== expectedState) {
      return {
        error: 'Estado OAuth inválido. Tente conectar novamente.',
        accessToken: null as string | null,
      };
    }

    return { error: null as string | null, accessToken };
  }, []);

  useEffect(() => {
    localStorage.removeItem(META_OAUTH_STATE_KEY);

    if (callbackData.error || !callbackData.accessToken) {
      return;
    }

    sessionStorage.setItem(META_OAUTH_TOKEN_KEY, callbackData.accessToken);
    navigate('/?meta_oauth=success', { replace: true });
  }, [callbackData, navigate]);

  if (!callbackData.error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-sm text-gray-600">Finalizando conexão com o Meta Ads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl shadow-sm p-6 text-center">
        <h1 className="text-lg font-semibold text-gray-900">Falha na conexão com Meta Ads</h1>
        <p className="mt-2 text-sm text-gray-600">{callbackData.error}</p>
        <Button className="w-full mt-6" onClick={() => navigate('/', { replace: true })}>
          Voltar ao dashboard
        </Button>
      </div>
    </div>
  );
}
