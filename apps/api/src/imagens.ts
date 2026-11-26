import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { exigir } from './modules/validacao';

export const diretorioImagens = fileURLToPath(new URL('../../../assets/cardapio/', import.meta.url));
export async function validarImagem(path: unknown): Promise<string | null> {
  if (path === undefined || path === null) return null;
  exigir(typeof path === 'string' && /^cardapio\/uploads\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path), 400, 'IMAGEM_INVALIDA', 'Selecione uma foto enviada pela administração.');
  const existe = await access(join(diretorioImagens, path.slice('cardapio/'.length))).then(() => true, () => false);
  exigir(existe, 400, 'IMAGEM_INEXISTENTE', 'Foto não encontrada. Envie a imagem novamente.');
  return path;
}
export function imagensRoutes() {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.post('/imagens', express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '5mb' }), async (req, res) => {
    const b: unknown = req.body;
    exigir(Buffer.isBuffer(b) && b.length > 12, 400, 'IMAGEM_INVALIDA', 'Envie uma foto PNG, JPEG ou WebP de até 5 MB.');
    const tipo = req.get('Content-Type')?.split(';')[0];
    const extensao = tipo === 'image/png' && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
      : tipo === 'image/jpeg' && b[0] === 255 && b[1] === 216 && b[2] === 255 ? 'jpg'
      : tipo === 'image/webp' && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null;
    exigir(extensao, 400, 'IMAGEM_INVALIDA', 'O arquivo não corresponde a uma foto PNG, JPEG ou WebP.');
    const arquivo = randomUUID() + '.' + extensao;
    await mkdir(join(diretorioImagens, 'uploads'), { recursive: true });
    await writeFile(join(diretorioImagens, 'uploads', arquivo), b, { flag: 'wx' });
    res.status(201).json({ imagemPath: 'cardapio/uploads/' + arquivo });
  });
  return router;
}
