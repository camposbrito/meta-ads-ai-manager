'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key';
    const jwtSecret = process.env.JWT_SECRET || 'default-secret';

    // Criar organização padrão
    await queryInterface.bulkInsert('organizations', [{
      id: 1,
      name: 'Campos Brito',
      subscription_plan: 'pro',
      subscription_status: 'active',
      meta_ad_account_limit: 5,
      syncs_per_day_limit: 4,
      team_members_limit: 10,
      data_retention_days: 90,
      created_at: new Date(),
      updated_at: new Date()
    }], {});

    // Criar usuário admin
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    await queryInterface.bulkInsert('users', [{
      id: 1,
      organization_id: 1,
      name: 'Admin User',
      email: 'admin@camposbrito.com.br',
      password: hashedPassword,
      role: 'admin',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }], {});

    // Criar regras de otimização padrão
    await queryInterface.bulkInsert('optimization_rules', [
      {
        id: 1,
        organization_id: 1,
        name: 'Pausar Anúncios com CPA Alto',
        rule_type: 'pause_ad',
        conditions: JSON.stringify([
          { field: 'cpa', operator: 'gt', value: 50 },
          { field: 'impressions', operator: 'gte', value: 1000 }
        ]),
        actions: JSON.stringify([{ type: 'pause' }]),
        min_spend_threshold: 100,
        evaluation_period_days: 7,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        organization_id: 1,
        name: 'Duplicar Anúncios Vencedores',
        rule_type: 'duplicate_ad',
        conditions: JSON.stringify([
          { field: 'ctr', operator: 'gt', value: 0.02 },
          { field: 'cpa', operator: 'lt', value: 20 }
        ]),
        actions: JSON.stringify([{ type: 'duplicate' }]),
        min_spend_threshold: 50,
        evaluation_period_days: 7,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 3,
        organization_id: 1,
        name: 'Aumentar Orçamento para ROAS Alto',
        rule_type: 'increase_budget',
        conditions: JSON.stringify([
          { field: 'roas', operator: 'gt', value: 3 }
        ]),
        actions: JSON.stringify([{ type: 'increase_budget', params: { percentage: 20 } }]),
        min_spend_threshold: 200,
        evaluation_period_days: 14,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});

    console.log('✅ Seed executado com sucesso!');
    console.log('📧 Email: admin@camposbrito.com.br');
    console.log('🔑 Senha: Admin@123');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('optimization_rules', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('organizations', null, {});
    console.log('❌ Seed desfeito.');
  }
};
