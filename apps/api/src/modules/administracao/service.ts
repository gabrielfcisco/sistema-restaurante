import type { AlterarCategoriaInput, CategoriaDto } from '@restaurante/contracts';
import type { PrismaClient } from '../../generated/prisma/client';
import { ErroApi, exigir, nome } from '../validacao';
import { erroBanco } from '../sprint-service';

export interface CategoriasService {
  listar(): Promise<CategoriaDto[]>;
  criar(value: string): Promise<CategoriaDto>;
  alterar(id: string, input: AlterarCategoriaInput): Promise<CategoriaDto>;
}
export class PrismaCategoriasService implements CategoriasService {
  constructor(private db: () => PrismaClient) {}
  listar() { return this.db().categoria.findMany({ orderBy: { nome: 'asc' } }); }
  async criar(value: string) {
    try { return await this.db().categoria.create({ data: { nome: nome(value) } }); }
    catch (error) { throw this.erro(error); }
  }
  async alterar(idCategoria: string, input: AlterarCategoriaInput) {
    exigir(input.nome !== undefined || input.ativo !== undefined, 400, 'ENTRADA_INVALIDA', 'Informe nome ou status.');
    exigir(input.ativo === undefined || typeof input.ativo === 'boolean', 400, 'STATUS_INVALIDO', 'Informe ativo como booleano.');
    try {
      return await this.db().categoria.update({ where: { idCategoria }, data: {
        ...(input.nome !== undefined ? { nome: nome(input.nome) } : {}),
        ...(input.ativo !== undefined ? { ativo: input.ativo } : {})
      } });
    } catch (error) { throw this.erro(error); }
  }
  private erro(error: unknown) {
    return (error as { code?: string })?.code === 'P2002'
      ? new ErroApi(409, 'CATEGORIA_DUPLICADA', 'Já existe uma categoria com este nome.') : erroBanco(error);
  }
}
