import { randomBytes } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
const files = ['apps/recepcao/.desktop-config.json', 'apps/mesa/.desktop-config.json'];
for (const path of files) {
  try { await access(new URL('../' + path, import.meta.url)); throw new Error('Configuração desktop existente. Preserve as credenciais e ajuste manualmente.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const apiPath = new URL('../apps/api/.env', import.meta.url);
let text = await readFile(apiPath, 'utf8');
const value = key => (text.match(new RegExp('^' + key + '=(.*)$', 'm'))?.[1] ?? '').trim().replace(/^(['"])(.*)\1$/, '$2');
if (value('RECEPCAO_API_TOKEN') || !['', '{}'].includes(value('MESA_DEVICE_TOKENS'))) throw new Error('API já configurada. Provisione os aplicativos com as credenciais existentes conforme docs/interfaces.md.');
const recepcao = randomBytes(24).toString('hex'), device = randomBytes(24).toString('hex');
text = text.replace(/^RECEPCAO_API_TOKEN=.*\r?\n?/gm, '').replace(/^MESA_DEVICE_TOKENS=.*\r?\n?/gm, '');
text += '\nRECEPCAO_API_TOKEN=' + recepcao + '\nMESA_DEVICE_TOKENS=' + JSON.stringify({ '1': device }) + '\n';
await writeFile(apiPath, text);
for (const [i, token] of [recepcao, device].entries()) {
  await writeFile(new URL('../' + files[i], import.meta.url), JSON.stringify({ apiUrl: 'http://127.0.0.1:3333/api', token }, null, 2), { flag: 'wx' });
}
console.log('Recepção e dispositivo da mesa 1 configurados. Tokens ficam no processo Electron, fora do React.');

