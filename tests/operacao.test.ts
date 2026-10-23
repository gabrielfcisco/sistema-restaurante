import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createApp } from '../apps/api/src/app';
import { statusAgregado, type OperacaoService } from '../apps/api/src/modules/operacao/service';
import type { ItemFilaDto, SetorOperacional } from '@restaurante/contracts';
import { ErroApi } from '../apps/api/src/modules/validacao';
import { criarClienteOperacional, ordenarFila } from '../packages/api-client/src/operacao';
function item(idItem: number, setor: SetorOperacional): ItemFilaDto {
  return { idItem, idPedido: 1, idComanda: 2, idMesa: 1, numeroMesa: 8, nomeProduto: 'Produto fictício', quantidade: 2,
    observacao: null, setor, status: 'RECEBIDO', dataHora: '2026-10-22T12:00:00.000Z' };
}
async function withApi(service: OperacaoService, run: (url: string) => Promise<void>) {
  const server = createApp(async () => {}, { operacao: service, filaIntervalMs: 30 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run('http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api'); }
  finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}
test('agregado usa o estágio menos avançado, inclusive status legado', () => {
  assert.equal(statusAgregado(['PRONTO', 'EM_PREPARO', 'ENTREGUE']), 'EM_PREPARO');
  assert.equal(statusAgregado(['PENDENTE', 'PRONTO']), 'RECEBIDO');
  assert.equal(statusAgregado(['ENTREGUE', 'ENTREGUE']), 'ENTREGUE');
  assert.throws(() => statusAgregado([]), ErroApi);
  assert.throws(() => statusAgregado(['DESCONHECIDO']), ErroApi);
});
test('ordenação estável da fila usa chegada, pedido e item sem mutar a resposta', () => {
  const newer = { ...item(1, 'BAR'), dataHora: '2026-10-22T13:00:00.000Z' };
  const older = { ...item(3, 'BAR'), dataHora: '2026-10-22T11:00:00.000Z' };
  const original = [newer, item(2, 'BAR'), older, item(1, 'BAR')];
  assert.deepEqual(ordenarFila(original).map(i => i.idItem), [3, 1, 2, 1]);
  assert.equal(original[0], newer);
});
test('rotas públicas impõem setor no servidor, ignorando setor no query/body', async () => {
  const calls: string[] = [];
  const service: OperacaoService = {
    async listar(setor) { calls.push(setor); return [item(1, setor)]; },
    async avancar(setor, id, input) { calls.push(setor); assert.equal(id, 1); assert.equal(input.status, 'EM_PREPARO'); return { idItem: id, status: 'EM_PREPARO', statusPedido: 'RECEBIDO' }; }
  };
  await withApi(service, async url => {
    const kitchen = await fetch(url + '/cozinha/itens?setor=BAR');
    assert.equal(kitchen.status, 200);
    assert.equal(kitchen.headers.get('cache-control'), 'no-store');
    assert.equal((await kitchen.json())[0].setor, 'COZINHA');
    const bar = await fetch(url + '/bar/itens?setor=COZINHA');
    assert.equal((await bar.json())[0].setor, 'BAR');
    const updated = await fetch(url + '/cozinha/itens/1/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusAtual: 'RECEBIDO', status: 'EM_PREPARO', setor: 'BAR' }) });
    assert.equal(updated.status, 200);
    assert.deepEqual(calls, ['COZINHA', 'BAR', 'COZINHA']);
  });
});
test('PATCH valida IDs/status antes do serviço e preserva erro de concorrência', async () => {
  let calls = 0;
  await withApi({
    async listar() { return []; },
    async avancar() { calls++; throw new ErroApi(409, 'ITEM_ALTERADO', 'Outro operador atualizou o item.'); }
  }, async url => {
    const patch = (id: string, body: unknown) => fetch(url + '/bar/itens/' + id + '/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    for (const body of [null, {}, { statusAtual: 'RECEBIDO', status: 'PENDENTE' }, { statusAtual: 'ENTREGUE', status: 'PRONTO' }]) assert.equal((await patch('1', body)).status, 400);
    assert.equal((await patch('0', { statusAtual: 'RECEBIDO', status: 'EM_PREPARO' })).status, 400);
    assert.equal(calls, 0);
    const conflict = await patch('1', { statusAtual: 'RECEBIDO', status: 'EM_PREPARO' });
    assert.equal(conflict.status, 409); assert.equal((await conflict.json()).error.code, 'ITEM_ALTERADO');
  });
});
test('SSE envia snapshot, detecta inserção externa, publica falha e recupera sem misturar setores', async () => {
  const rows = { COZINHA: [item(1, 'COZINHA')], BAR: [item(2, 'BAR')] };
  let unavailable = false;
  await withApi({
    async listar(setor) { if (unavailable) throw new Error('credencial-secreta'); return [...rows[setor]]; },
    async avancar() { throw new Error('não utilizado'); }
  }, async url => {
    const controller = new AbortController();
    const response = await fetch(url + '/cozinha/eventos', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]) });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
    const reader = response.body!.getReader(), decoder = new TextDecoder(); let buffer = '';
    async function nextEvent(type: string) {
      for (;;) {
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
          if (frame.includes('event: ' + type)) return JSON.parse(frame.split('\n').find(l => l.startsWith('data: '))!.slice(6));
        }
        const value = await reader.read();
        assert.equal(value.done, false); buffer += decoder.decode(value.value, { stream: true });
      }
    }
    try {
      assert.deepEqual((await nextEvent('fila')).itens.map((i: ItemFilaDto) => i.idItem), [1]);
      rows.COZINHA.push(item(3, 'COZINHA'));
      const added = await nextEvent('fila');
      assert.deepEqual(added.itens.map((i: ItemFilaDto) => i.idItem), [1, 3]);
      assert.equal(JSON.stringify(added).includes('"BAR"'), false);
      unavailable = true;
      assert.deepEqual(await nextEvent('indisponivel'), {});
      unavailable = false;
      assert.equal((await nextEvent('fila')).itens.length, 2);
    } finally { controller.abort(); await reader.cancel().catch(() => {}); }
  });
});

test('cliente SSE preserva evento mais novo que GET pendente, reconcilia na reconexão e fecha stream', async () => {
  const previous = globalThis.EventSource;
  class TestStream extends EventTarget {
    static instances: TestStream[] = [];
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    closed = false;
    constructor(public url: string) { super(); TestStream.instances.push(this); }
    close() { this.closed = true; }
  }
  globalThis.EventSource = TestStream as unknown as typeof EventSource;
  let resolveInitial: (value: ItemFilaDto[]) => void = () => {};
  let calls = 0;
  const wait = async (condition: () => boolean) => {
    for (let i = 0; i < 100; i++) { if (condition()) return; await new Promise(r => setTimeout(r, 20)); }
    assert.fail('Condição não ocorreu no prazo.');
  };
  try {
    await withApi({
      async listar() { calls++; return calls === 1 ? new Promise(resolve => { resolveInitial = resolve; }) : [item(3, 'COZINHA')]; },
      async avancar() { throw new Error('não utilizado'); }
    }, async url => {
      let current: ItemFilaDto[] = [], connection = '';
      const cancel = criarClienteOperacional(url, 'COZINHA').acompanhar({ itens: data => { current = data; }, conexao: value => { connection = value; } });
      try {
        await wait(() => calls === 1);
        const stream = TestStream.instances[0];
        assert.equal(stream.url, url + '/cozinha/eventos');
        stream.dispatchEvent(new MessageEvent('fila', { data: JSON.stringify({ itens: [item(2, 'COZINHA')] }) }));
        resolveInitial([item(1, 'COZINHA')]);
        await new Promise(r => setTimeout(r, 40));
        assert.equal(current[0].idItem, 2);
        stream.onerror?.(); assert.equal(connection, 'reconectando');
        stream.onopen?.();
        await wait(() => current[0]?.idItem === 3);
        assert.equal(connection, 'conectado');
        stream.dispatchEvent(new MessageEvent('fila', { data: JSON.stringify({ itens: [item(4, 'BAR')] }) }));
        assert.equal(current[0].idItem, 3);
        assert.equal(connection, 'reconectando');
      } finally { cancel(); assert.equal(TestStream.instances[0].closed, true); }
    });
  } finally { globalThis.EventSource = previous; }
});
