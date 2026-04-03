'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const organizationId = '11111111-1111-1111-1111-111111111111';
    const adminUserId = '22222222-2222-2222-2222-222222222222';

    await queryInterface.bulkInsert(
      'organizations',
      [
        {
          id: organizationId,
          name: 'Campos Brito',
          slug: 'campos-brito',
          plan: 'pro',
          max_ad_accounts: 5,
          max_daily_syncs: 4,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          subscription_status: 'active',
          subscription_ends_at: null,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      ],
      {}
    );

    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    await queryInterface.bulkInsert(
      'users',
      [
        {
          id: adminUserId,
          organization_id: organizationId,
          name: 'Admin User',
          email: 'admin@camposbrito.com.br',
          password_hash: hashedPassword,
          role: 'admin',
          is_active: true,
          last_login_at: null,
          created_at: now,
          updated_at: now,
        },
      ],
      {}
    );

    await queryInterface.bulkInsert(
      'optimization_rules',
      [
        {
          id: '33333333-3333-3333-3333-333333333333',
          organization_id: organizationId,
          name: 'Pausar Anúncios com CPA Alto',
          description: 'Pausa entidades com custo por aquisição acima do limite definido.',
          rule_type: 'pause_ad',
          conditions: JSON.stringify([
            { field: 'cpa', operator: 'gt', value: 50 },
            { field: 'impressions', operator: 'gte', value: 1000 },
          ]),
          actions: JSON.stringify([{ type: 'pause' }]),
          priority: 1,
          min_spend_threshold: 100,
          min_impressions_threshold: 0,
          evaluation_period_days: 7,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: '44444444-4444-4444-4444-444444444444',
          organization_id: organizationId,
          name: 'Duplicar Anúncios Vencedores',
          description: 'Duplica entidades de alta performance para escalar resultado.',
          rule_type: 'duplicate_ad',
          conditions: JSON.stringify([
            { field: 'ctr', operator: 'gt', value: 0.02 },
            { field: 'cpa', operator: 'lt', value: 20 },
          ]),
          actions: JSON.stringify([{ type: 'duplicate' }]),
          priority: 2,
          min_spend_threshold: 50,
          min_impressions_threshold: 0,
          evaluation_period_days: 7,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
        {
          id: '55555555-5555-5555-5555-555555555555',
          organization_id: organizationId,
          name: 'Aumentar Orçamento para ROAS Alto',
          description: 'Aumenta orçamento para entidades com ROAS consistente.',
          rule_type: 'increase_budget',
          conditions: JSON.stringify([{ field: 'roas', operator: 'gt', value: 3 }]),
          actions: JSON.stringify([{ type: 'increase_budget', params: { percentage: 20 } }]),
          priority: 3,
          min_spend_threshold: 200,
          min_impressions_threshold: 0,
          evaluation_period_days: 14,
          is_active: true,
          created_at: now,
          updated_at: now,
        },
      ],
      {}
    );

    console.log('✅ Seed executado com sucesso!');
    console.log('📧 Email: admin@camposbrito.com.br');
    console.log('🔑 Senha: Admin@123');
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('optimization_rules', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('organizations', null, {});
    console.log('❌ Seed desfeito.');
  },
};
