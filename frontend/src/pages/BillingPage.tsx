import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { billingAPI } from '../services/api';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import type { BillingSubscription, Plan } from '../types';

export function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<BillingSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plansRes, subscriptionRes] = await Promise.all([
        billingAPI.getPlans(),
        billingAPI.getSubscription(),
      ]);
      setPlans(plansRes.data.plans);
      setCurrentPlan(subscriptionRes.data.plan);
    } catch (error) {
      console.error('Error loading billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan: string) => {
    setUpgradingPlanId(plan);
    try {
      const response = await billingAPI.upgrade(plan, billingCycle);
      const checkoutUrl = response.data.checkout_url;

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      await loadData();
    } catch (error) {
      console.error('Error upgrading plan:', error);
    } finally {
      setUpgradingPlanId(null);
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
        <h1 className="text-2xl font-bold text-gray-900">Planos e Preços</h1>
        
        {/* Billing Cycle Toggle */}
        <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              billingCycle === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600'
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              billingCycle === 'yearly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600'
            }`}
          >
            Anual <span className="text-green-600 text-xs ml-1">-17%</span>
          </button>
        </div>
      </div>

      {/* Current Plan */}
      {currentPlan && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Plano Atual</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {currentPlan.name}
              </p>
              {currentPlan.status && (
                <p className="text-sm text-gray-500 mt-1">
                  Status: {currentPlan.status}
                  {currentPlan.ends_at && ` - Até ${new Date(currentPlan.ends_at).toLocaleDateString()}`}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Limites</p>
              <p className="text-sm text-gray-500">
                {currentPlan.usage?.ad_accounts} contas de anúncio
              </p>
              <p className="text-sm text-gray-500">
                {currentPlan.usage?.daily_syncs} sincronizações diárias
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative ${
              plan.popular ? 'ring-2 ring-blue-600' : ''
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Mais Popular
                </span>
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900">
                  R$ {billingCycle === 'monthly' ? plan.monthly_price : plan.yearly_price}
                </span>
                <span className="text-gray-500">
                  /{billingCycle === 'monthly' ? 'mês' : 'ano'}
                </span>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                  <span className="text-sm text-gray-600">{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              variant={currentPlan?.id === plan.id ? 'secondary' : 'primary'}
              className="w-full"
              onClick={() => handleUpgrade(plan.id)}
              isLoading={upgradingPlanId === plan.id}
              disabled={currentPlan?.id === plan.id}
            >
              {currentPlan?.id === plan.id ? 'Plano Atual' : 'Assinar'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
