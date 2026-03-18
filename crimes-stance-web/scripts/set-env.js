const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Carrega .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const baseDataUrl = process.env.VITE_BASE_DATA_URL || '';

const envFileContent = `export const environment = {
  production: false,
  baseDataUrl: '${baseDataUrl}'
};
`;

const prodEnvFileContent = `export const environment = {
  production: true,
  baseDataUrl: '${baseDataUrl}'
};
`;

const targetDir = path.join(__dirname, '../src/app/environments');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

fs.writeFileSync(path.join(targetDir, 'environment.ts'), envFileContent);
fs.writeFileSync(path.join(targetDir, 'environment.development.ts'), envFileContent);
fs.writeFileSync(path.join(targetDir, 'environment.prod.ts'), prodEnvFileContent);

console.log('✅ Ambientes sincronizados com sucesso a partir do .env');
