export class ErroApi extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function exigir(condicao: unknown, status: number, code: string, mensagem: string): asserts condicao {
  if (!condicao) throw new ErroApi(status, code, mensagem);
}
export function objeto(value: unknown): Record<string, unknown> {
  exigir(value && typeof value === 'object' && !Array.isArray(value), 400, 'ENTRADA_INVALIDA', 'Informe um objeto JSON.');
  return value as Record<string, unknown>;
}
export function id(value: unknown): number {
  exigir(typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 4294967295,
    400, 'ID_INVALIDO', 'Identificador inválido.');
  return value;
}
export function codigo(value: unknown): string {
  exigir(typeof value === 'string' && /^[0-9]{5}$/.test(value), 400, 'CODIGO_INVALIDO', 'Informe um código com 5 dígitos.');
  return value;
}
export function cpf(value: unknown): string {
  exigir(typeof value === 'string' && /^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(value), 400, 'CPF_INVALIDO', 'Informe um CPF válido.');
  const digits = value.replace(/\D/g, '');
  exigir(!/^(\d)\1{10}$/.test(digits), 400, 'CPF_INVALIDO', 'Informe um CPF válido.');
  for (const length of [9, 10]) {
    const sum = [...digits.slice(0, length)].reduce((total, digit, i) => total + Number(digit) * (length + 1 - i), 0);
    const expected = (sum * 10 % 11) % 10;
    exigir(expected === Number(digits[length]), 400, 'CPF_INVALIDO', 'Informe um CPF válido.');
  }
  return digits;
}
export function nome(value: unknown): string {
  exigir(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120,
    400, 'NOME_INVALIDO', 'Informe um nome de até 120 caracteres.');
  return value.trim();
}
export function telefone(value: unknown): string {
  exigir(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 32,
    400, 'TELEFONE_INVALIDO', 'Informe um telefone de até 32 caracteres.');
  return value.trim();
}
export function chave(value: unknown): string {
  exigir(typeof value === 'string' && /^[a-zA-Z0-9_-]{16,128}$/.test(value), 400, 'CHAVE_INVALIDA', 'Envie Idempotency-Key com 16 a 128 caracteres alfanuméricos, hífen ou sublinhado.');
  return value;
}

export function idRota(value: unknown): number {
  exigir(typeof value === 'string' && /^[1-9]\d*$/.test(value), 400, 'ID_INVALIDO', 'Identificador inválido.');
  return id(Number(value));
}

export function quantidadeItem(value: unknown): number {
  exigir(typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 1000,
    400, 'QUANTIDADE_INVALIDA', 'Informe uma quantidade inteira positiva.');
  return value;
}

export function observacaoItem(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  exigir(typeof value === 'string' && value.trim().length <= 500,
    400, 'OBSERVACAO_INVALIDA', 'A observação deve ter até 500 caracteres.');
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
