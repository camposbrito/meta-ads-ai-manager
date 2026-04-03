const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
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

  const [executed] = await sequelize.query('SELECT name FROM sequelize_meta');
  const executedNames = new Set(executed.map(r => r.name));

  for (const file of migrationFiles) {
    if (executedNames.has(file)) {
      console.log(`⏭️  Pulando: ${file}`);
      continue;
    }

    console.log(`🔄 Executando: ${file}`);
    
    const migration = require(path.join(migrationsPath, file));
    
    const queryInterface = sequelize.getQueryInterface();
    
    await migration.up(queryInterface, Sequelize);
    
    await sequelize.query('INSERT INTO sequelize_meta (name) VALUES (?)', {
      replacements: [file]
    });
    
    console.log(`✅ Concluído: ${file}`);
  }

  console.log('\n✨ Todas as migrations foram executadas com sucesso!');
  process.exit(0);
}

runMigrations().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
