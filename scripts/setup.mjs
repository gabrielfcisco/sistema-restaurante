import { copyFile, constants } from 'node:fs/promises';
for (const app of ['api', 'recepcao', 'mesa']) {
  const directory = new URL('../apps/' + app + '/', import.meta.url);
  try {
    await copyFile(new URL('.env.example', directory), new URL('.env', directory), constants.COPYFILE_EXCL);
    console.log(app + ': .env criado');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(app + ': .env existente preservado');
  }
}

