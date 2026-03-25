import { Sequelize, QueryInterface, DataTypes } from 'sequelize';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME!,
  process.env.DB_USER!,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    logging: console.log,
  }
);

async function runMigrations() {
  const migrationsPath = path.join(__dirname, '..', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsPath)
    .filter(f => f.endsWith('.ts'))
    .sort();

  console.log('📋 Migrações encontradas:', migrationFiles.length);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS sequelize_meta (
      name VARCHAR(255) PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [executed]: any = await sequelize.query('SELECT name FROM sequelize_meta');
  const executedNames = new Set(executed.map((r: any) => r.name));

  for (const file of migrationFiles) {
    if (executedNames.has(file)) {
      console.log(`⏭️  Pulando: ${file}`);
      continue;
    }

    console.log(`🔄 Executando: ${file}`);
    
    const migration = require(path.join(migrationsPath, file));
    const queryInterface = sequelize.getQueryInterface();
    
    await migration.up(queryInterface);
    
    await sequelize.query('INSERT INTO sequelize_meta (name) VALUES (?)', {
      replacements: [file]
    });
    
    console.log(`✅ Concluído: ${file}`);
  }

  console.log('\n✨ Migrations concluídas!');
}

async function runSeed() {
  console.log('\n🌱 Executando seed...');

  const queryInterface = sequelize.getQueryInterface();
  
  // Criar organização padrão
  await queryInterface.bulkInsert('organizations', [{
    id: 'org-001',
    name: 'Campos Brito',
    slug: 'campos-brito',
    plan: 'pro',
    max_ad_accounts: 5,
    max_daily_syncs: 4,
    subscription_status: 'active',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  }]);

  // Criar usuário admin
  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  await queryInterface.bulkInsert('users', [{
    id: 'user-001',
    organization_id: 'org-001',
    name: 'Admin User',
    email: 'admin@camposbrito.com.br',
    password_hash: hashedPassword,
    role: 'admin',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  }]);

  // Criar regras de otimização padrão
  await queryInterface.bulkInsert('optimization_rules', [
    {
      id: 'rule-001',
      organization_id: 'org-001',
      name: 'Pausar Anúncios com CPA Alto',
      rule_type: 'pause_ad',
      conditions: JSON.stringify([
        { field: 'cpa', operator: 'gt', value: 50 },
        { field: 'impressions', operator: 'gte', value: 1000 }
      ]),
      actions: JSON.stringify([{ type: 'pause' }]),
      priority: 1,
      min_spend_threshold: 100,
      min_impressions_threshold: 0,
      evaluation_period_days: 7,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'rule-002',
      organization_id: 'org-001',
      name: 'Duplicar Anúncios Vencedores',
      rule_type: 'duplicate_ad',
      conditions: JSON.stringify([
        { field: 'ctr', operator: 'gt', value: 0.02 },
        { field: 'cpa', operator: 'lt', value: 20 }
      ]),
      actions: JSON.stringify([{ type: 'duplicate' }]),
      priority: 2,
      min_spend_threshold: 50,
      min_impressions_threshold: 0,
      evaluation_period_days: 7,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'rule-003',
      organization_id: 'org-001',
      name: 'Aumentar Orçamento para ROAS Alto',
      rule_type: 'increase_budget',
      conditions: JSON.stringify([
        { field: 'roas', operator: 'gt', value: 3 }
      ]),
      actions: JSON.stringify([{ type: 'increase_budget', params: { percentage: 20 } }]),
      priority: 3,
      min_spend_threshold: 200,
      min_impressions_threshold: 0,
      evaluation_period_days: 14,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);

  console.log('✅ Seed executado com sucesso!');
  console.log('\n📧 Email: admin@camposbrito.com.br');
  console.log('🔑 Senha: Admin@123');
}

async function main() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco de dados!');
    
    await runMigrations();
    await runSeed();
    
    console.log('\n🎉 Setup concluído com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

main();
