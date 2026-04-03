import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { Lightbulb, Check, X, Play, Settings, TrendingUp, Pencil, Trash2 } from 'lucide-react';
import { optimizationAPI, adAccountAPI } from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import type { AdAccount, OptimizationSuggestion, OptimizationRule, RuleCondition } from '../types';

type RuleType = OptimizationRule['rule_type'];
type ConditionField = RuleCondition['field'];
type ConditionOperator = Extract<RuleCondition['operator'], 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'>;

interface NewRuleForm {
  name: string;
  description: string;
  ruleType: RuleType;
  conditionField: ConditionField;
  conditionOperator: ConditionOperator;
  conditionValue: string;
  minSpendThreshold: string;
  minImpressionsThreshold: string;
  evaluationPeriodDays: string;
  budgetPercentage: string;
}

interface RulePreset {
  id: string;
  title: string;
  description: string;
  form: NewRuleForm;
}

interface RuleMutationPayload {
  name: string;
  description: string | null;
  rule_type: RuleType;
  conditions: RuleCondition[];
  actions: Array<{ type: 'pause' | 'duplicate' | 'increase_budget' | 'decrease_budget'; params?: { percentage: number } }>;
  priority: number;
  min_spend_threshold: number;
  min_impressions_threshold: number;
  evaluation_period_days: number;
}

const DEFAULT_NEW_RULE_FORM: NewRuleForm = {
  name: '',
  description: '',
  ruleType: 'pause_ad',
  conditionField: 'cpa',
  conditionOperator: 'gt',
  conditionValue: '50',
  minSpendThreshold: '0',
  minImpressionsThreshold: '0',
  evaluationPeriodDays: '7',
  budgetPercentage: '20',
};

const RULE_PRESETS: RulePreset[] = [
  {
    id: 'pause-high-cpa',
    title: 'Pausar CPA Alto',
    description: 'Pausa anúncios com CPA alto e volume mínimo de impressões.',
    form: {
      ...DEFAULT_NEW_RULE_FORM,
      name: 'Pausar Anúncios com CPA Alto',
      description: 'Pausa anúncios com custo por aquisição acima do limite.',
      ruleType: 'pause_ad',
      conditionField: 'cpa',
      conditionOperator: 'gt',
      conditionValue: '50',
      minSpendThreshold: '100',
      minImpressionsThreshold: '1000',
      evaluationPeriodDays: '7',
    },
  },
  {
    id: 'duplicate-winner',
    title: 'Duplicar Vencedor',
    description: 'Duplica anúncios com CTR forte e CPA baixo.',
    form: {
      ...DEFAULT_NEW_RULE_FORM,
      name: 'Duplicar Anúncios Vencedores',
      description: 'Duplica anúncios com bom CTR e custo eficiente.',
      ruleType: 'duplicate_ad',
      conditionField: 'ctr',
      conditionOperator: 'gt',
      conditionValue: '0.02',
      minSpendThreshold: '50',
      minImpressionsThreshold: '1000',
      evaluationPeriodDays: '7',
    },
  },
  {
    id: 'increase-high-roas',
    title: 'Aumentar Alto ROAS',
    description: 'Aumenta orçamento quando o ROAS está consistente.',
    form: {
      ...DEFAULT_NEW_RULE_FORM,
      name: 'Aumentar Orçamento com ROAS Alto',
      description: 'Aumenta orçamento para entidades com retorno acima da meta.',
      ruleType: 'increase_budget',
      conditionField: 'roas',
      conditionOperator: 'gte',
      conditionValue: '3',
      minSpendThreshold: '200',
      minImpressionsThreshold: '1000',
      evaluationPeriodDays: '14',
      budgetPercentage: '20',
    },
  },
  {
    id: 'decrease-low-roas',
    title: 'Reduzir ROAS Baixo',
    description: 'Reduz orçamento quando a eficiência cai.',
    form: {
      ...DEFAULT_NEW_RULE_FORM,
      name: 'Reduzir Orçamento com ROAS Baixo',
      description: 'Reduz orçamento de campanhas com retorno abaixo da meta.',
      ruleType: 'decrease_budget',
      conditionField: 'roas',
      conditionOperator: 'lt',
      conditionValue: '1.5',
      minSpendThreshold: '150',
      minImpressionsThreshold: '1000',
      evaluationPeriodDays: '7',
      budgetPercentage: '20',
    },
  },
];

const SUPPORTED_CONDITION_OPERATORS: ConditionOperator[] = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'];

const buildRuleActions = (ruleType: RuleType, budgetPercentage: number) => {
  if (ruleType === 'pause_ad') {
    return [{ type: 'pause' as const }];
  }

  if (ruleType === 'duplicate_ad') {
    return [{ type: 'duplicate' as const }];
  }

  if (ruleType === 'increase_budget') {
    return [{ type: 'increase_budget' as const, params: { percentage: budgetPercentage } }];
  }

  return [{ type: 'decrease_budget' as const, params: { percentage: budgetPercentage } }];
};

const conditionValueToText = (value: RuleCondition['value']): string => {
  if (typeof value === 'number' || typeof value === 'string') {
    return String(value);
  }

  if (Array.isArray(value) && value.length > 0) {
    const firstValue = value[0];
    if (typeof firstValue === 'number' || typeof firstValue === 'string') {
      return String(firstValue);
    }
  }

  return DEFAULT_NEW_RULE_FORM.conditionValue;
};

const ruleToForm = (rule: OptimizationRule): NewRuleForm => {
  const firstCondition = rule.conditions[0];
  const conditionOperator = SUPPORTED_CONDITION_OPERATORS.includes(firstCondition?.operator as ConditionOperator)
    ? (firstCondition?.operator as ConditionOperator)
    : DEFAULT_NEW_RULE_FORM.conditionOperator;

  const budgetAction = rule.actions.find(
    (action) => action.type === 'increase_budget' || action.type === 'decrease_budget'
  );
  const rawBudgetPercentage = budgetAction?.params?.percentage;
  const budgetPercentage =
    typeof rawBudgetPercentage === 'number'
      ? rawBudgetPercentage
      : typeof rawBudgetPercentage === 'string'
        ? Number.parseFloat(rawBudgetPercentage)
        : Number.NaN;

  return {
    name: rule.name,
    description: rule.description ?? '',
    ruleType: rule.rule_type,
    conditionField: firstCondition?.field ?? DEFAULT_NEW_RULE_FORM.conditionField,
    conditionOperator,
    conditionValue: conditionValueToText(firstCondition?.value ?? DEFAULT_NEW_RULE_FORM.conditionValue),
    minSpendThreshold: String(rule.min_spend_threshold ?? 0),
    minImpressionsThreshold: String(rule.min_impressions_threshold ?? 0),
    evaluationPeriodDays: String(rule.evaluation_period_days ?? 7),
    budgetPercentage: Number.isFinite(budgetPercentage)
      ? String(Math.round(budgetPercentage))
      : DEFAULT_NEW_RULE_FORM.budgetPercentage,
  };
};

const buildRulePayload = (
  form: NewRuleForm,
  priority: number
): { payload?: RuleMutationPayload; error?: string } => {
  const name = form.name.trim();
  if (!name) {
    return { error: 'Informe um nome para a regra.' };
  }

  const conditionValue = Number.parseFloat(form.conditionValue);
  if (!Number.isFinite(conditionValue)) {
    return { error: 'Informe um valor numérico válido para a condição.' };
  }

  const minSpendThreshold = Number.parseFloat(form.minSpendThreshold || '0');
  if (!Number.isFinite(minSpendThreshold) || minSpendThreshold < 0) {
    return { error: 'Mínimo de gasto inválido.' };
  }

  const minImpressionsThreshold = Number.parseInt(form.minImpressionsThreshold || '0', 10);
  if (!Number.isFinite(minImpressionsThreshold) || minImpressionsThreshold < 0) {
    return { error: 'Mínimo de impressões inválido.' };
  }

  const evaluationPeriodDays = Number.parseInt(form.evaluationPeriodDays || '7', 10);
  if (!Number.isFinite(evaluationPeriodDays) || evaluationPeriodDays < 1 || evaluationPeriodDays > 365) {
    return { error: 'Período de avaliação deve estar entre 1 e 365 dias.' };
  }

  const parsedBudgetPercentage = Number.parseInt(form.budgetPercentage || DEFAULT_NEW_RULE_FORM.budgetPercentage, 10);
  if (
    (form.ruleType === 'increase_budget' || form.ruleType === 'decrease_budget') &&
    (!Number.isFinite(parsedBudgetPercentage) || parsedBudgetPercentage < 1 || parsedBudgetPercentage > 100)
  ) {
    return { error: 'Percentual de orçamento deve estar entre 1 e 100.' };
  }

  const budgetPercentage = Number.isFinite(parsedBudgetPercentage)
    ? parsedBudgetPercentage
    : Number.parseInt(DEFAULT_NEW_RULE_FORM.budgetPercentage, 10);

  return {
    payload: {
      name,
      description: form.description.trim() || null,
      rule_type: form.ruleType,
      conditions: [
        {
          field: form.conditionField,
          operator: form.conditionOperator,
          value: conditionValue,
        },
      ],
      actions: buildRuleActions(form.ruleType, budgetPercentage),
      priority,
      min_spend_threshold: minSpendThreshold,
      min_impressions_threshold: minImpressionsThreshold,
      evaluation_period_days: evaluationPeriodDays,
    },
  };
};

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

  const [showCreateRuleModal, setShowCreateRuleModal] = useState(false);
  const [ruleModalMode, setRuleModalMode] = useState<'create' | 'edit'>('create');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [newRuleForm, setNewRuleForm] = useState<NewRuleForm>(DEFAULT_NEW_RULE_FORM);
  const [creatingRule, setCreatingRule] = useState(false);
  const [updatingRule, setUpdatingRule] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [createRuleError, setCreateRuleError] = useState<string | null>(null);
  const [ruleActionError, setRuleActionError] = useState<string | null>(null);
  const [ruleActionSuccess, setRuleActionSuccess] = useState<string | null>(null);

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
      await loadData();
    } catch (error) {
      console.error('Error accepting suggestion:', error);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await optimizationAPI.rejectSuggestion(id);
      await loadData();
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
    }
  };

  const handleToggleRule = async (id: string, isActive: boolean, ruleName: string) => {
    setRuleActionError(null);
    setRuleActionSuccess(null);
    try {
      await optimizationAPI.toggleRule(id, !isActive);
      setRuleActionSuccess(`Regra "${ruleName}" ${!isActive ? 'ativada' : 'desativada'} com sucesso.`);
      await loadData();
    } catch (error) {
      console.error('Error toggling rule:', error);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Não foi possível alterar o status da regra.';
      setRuleActionError(errorMessage);
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

  const handleOpenCreateRuleModal = () => {
    setRuleModalMode('create');
    setEditingRuleId(null);
    setCreateRuleError(null);
    setRuleActionError(null);
    setRuleActionSuccess(null);
    setNewRuleForm(DEFAULT_NEW_RULE_FORM);
    setShowCreateRuleModal(true);
  };

  const handleOpenEditRuleModal = (rule: OptimizationRule) => {
    setRuleModalMode('edit');
    setEditingRuleId(rule.id);
    setCreateRuleError(null);
    setRuleActionError(null);
    setRuleActionSuccess(null);
    setNewRuleForm(ruleToForm(rule));
    setShowCreateRuleModal(true);
  };

  const handleApplyPreset = (preset: RulePreset) => {
    setCreateRuleError(null);
    setNewRuleForm(preset.form);
  };

  const handleCloseCreateRuleModal = () => {
    setShowCreateRuleModal(false);
    setRuleModalMode('create');
    setEditingRuleId(null);
    setCreateRuleError(null);
  };

  const handleNewRuleChange = <K extends keyof NewRuleForm>(field: K, value: NewRuleForm[K]) => {
    setNewRuleForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateRuleError(null);
    setRuleActionError(null);
    setRuleActionSuccess(null);

    const { payload, error } = buildRulePayload(newRuleForm, rules.length);
    if (!payload) {
      setCreateRuleError(error ?? 'Dados da regra inválidos.');
      return;
    }

    setCreatingRule(true);
    try {
      await optimizationAPI.createRule(payload);

      setRuleActionSuccess(`Regra "${payload.name}" criada com sucesso.`);
      setShowCreateRuleModal(false);
      setRuleModalMode('create');
      setEditingRuleId(null);
      setActiveTab('rules');
      await loadData();
    } catch (error) {
      console.error('Error creating rule:', error);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Não foi possível criar a regra.';
      setCreateRuleError(errorMessage);
    } finally {
      setCreatingRule(false);
    }
  };

  const handleUpdateRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateRuleError(null);
    setRuleActionError(null);
    setRuleActionSuccess(null);

    if (!editingRuleId) {
      setCreateRuleError('Regra inválida para edição.');
      return;
    }

    const currentRule = rules.find((rule) => rule.id === editingRuleId);
    if (!currentRule) {
      setCreateRuleError('Regra não encontrada para edição.');
      return;
    }

    const { payload, error } = buildRulePayload(newRuleForm, currentRule.priority);
    if (!payload) {
      setCreateRuleError(error ?? 'Dados da regra inválidos.');
      return;
    }

    setUpdatingRule(true);
    try {
      await optimizationAPI.updateRule(editingRuleId, payload);
      setRuleActionSuccess(`Regra "${payload.name}" atualizada com sucesso.`);
      setShowCreateRuleModal(false);
      setRuleModalMode('create');
      setEditingRuleId(null);
      setActiveTab('rules');
      await loadData();
    } catch (error) {
      console.error('Error updating rule:', error);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Não foi possível atualizar a regra.';
      setCreateRuleError(errorMessage);
    } finally {
      setUpdatingRule(false);
    }
  };

  const handleDeleteRule = async (rule: OptimizationRule) => {
    setRuleActionError(null);
    setRuleActionSuccess(null);

    const shouldDelete = window.confirm(
      `Tem certeza que deseja excluir a regra "${rule.name}"? Essa ação não pode ser desfeita.`
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingRuleId(rule.id);
    try {
      await optimizationAPI.deleteRule(rule.id);
      setRuleActionSuccess(`Regra "${rule.name}" excluída com sucesso.`);
      await loadData();
    } catch (error) {
      console.error('Error deleting rule:', error);
      const errorMessage =
        (error as { response?: { data?: { error?: string } } }).response?.data?.error ||
        'Não foi possível excluir a regra.';
      setRuleActionError(errorMessage);
    } finally {
      setDeletingRuleId(null);
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
          <Button onClick={handleRunOptimization} disabled={!selectedAccountId} isLoading={runningOptimization}>
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

      {ruleActionSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {ruleActionSuccess}
        </div>
      )}

      {ruleActionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {ruleActionError}
        </div>
      )}

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
                    <div className="p-2 bg-white rounded-lg">{getSuggestionIcon(suggestion.suggestion_type)}</div>
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
                    <Button size="sm" variant="ghost" onClick={() => handleReject(suggestion.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleAccept(suggestion.id, false)}>
                      <Check className="h-4 w-4 mr-1" />
                      Aceitar
                    </Button>
                    <Button size="sm" onClick={() => handleAccept(suggestion.id, true)}>
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

      {activeTab === 'rules' && (
        <div className="space-y-4">
          <Card
            title="Regras de Otimização"
            description="Configure regras automáticas para otimizar suas campanhas"
            action={
              <Button size="sm" onClick={handleOpenCreateRuleModal}>
                <Settings className="h-4 w-4 mr-2" />
                Nova Regra
              </Button>
            }
          >
            {rules.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Nenhuma regra configurada</div>
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
                      {rule.description && <p className="text-sm text-gray-500 mt-1">{rule.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="ghost" onClick={() => handleOpenEditRuleModal(rule)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50 focus:ring-red-500"
                        onClick={() => handleDeleteRule(rule)}
                        isLoading={deletingRuleId === rule.id}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                      <button
                        onClick={() => handleToggleRule(rule.id, rule.is_active, rule.name)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          rule.is_active ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                        disabled={deletingRuleId === rule.id}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            rule.is_active ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {showCreateRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-3xl rounded-xl border border-gray-200 bg-white shadow-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {ruleModalMode === 'create' ? 'Nova Regra de Otimização' : 'Editar Regra de Otimização'}
                </h3>
                <p className="text-sm text-gray-500">
                  {ruleModalMode === 'create'
                    ? 'Use um preset sugerido ou configure manualmente.'
                    : 'Atualize os parâmetros da regra selecionada.'}
                </p>
              </div>
              <Button variant="ghost" onClick={handleCloseCreateRuleModal}>
                Fechar
              </Button>
            </div>

            <div className="space-y-4 px-6 py-4">
              {ruleModalMode === 'create' && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Sugestões de regras</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {RULE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-left hover:bg-gray-100 transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-900">{preset.title}</p>
                        <p className="text-xs text-gray-600 mt-1">{preset.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {createRuleError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {createRuleError}
                </div>
              )}

              <form
                className="space-y-4"
                onSubmit={ruleModalMode === 'create' ? handleCreateRule : handleUpdateRule}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Regra</label>
                    <input
                      type="text"
                      value={newRuleForm.name}
                      onChange={(event) => handleNewRuleChange('name', event.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Ex.: Pausar Anúncios com CPA Alto"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
                    <textarea
                      value={newRuleForm.description}
                      onChange={(event) => handleNewRuleChange('description', event.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Regra</label>
                    <select
                      value={newRuleForm.ruleType}
                      onChange={(event) => handleNewRuleChange('ruleType', event.target.value as RuleType)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="pause_ad">Pausar anúncio</option>
                      <option value="duplicate_ad">Duplicar anúncio</option>
                      <option value="increase_budget">Aumentar orçamento</option>
                      <option value="decrease_budget">Reduzir orçamento</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Campo da Condição</label>
                    <select
                      value={newRuleForm.conditionField}
                      onChange={(event) =>
                        handleNewRuleChange('conditionField', event.target.value as ConditionField)
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="cpa">CPA</option>
                      <option value="ctr">CTR (0.02 = 2%)</option>
                      <option value="roas">ROAS</option>
                      <option value="cpc">CPC</option>
                      <option value="spend">Gasto</option>
                      <option value="impressions">Impressões</option>
                      <option value="conversions">Conversões</option>
                      <option value="clicks">Cliques</option>
                      <option value="reach">Alcance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Operador</label>
                    <select
                      value={newRuleForm.conditionOperator}
                      onChange={(event) =>
                        handleNewRuleChange('conditionOperator', event.target.value as ConditionOperator)
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      <option value="gt">Maior que</option>
                      <option value="gte">Maior ou igual</option>
                      <option value="lt">Menor que</option>
                      <option value="lte">Menor ou igual</option>
                      <option value="eq">Igual a</option>
                      <option value="neq">Diferente de</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                    <input
                      type="number"
                      step="any"
                      value={newRuleForm.conditionValue}
                      onChange={(event) => handleNewRuleChange('conditionValue', event.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gasto mínimo</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newRuleForm.minSpendThreshold}
                      onChange={(event) => handleNewRuleChange('minSpendThreshold', event.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Impressões mínimas</label>
                    <input
                      type="number"
                      min="0"
                      value={newRuleForm.minImpressionsThreshold}
                      onChange={(event) => handleNewRuleChange('minImpressionsThreshold', event.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Período (dias)</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={newRuleForm.evaluationPeriodDays}
                      onChange={(event) => handleNewRuleChange('evaluationPeriodDays', event.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>

                  {(newRuleForm.ruleType === 'increase_budget' || newRuleForm.ruleType === 'decrease_budget') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Percentual de ajuste (%)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={newRuleForm.budgetPercentage}
                        onChange={(event) => handleNewRuleChange('budgetPercentage', event.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={handleCloseCreateRuleModal}>
                    Cancelar
                  </Button>
                  <Button type="submit" isLoading={ruleModalMode === 'create' ? creatingRule : updatingRule}>
                    {ruleModalMode === 'create' ? 'Criar Regra' : 'Salvar Alterações'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
