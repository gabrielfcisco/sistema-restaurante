import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  console.error('Node incompatível: ' + process.version + '. Use Node 24 LTS e execute npm ci na pasta sistema-restaurante.');
  process.exit(1);
}

for (const name of ['recepcao', 'mesa']) {
  const require = createRequire(new URL('../apps/' + name + '/package.json', import.meta.url));
  try {
    if (!existsSync(require.resolve('@restaurante/desktop'))) throw new Error('Pacote ausente');
  } catch {
    console.error('Dependências de ' + name + ' desatualizadas: @restaurante/desktop não encontrado. Execute npm ci na pasta sistema-restaurante e tente novamente.');
    process.exit(1);
  }
}
