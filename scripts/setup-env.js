const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = process.cwd();

function generateSecureKey() {
  return crypto.randomBytes(32).toString('hex');
}

function setupEnvFile(filePath, envVars = {}) {
  if (!fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath + '.example', 'utf8');
    
    Object.entries(envVars).forEach(([key, value]) => {
      const regex = new RegExp(`^${key}=.*`, 'm');
      if (regex.test(content)) {
        content = content.replace(regex, `${key}=${value}`);
      }
    });
    
    fs.writeFileSync(filePath, content);
    console.log(`✅ ${path.basename(filePath)} criado`);
  } else {
    console.log(`ℹ️  ${path.basename(filePath)} já existe`);
  }
}

console.log('🚀 Configurando ambiente...\n');

// Gerar chaves seguras
const encryptionKey = generateSecureKey();
const jwtSecret = generateSecureKey();

// Setup backend .env
const backendEnvPath = path.join(rootDir, 'backend', '.env');
const backendEnvExample = path.join(rootDir, '.env.example');

if (fs.existsSync(backendEnvExample)) {
  let content = fs.readFileSync(backendEnvExample, 'utf8');
  
  content = content.replace(/^ENCRYPTION_KEY=.*/m, `ENCRYPTION_KEY=${encryptionKey}`);
  content = content.replace(/^JWT_SECRET=.*/m, `JWT_SECRET=${jwtSecret}`);
  
  fs.writeFileSync(backendEnvPath, content);
  console.log('✅ backend/.env configurado');
}

// Setup frontend .env
const frontendEnvPath = path.join(rootDir, 'frontend', '.env');
const frontendEnvContent = 'VITE_API_URL=http://localhost:3000/api\n';

if (!fs.existsSync(frontendEnvPath)) {
  fs.writeFileSync(frontendEnvPath, frontendEnvContent);
  console.log('✅ frontend/.env criado');
} else {
  console.log('ℹ️  frontend/.env já existe');
}

console.log('\n✨ Setup concluído!\n');
console.log('Próximos passos:');
console.log('  npm run setup:backend  - Instalar dependências e rodar migrations');
console.log('  npm run setup:frontend - Instalar dependências do frontend');
console.log('  npm run dev            - Rodar em desenvolvimento');
