import { readFile } from 'node:fs/promises';
export async function readDesktopConfig(path, profile) {
  try {
    const value = JSON.parse(await readFile(path, 'utf8'));
    const url = new URL(value.apiUrl);
    const operational = profile === 'cozinha' || profile === 'bar';
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    const parts = url.hostname.split('.').map(Number);
    const privateNetwork = parts.length === 4 && parts.every(p => Number.isInteger(p) && p >= 0 && p <= 255)
      && (parts[0] === 10 || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31));
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/api'
      || (url.protocol !== 'https:' && !(url.protocol === 'http:' && (local || (operational && privateNetwork))))) throw new Error('URL inválida');
    if (!operational && (typeof value.token !== 'string' || !/^[A-Za-z0-9._~-]{32,}$/.test(value.token))) throw new Error('Token inválido');
    if (value.mesaId !== undefined && (!Number.isSafeInteger(value.mesaId) || value.mesaId < 1)) throw new Error('Mesa inválida');
    return { apiUrl: value.apiUrl.replace(/\/$/, ''), token: value.token, mesaId: value.mesaId };
  } catch { return null; }
}
export function allowedRequest(profile, value) {
  if (!value || typeof value !== 'object' || typeof value.path !== 'string' || typeof value.method !== 'string') return false;
  if (profile === 'cozinha' || profile === 'bar') {
    return value.method === 'GET' && ['/' + profile + '/itens', '/health', '/ready'].includes(value.path)
      || value.method === 'PATCH' && new RegExp('^/' + profile + '/itens/[1-9]\\d*/status$').test(value.path);
  }
  if (profile !== 'recepcao' && profile !== 'mesa') return false;
  const routes = profile === 'recepcao'
    ? { GET: [/^\/(health|ready|mesas)$/, /^\/mesas\/[1-9]\d*$/], POST: [/^\/clientes(\/busca)?$/, /^\/atendimentos$/, /^\/mesas\/[1-9]\d*\/(reservar|liberar)$/] }
    : { GET: [/^\/(health|ready)$/, /^\/acessos\/(mesa|dispositivo)$/, /^\/cardapio\/categorias$/, /^\/cardapio\/produtos(\?categoria=(PRATO|SOBREMESA|BEBIDA))?$/, /^\/cardapio\/produtos\/[1-9]\d*$/], POST: [/^\/acessos\/(mesa|dispositivo)$/, /^\/atendimentos\/[1-9]\d*\/pedidos$/], DELETE: [/^\/acessos\/mesa$/] };
  return routes[value.method]?.some(pattern => pattern.test(value.path)) ?? false;
}
export async function desktopRequest(profile, config, request) {
  if (!allowedRequest(profile, request)) return { status: 403, data: { error: { code: 'OPERACAO_NEGADA', message: 'Operação não permitida neste aplicativo.' } } };
  if (!config) return { status: 503, data: { error: { code: 'DESKTOP_NAO_CONFIGURADO', message: 'Configure o aplicativo com npm run setup:sprint e abra pelo Electron.' } } };
  const session = (request.path === '/acessos/mesa' && ['GET', 'DELETE'].includes(request.method))
    || /^\/cardapio\//.test(request.path)
    || /^\/atendimentos\/[1-9]\d*\/pedidos$/.test(request.path);
  if (session && (typeof request.sessionToken !== 'string' || !/^[A-Za-z0-9._~-]{32,}$/.test(request.sessionToken))) return { status: 401, data: { error: { code: 'SESSAO_INVALIDA', message: 'Sessão inválida.' } } };
  if (request.idempotencyKey !== undefined && (typeof request.idempotencyKey !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(request.idempotencyKey))) return { status: 400, data: { error: { code: 'CHAVE_INVALIDA', message: 'Chave da operação inválida.' } } };
  try {
    const body = request.body === undefined ? undefined : JSON.stringify(request.body);
    if (body && body.length > 32768) return { status: 413, data: { error: { code: 'ENTRADA_INVALIDA', message: 'Requisição muito grande.' } } };
    const response = await fetch(config.apiUrl + request.path, { method: request.method,
      headers: { ...(profile === 'cozinha' || profile === 'bar' ? {} : { Authorization: 'Bearer ' + (session ? request.sessionToken : config.token) }),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(request.idempotencyKey ? { 'Idempotency-Key': request.idempotencyKey } : {}) },
      ...(body !== undefined ? { body } : {}), signal: AbortSignal.timeout(12000) });
    return { status: response.status, data: response.status === 204 ? undefined : await response.json() };
  } catch { return { status: 0, data: { error: { code: 'SERVIDOR_INDISPONIVEL', message: 'Servidor indisponível. Verifique a conexão e tente novamente.' } } }; }
}

