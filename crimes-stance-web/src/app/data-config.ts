export const DATA_CONFIG = {
  // URL base para os datasets hospedados no Cloudflare R2
  // Buscado via 'define' no angular.json (injetado do .env)
  BASE_DATA_URL: (import.meta as any).env?.VITE_BASE_DATA_URL || ''
};
