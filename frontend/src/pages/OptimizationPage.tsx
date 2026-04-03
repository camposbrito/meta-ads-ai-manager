import { useState, useEffect, useCallback } from 'react';
import { Lightbulb, Check, X, Play, Settings, TrendingUp } from 'lucide-react';
import { optimizationAPI, adAccountAPI } from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import type { AdAccount, OptimizationSuggestion, OptimizationRule } from '../types';

export function OptimizationPage() {
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [rules, setRules] = useState<OptimizationRule[]>([]);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [runningOptimization, setRunningOptimization] = useState(false);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'rules'>('suggestions');
  const [runSummary, setRunSummary] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [suggestionsRes, rulesRes, accountsRes] = await Promise.all([
        optimizationAPI.getSuggestions('pending'),
        optimizationAPI.getRules(),
        adAccountAPI.list(),
      ]);
      setSuggestions(suggestionsRes.data.suggestions);
      setRules(rulesRes.data.rules);
      setAdAccounts(accountsRes.data.accounts);
      if (!selectedAccountId && accountsRes.data.accounts.length > 0) {
        setSelectedAccountId(accountsRes.data.accounts[0].id);
      }
    } catch (error) {
      console.error('Error loading optimization data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAccept = async (id: string, execute: boolean) => {
    try {
      await optimizationAPI.acceptSuggestion(id, execute);
      loadData();
    } catch (error) {
      console.error('Error accepting suggestion:', error);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await optimizationAPI.rejectSuggestion(id);
      loadData();
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
    }
  };

  const handleToggleRule = async (id: string, isActive: boolean) => {
    try {
      await optimizationAPI.toggleRule(id, !isActive);
      loadData();
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const handleRunOptimization = async () => {
    setRunSummary(null);
    setRunError(null);

    if (!selectedAccountId) {
      setRunError('Selecione uma conta para executar a análise.');
      return;
    }

    setRunningOptimization(true);
    try {
      const response = await optimizationAPI.runOptimization(selectedAccountId);
      const { rules_evaluated, suggestions_generated } = response.data;

      setRunSummary(
        suggestions_generated > 0
          ? `Análise concluída: ${rules_evaluated} regra(s) avaliadas, ${suggestions_generated} sugestão(ões) geradas.`
          : `Análise concluída: ${rules_evaluated} regra(s) avaliadas, nenhuma sugestão gerada.`
      );
      await loadData();
    } catch (error) {
      console.error('Error running optimization:', error);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Não foi possível executar a análise agora.';
      setRunError(errorMessage);
    } finally {
      setRunningOptimization(false);
    }
  };

  const getSuggestionColor = (type: string) => {
    switch (type) {
      case 'pause':
        return 'bg-red-50 border-red-200';
      case 'duplicate':
        return 'bg-green-50 border-green-200';
      case 'increase_budget':
        return 'bg-blue-50 border-blue-200';
      case 'decrease_budget':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'pause':
        return <X className="h-5 w-5 text-red-600" />;
      case 'duplicate':
        return <Lightbulb className="h-5 w-5 text-green-600" />;
      case 'increase_budget':
        return <TrendingUp className="h-5 w-5 text-blue-600" />;
      case 'decrease_budget':
        return <TrendingUp className="h-5 w-5 text-yellow-600 rotate-180" />;
      default:
        return <Lightbulb className="h-5 w-5 text-gray-600" />;
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
        <h1 className="text-2xl font-bold text-gray-900">Otimização</h1>
        <div className="flex items-center gap-2">
          <select
            value={selectedAccountId}
            onChange={(event) => setSelectedAccountId(event.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {adAccounts.length === 0 && <option value="">Sem contas conectadas</option>}
            {adAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <Button
            onClick={handleRunOptimization}
            disabled={!selectedAccountId}
            isLoading={runningOptimization}
          >
            <Play className="h-4 w-4 mr-2" />
            Executar Análise
          </Button>
        </div>
      </div>

      {runSummary && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {runSummary}
        </div>
      )}

      {runError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {runError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`pb-3 px-1 font-medium text-sm transition-colors ${
            activeTab === 'suggestions'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sugestões ({suggestions.length})
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`pb-3 px-1 font-medium text-sm transition-colors ${
            activeTab === 'rules'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Regras ({rules.length})
        </button>
      </div>

      {/* Suggestions Tab */}
      {activeTab === 'suggestions' && (
        <div className="space-y-4">
          {suggestions.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <Lightbulb className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Nenhuma sugestão pendente</h3>
                <p className="text-gray-500 mt-1">
                  Suas campanhas estão performando bem ou ainda não há dados suficientes.
                </p>
              </div>
            </Card>
          ) : (
            suggestions.map((suggestion) => (
              <Card key={suggestion.id} className={getSuggestionColor(suggestion.suggestion_type)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="p-2 bg-white rounded-lg">
                      {getSuggestionIcon(suggestion.suggestion_type)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{suggestion.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{suggestion.description}</p>
                      {suggestion.expected_impact && (
                        <p className="text-sm text-gray-500 mt-2">
                          <strong>Impacto esperado:</strong> {suggestion.expected_impact}
                        </p>
                      )}
                      {suggestion.confidence_score && (
                        <p className="text-sm text-gray-500">
                          <strong>Confiança:</strong> {(suggestion.confidence_score * 100).toFixed(0)}%
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleReject(suggestion.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleAccept(suggestion.id, false)}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Aceitar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAccept(suggestion.id, true)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Executar
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <Card
            title="Regras de Otimização"
            description="Configure regras automáticas para otimizar suas campanhas"
            action={
              <Button size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Nova Regra
              </Button>
            }
          >
            {rules.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhuma regra configurada
              </div>
            ) : (
              <div className="space-y-4">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      rule.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900">{rule.name}</h4>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            rule.rule_type === 'pause_ad'
                              ? 'bg-red-100 text-red-700'
                              : rule.rule_type === 'duplicate_ad'
                              ? 'bg-green-100 text-green-700'
                              : rule.rule_type === 'increase_budget'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {rule.rule_type.replace('_', ' ')}
                        </span>
                      </div>
                      {rule.description && (
                        <p className="text-sm text-gray-500 mt-1">{rule.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleRule(rule.id, rule.is_active)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        rule.is_active ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          rule.is_active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
