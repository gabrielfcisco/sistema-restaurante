import assert from 'node:assert/strict';

// Compartilha a configuração entre a conexão administrativa e o adapter Prisma.
// A chave é fornecida pelo runner a partir do seu próprio container, sem habilitar
// allowPublicKeyRetrieval nem alterar o plugin de autenticação do servidor.
export function mysqlTestConfig(url: URL, withDatabase = false) {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Testes permitidos somente no banco local.');
  const key = process.env.TEST_MYSQL_RSA_PUBLIC_KEY;
  return {
    host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ...(withDatabase ? { database: decodeURIComponent(url.pathname.slice(1)) } : {}),
    ...(key ? { cachingRsaPublicKey: key } : {})
  };
}
