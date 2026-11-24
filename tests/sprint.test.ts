import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createApp } from '../apps/api/src/app';
import { cpf, codigo, nome, id, chave, ErroApi } from '../apps/api/src/modules/validacao';
import type { SprintService } from '../apps/api/src/modules/sprint-service';

const recepcaoToken = 'recepcao-ficticia-para-testes-000000';
const deviceToken = 'tablet-ficticio-para-testes-00000000';
const access = { recepcaoToken, dispositivos: [{ token: deviceToken, idMesa: 8 }], sessionSeconds: 600 };
async function http(run: (url: string) => Promise<void>, service: Partial<SprintService> = {}) {
  const server = createApp(async () => {}, { service: { mesaDispositivo: async (_token: string, idMesa: number) => ({ idMesa, numero: idMesa }), ...service } as SprintService, access }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api`); }
  finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}
function post(url: string, body: unknown, token = recepcaoToken, extra = {}) {
  return fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) });
}
test('validação runtime: CPF com dígitos verificadores, nome, código físico, IDs e chave', () => {
  // CPF sintético gerado para testes, sem vínculo com pessoa real.
  assert.equal(cpf('123.456.789-09'), '12345678909');
  for (const value of ['11111111111', '12345678900', 'abc12345678909', null, 12345678909]) assert.throws(() => cpf(value), ErroApi);
  assert.equal(codigo('01234'), '01234');
  for (const value of ['1234', '123456', '12a45', 12345]) assert.throws(() => codigo(value), ErroApi);
  assert.equal(nome(' Cliente fictício '), 'Cliente fictício');
  assert.throws(() => nome(' '), ErroApi);
  for (const value of [0, -1, 1.5, '1', 4294967296]) assert.throws(() => id(value), ErroApi);
  assert.throws(() => chave(''), ErroApi);
});
test('rotas da recepção exigem credencial e validam corpo antes de persistir', async () => {
  await http(async url => {
    assert.equal((await fetch(url + '/mesas')).status, 401);
    assert.equal((await post(url + '/clientes', { nome: 'Teste', cpf: '11111111111' })).status, 400);
    assert.equal((await post(url + '/clientes/busca', null)).status, 400);
    assert.equal((await fetch(url + '/mesas/1.5', { headers: { Authorization: `Bearer ${recepcaoToken}` } })).status, 400);
    assert.equal((await post(url + '/atendimentos', { idCliente: 1, idMesa: 8, codigoCartao: '58324' })).status, 400);
    assert.equal((await post(url + '/atendimentos', { idCliente: 1, idMesa: 8, codigoCartao: '58324', confirmarMesaOcupada: 'true' })).status, 400);
  });
});
test('busca normaliza CPF e erros de negócio preservam código sem vazar internos', async () => {
  await http(async url => {
    const found = await post(url + '/clientes/busca', { cpf: '123.456.789-09' });
    assert.equal(found.status, 200);
    assert.equal((await found.json()).idCliente, 1);
    const duplicate = await post(url + '/clientes', { nome: 'Teste', cpf: '12345678909', telefone: '(11) 00000-0000' });
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error.code, 'CPF_DUPLICADO');
  }, {
    buscarCliente: async value => { assert.equal(value, '12345678909'); return { idCliente: 1, nome: 'Teste', cpf: value, telefone: '(11) 00000-0000' }; },
    criarCliente: async () => { throw new ErroApi(409, 'CPF_DUPLICADO', 'CPF já cadastrado.'); }
  });
});
test('cadastro exige telefone e repassa o valor preenchido ao serviço', async () => {
  let calls = 0;
  await http(async url => {
    for (const telefone of [undefined, null, '', '   ', 11000000000, '1'.repeat(33)]) {
      const response = await post(url + '/clientes', { nome: 'Cliente fictício', cpf: '12345678909', telefone });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'TELEFONE_INVALIDO');
    }
    assert.equal(calls, 0);
    const response = await post(url + '/clientes', { nome: 'Cliente fictício', cpf: '12345678909', telefone: ' (11) 00000-0000 ' });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).telefone, '(11) 00000-0000');
    assert.equal(calls, 1);
  }, { criarCliente: async input => {
    calls++;
    assert.equal(input.telefone, '(11) 00000-0000');
    return { idCliente: 1, ...input };
  } });
});
test('acesso usa mesa da credencial, retorna identificação e bloqueia troca de mesa no corpo', async () => {
  let calls = 0;
  await http(async url => {
    assert.equal((await post(url + '/acessos/mesa', { codigoCartao: '58324', idMesa: 9 }, deviceToken)).status, 403);
    assert.equal(calls, 0);
    const response = await post(url + '/acessos/mesa', { codigoCartao: '58324' }, deviceToken);
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.numeroMesa, 8);
    assert.equal(body.nomeCliente, 'Cliente teste');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await post(url + '/acessos/mesa', { codigoCartao: '58324' }, recepcaoToken)).status, 401);
    for (let i = 0; i < 8; i++) await post(url + '/acessos/mesa', { codigoCartao: '58324' }, deviceToken);
    const limited = await post(url + '/acessos/mesa', { codigoCartao: '58324' }, deviceToken);
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get('retry-after'));
  }, { acessar: async (code, mesa) => {
    calls++; assert.equal(mesa, 8); assert.equal(code, '58324');
    return { token: 'sessao', expiraEm: new Date().toISOString(), idComanda: 1, codigoCartao: code, idMesa: mesa, numeroMesa: 8, nomeCliente: 'Cliente teste' };
  } });
});
test('logout responde 204 e erro inesperado não expõe segredo', async () => {
  await http(async url => {
    assert.equal((await fetch(url + '/acessos/mesa', { method: 'DELETE', headers: { Authorization: 'Bearer sessao' } })).status, 204);
    const response = await fetch(url + '/mesas', { headers: { Authorization: `Bearer ${recepcaoToken}` } });
    assert.equal(response.status, 500);
    assert.doesNotMatch(await response.text(), /segredo/);
  }, { sair: async token => { assert.equal(token, 'sessao'); }, listarMesas: async () => { throw new Error('segredo'); } });
});
test('consulta de sessão usa Bearer e preserva erros de expiração e revogação', async () => {
  await http(async url => {
    assert.equal((await fetch(url + '/acessos/mesa')).status, 401);
    const valid = await fetch(url + '/acessos/mesa', { headers: { Authorization: 'Bearer sessao-valida' } });
    assert.equal(valid.status, 200);
    assert.equal((await valid.json()).nomeCliente, 'Cliente fictício');
    const revoked = await fetch(url + '/acessos/mesa', { headers: { Authorization: 'Bearer revogada' } });
    assert.equal(revoked.status, 401);
    assert.equal((await revoked.json()).error.code, 'SESSAO_INVALIDA');
  }, { sessao: async token => {
    if (token !== 'sessao-valida') throw new ErroApi(401, 'SESSAO_INVALIDA', 'Sessão inválida.');
    return { expiraEm: new Date().toISOString(), idComanda: 1, codigoCartao: '01234', idMesa: 8, numeroMesa: 8, nomeCliente: 'Cliente fictício' };
  } });
});

test('QR administrativo altera a mesa validada, exige dispositivo e rejeita números inválidos', async () => {
  let atual = { idMesa: 8, numero: 8 };
  let alteracoes = 0;
  await http(async url => {
    assert.equal((await fetch(url + '/acessos/dispositivo')).status, 401);
    assert.equal((await post(url + '/acessos/dispositivo', { numero: 42, codigoAdmin: 'adm1234' })).status, 401);
    assert.equal((await post(url + '/acessos/dispositivo', { numero: 42, codigoAdmin: 'errado' }, deviceToken)).status, 403);
    for (const numero of [0, -1, 1.5, '42', 4294967296]) {
      assert.equal((await post(url + '/acessos/dispositivo', { numero, codigoAdmin: 'adm1234' }, deviceToken)).status, 400);
    }
    assert.equal(alteracoes, 0);
    const inicial = await fetch(url + '/acessos/dispositivo', { headers: { Authorization: `Bearer ${deviceToken}` } });
    assert.deepEqual(await inicial.json(), atual);
    const saved = await post(url + '/acessos/dispositivo', { numero: 42, codigoAdmin: 'adm1234' }, deviceToken);
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { idMesa: 9, numero: 42 });
    assert.equal((await post(url + '/acessos/mesa', { codigoCartao: '01234', idMesa: 8 }, deviceToken)).status, 403);
    assert.equal((await post(url + '/acessos/mesa', { codigoCartao: '01234' }, deviceToken)).status, 201);
    assert.equal((await post(url + '/acessos/mesa', { codigoCartao: '88888' }, deviceToken)).status, 403);
  }, {
    mesaDispositivo: async token => { assert.equal(token, deviceToken); return atual; },
    configurarDispositivo: async (token, numero) => { assert.equal(token, deviceToken); assert.equal(numero, 42); alteracoes++; atual = { idMesa: 9, numero }; return atual; },
    acessar: async (codigoCartao, idMesa) => {
      assert.equal(idMesa, 9);
      if (codigoCartao === '88888') throw new ErroApi(403, 'MESA_INCORRETA', 'Esta comanda pertence a outra mesa.');
      return { token: 'sessao', expiraEm: new Date().toISOString(), idComanda: 1, codigoCartao, idMesa, numeroMesa: 42, nomeCliente: 'Cliente fictício' };
    }
  });
});

test('US-10/11: confirmação de pedido exige sessão, chave de idempotência, itens válidos e recalcula totais e setores', async () => {
  let confirmacoes = 0;
  const sessaoToken = 'sessao-mesa-valida-00000000000000';
  await http(async url => {
    assert.equal((await fetch(url + '/atendimentos/1/pedidos', { method: 'POST' })).status, 401);
    assert.equal((await post(url + '/atendimentos/1/pedidos', { itens: [] }, sessaoToken, { 'Idempotency-Key': 'chave-pedido-valida-0001' })).status, 400);
    assert.equal((await post(url + '/atendimentos/1/pedidos', { itens: [{ idProduto: 1, quantidade: 0 }] }, sessaoToken, { 'Idempotency-Key': 'chave-pedido-valida-0001' })).status, 400);
    assert.equal((await post(url + '/atendimentos/1/pedidos', { itens: [{ idProduto: 1, quantidade: -2 }] }, sessaoToken, { 'Idempotency-Key': 'chave-pedido-valida-0001' })).status, 400);
    assert.equal((await post(url + '/atendimentos/1/pedidos', { itens: [{ idProduto: 1, quantidade: 1.5 }] }, sessaoToken, { 'Idempotency-Key': 'chave-pedido-valida-0001' })).status, 400);
    assert.equal((await post(url + '/atendimentos/1/pedidos', { itens: [{ idProduto: 1, quantidade: 1 }] }, sessaoToken)).status, 400);
    assert.equal(confirmacoes, 0);

    const created = await post(url + '/atendimentos/1/pedidos', {
      itens: [
        { idProduto: 10, quantidade: 2, preco: 0.01, setor: 'BAR', observacao: ' Ao ponto ' },
        { idProduto: 20, quantidade: 2, preco: 0.01, setor: 'COZINHA' }
      ]
    }, sessaoToken, { 'Idempotency-Key': 'chave-pedido-valida-0001' });
    assert.equal(created.status, 201);
    const body = await created.json();
    assert.equal(body.idPedido, 5801);
    assert.equal(body.total, 120);
    assert.equal(body.status, 'RECEBIDO');
    assert.equal(body.itens[0].setor, 'COZINHA');
    assert.equal(body.itens[0].subtotal, 96);
    assert.equal(body.itens[0].observacao, 'Ao ponto');
    assert.equal(body.itens[1].setor, 'BAR');
    assert.equal(body.itens[1].subtotal, 24);
    assert.equal(confirmacoes, 1);
  }, {
    confirmarPedido: async (idComanda, input, token, key) => {
      confirmacoes++;
      assert.equal(idComanda, 1);
      assert.equal(token, sessaoToken);
      assert.equal(key, 'chave-pedido-valida-0001');
      assert.deepEqual(input.itens, [
        { idProduto: 10, quantidade: 2, observacao: 'Ao ponto' },
        { idProduto: 20, quantidade: 2, observacao: null }
      ]);
      return {
        replay: false,
        dto: {
          idPedido: 5801, idComanda: 1, idMesa: 8, numeroMesa: 8, status: 'RECEBIDO',
          dataHora: '2026-10-26T12:00:00.000Z', total: 120,
          itens: [
            { idItem: 1, idProduto: 10, nomeProduto: 'Filé ao molho', quantidade: 2, precoUnitario: 48, subtotal: 96, observacao: 'Ao ponto', setor: 'COZINHA', status: 'RECEBIDO' },
            { idItem: 2, idProduto: 20, nomeProduto: 'Suco de laranja', quantidade: 2, precoUnitario: 12, subtotal: 24, observacao: null, setor: 'BAR', status: 'RECEBIDO' }
          ]
        }
      };
    }
  });
});

test('US-18/21: cria chamadas autenticadas sem duplicação, lista/conclui e consulta extrato somente da própria comanda', async () => {
  const sessao = 'sessao-us18-us21-ficticia-000000000';
  const extrato = { idComanda: 1, itens: [{ idItem: 1, idPedido: 10, nomeProduto: 'Prato fictício', quantidade: 2, precoUnitario: 0.1, subtotal: 0.2, status: 'EM_PREPARO' as const }], total: 0.2 };
  let concluidos = 0;
  await http(async url => {
    const semSessao = await fetch(url + '/atendimentos/1/extrato');
    assert.equal(semSessao.status, 401);
    assert.equal((await fetch(url + '/atendimentos/2/extrato', { headers: { Authorization: `Bearer ${sessao}` } })).status, 403);
    const chamada = await post(url + '/atendimentos/1/chamados', {}, sessao);
    assert.equal(chamada.status, 201);
    assert.equal((await chamada.json()).idChamada, 5);
    assert.equal((await post(url + '/atendimentos/1/chamados', {}, sessao)).status, 201);
    const snapshot = await fetch(url + '/garcom/chamados');
    assert.equal(snapshot.status, 200);
    assert.equal((await snapshot.json()).length, 1);
    const invalid = await fetch(url + '/garcom/chamados/5/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'PENDENTE' }) });
    assert.equal(invalid.status, 400);
    const done = await fetch(url + '/garcom/chamados/5/status', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CONCLUIDA' }) });
    assert.equal(done.status, 200);
    assert.equal((await done.json()).status, 'CONCLUIDA');
    assert.equal(concluidos, 1);
    const response = await fetch(url + '/atendimentos/1/extrato', { headers: { Authorization: `Bearer ${sessao}` } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), extrato);
  }, {
    criarChamada: async (idComanda, token) => {
      assert.equal(token, sessao); assert.equal(idComanda, 1);
      return { idChamada: 5, idMesa: 8, numeroMesa: 8, status: 'PENDENTE', criadaEm: '2026-11-03T12:00:00.000Z' };
    },
    listarChamados: async () => [{ idChamada: 5, idMesa: 8, numeroMesa: 8, status: 'PENDENTE', criadaEm: '2026-11-03T12:00:00.000Z' }],
    concluirChamada: async idChamada => {
      assert.equal(idChamada, 5); concluidos++;
      return { idChamada, idMesa: 8, numeroMesa: 8, status: 'CONCLUIDA', criadaEm: '2026-11-03T12:00:00.000Z' };
    },
    extratoComanda: async (idComanda, token) => {
      assert.equal(token, sessao);
      if (idComanda !== 1) throw new ErroApi(403, 'COMANDA_INCORRETA', 'A sessão não pertence à comanda informada.');
      return extrato;
    }
  });
});

test('US-07: cardápio por categorias exige sessão, filtra produtos ativos e valida parâmetros', async () => {
  const sessaoToken = 'sessao-mesa-valida-00000000000000';
  await http(async url => {
    // Exige autenticação de sessão
    assert.equal((await fetch(url + '/cardapio/categorias')).status, 401);
    assert.equal((await fetch(url + '/cardapio/produtos')).status, 401);

    // Consulta categorias válidas
    const resCategorias = await fetch(url + '/cardapio/categorias', {
      headers: { Authorization: `Bearer ${sessaoToken}` }
    });
    assert.equal(resCategorias.status, 200);
    assert.deepEqual(await resCategorias.json(), ['PRATO', 'SOBREMESA', 'BEBIDA']);

    // Rejeita categoria inválida
    const invalida = await fetch(url + '/cardapio/produtos?categoria=INVALIDA', {
      headers: { Authorization: `Bearer ${sessaoToken}` }
    });
    assert.equal(invalida.status, 400);

    // Consulta produtos filtrados por categoria
    const resPratos = await fetch(url + '/cardapio/produtos?categoria=PRATO', {
      headers: { Authorization: `Bearer ${sessaoToken}` }
    });
    assert.equal(resPratos.status, 200);
    const pratos = await resPratos.json();
    assert.equal(pratos.length, 1);
    assert.equal(pratos[0].nome, 'Filé ao molho');
    assert.equal(pratos[0].categoria, 'PRATO');
  }, {
    categoriasCardapio: async (token) => {
      assert.equal(token, sessaoToken);
      return ['PRATO', 'SOBREMESA', 'BEBIDA'];
    },
    produtosCardapio: async (token, cat) => {
      assert.equal(token, sessaoToken);
      const todos = [
        { idProduto: 1, nome: 'Filé ao molho', descricao: 'Carne macia com purê', preco: 48, categoria: 'PRATO' as const, setor: 'COZINHA' as const, disponivel: true },
        { idProduto: 2, nome: 'Suco de laranja', descricao: 'Suco natural', preco: 12, categoria: 'BEBIDA' as const, setor: 'BAR' as const, disponivel: true }
      ];
      return cat ? todos.filter(p => p.categoria === cat) : todos;
    }
  });
});

test('US-08: detalhes do item exibem nome, descrição, preço e status de disponibilidade', async () => {
  const sessaoToken = 'sessao-mesa-valida-00000000000000';
  await http(async url => {
    // Exige autenticação de sessão
    assert.equal((await fetch(url + '/cardapio/produtos/1')).status, 401);

    // Rejeita ID inválido
    assert.equal((await fetch(url + '/cardapio/produtos/abc', { headers: { Authorization: `Bearer ${sessaoToken}` } })).status, 400);
    assert.equal((await fetch(url + '/cardapio/produtos/-1', { headers: { Authorization: `Bearer ${sessaoToken}` } })).status, 400);

    // Consulta item disponível existente
    const res = await fetch(url + '/cardapio/produtos/1', {
      headers: { Authorization: `Bearer ${sessaoToken}` }
    });
    assert.equal(res.status, 200);
    const detalhe = await res.json();
    assert.equal(detalhe.idProduto, 1);
    assert.equal(detalhe.nome, 'Filé ao molho');
    assert.equal(detalhe.preco, 48);
    assert.equal(detalhe.disponivel, true);
    assert.equal(detalhe.setor, 'COZINHA');

    // Item não encontrado
    const naoEncontrado = await fetch(url + '/cardapio/produtos/999', {
      headers: { Authorization: `Bearer ${sessaoToken}` }
    });
    assert.equal(naoEncontrado.status, 404);
  }, {
    detalheProduto: async (token, idProduto) => {
      assert.equal(token, sessaoToken);
      if (idProduto === 1) {
        return {
          idProduto: 1,
          nome: 'Filé ao molho',
          descricao: 'Filé grelhado ao ponto, servido com molho da casa, purê de batatas e legumes tostados.',
          preco: 48,
          categoria: 'PRATO',
          setor: 'COZINHA',
          disponivel: true
        };
      }
      throw new ErroApi(404, 'PRODUTO_INEXISTENTE', 'Produto não encontrado.');
    }
  });
});

test('US-16: acompanhamento de pedidos da comanda exige sessão vinculada, inclui itens entregues e transmite atualizações via SSE', async () => {
  const sessaoComanda1 = 'sessao-mesa-comanda1-0000000000000';
  const sessaoComanda2 = 'sessao-mesa-comanda2-0000000000000';
  let statusItem1: 'RECEBIDO' | 'EM_PREPARO' | 'PRONTO' | 'ENTREGUE' = 'RECEBIDO';
  const montarPedidos = (idComanda: number) => [{
    idPedido: 5801, idComanda, idMesa: 8, numeroMesa: 8,
    status: statusItem1 === 'ENTREGUE' ? ('ENTREGUE' as const) : statusItem1,
    dataHora: '2026-10-26T12:00:00.000Z', total: 60,
    itens: [
      { idItem: 1, idProduto: 10, nomeProduto: 'Filé ao molho', quantidade: 1, precoUnitario: 48, subtotal: 48, observacao: null, setor: 'COZINHA' as const, status: statusItem1 },
      { idItem: 2, idProduto: 20, nomeProduto: 'Suco de laranja', quantidade: 1, precoUnitario: 12, subtotal: 12, observacao: null, setor: 'BAR' as const, status: 'ENTREGUE' as const }
    ]
  }];
  const server = createApp(async () => {}, {
    access,
    filaIntervalMs: 30,
    operacao: {
      listar: async () => [],
      avancar: async (_setor, idItem, input) => {
        statusItem1 = input.status;
        return { idItem, status: input.status, statusPedido: input.status };
      }
    },
    service: {
      mesaDispositivo: async (_token: string, idMesa: number) => ({ idMesa, numero: idMesa }),
      listarPedidosComanda: async (idComanda, token) => {
        if (token !== sessaoComanda1 && token !== sessaoComanda2) throw new ErroApi(401, 'SESSAO_INVALIDA', 'Sessão inválida.');
        if ((token === sessaoComanda1 && idComanda !== 1) || (token === sessaoComanda2 && idComanda !== 2)) {
          throw new ErroApi(403, 'COMANDA_INCORRETA', 'A sessão não pertence à comanda informada.');
        }
        return montarPedidos(idComanda);
      },
      listarPedidosComandaInterno: async idComanda => montarPedidos(idComanda)
    } as SprintService
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  try {
    // Sem token -> 401
    assert.equal((await fetch(url + '/atendimentos/1/pedidos')).status, 401);
    assert.equal((await fetch(url + '/atendimentos/1/eventos')).status, 401);

    // Outra comanda -> 403
    const forbidden = await fetch(url + '/atendimentos/2/pedidos', { headers: { Authorization: `Bearer ${sessaoComanda1}` } });
    assert.equal(forbidden.status, 403);
    assert.equal((await forbidden.json()).error.code, 'COMANDA_INCORRETA');
    assert.equal((await fetch(url + '/atendimentos/2/eventos', { headers: { Authorization: `Bearer ${sessaoComanda1}` } })).status, 403);

    // Snapshot GET da própria comanda inclui itens entregues
    const snapshotRes = await fetch(url + '/atendimentos/1/pedidos', { headers: { Authorization: `Bearer ${sessaoComanda1}` } });
    assert.equal(snapshotRes.status, 200);
    const snapshot = await snapshotRes.json();
    assert.equal(snapshot.length, 1);
    assert.equal(snapshot[0].itens.length, 2);
    assert.equal(snapshot[0].itens[0].status, 'RECEBIDO');
    assert.equal(snapshot[0].itens[1].status, 'ENTREGUE');

    // SSE autenticado escopado à comanda recebe mudanças de preparo
    const controller = new AbortController();
    const sseRes = await fetch(url + '/atendimentos/1/eventos', {
      headers: { Authorization: `Bearer ${sessaoComanda1}` },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)])
    });
    assert.equal(sseRes.status, 200);
    assert.match(sseRes.headers.get('content-type') ?? '', /text\/event-stream/);
    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    async function nextPedidosEvent() {
      for (;;) {
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (frame.includes('event: pedidos')) {
            return JSON.parse(frame.split('\n').find(l => l.startsWith('data: '))!.slice(6)).pedidos;
          }
        }
        const value = await reader.read();
        assert.equal(value.done, false);
        buffer += decoder.decode(value.value, { stream: true });
      }
    }
    try {
      const inicial = await nextPedidosEvent();
      assert.equal(inicial[0].itens[0].status, 'RECEBIDO');
      const patch = await fetch(url + '/cozinha/itens/1/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusAtual: 'RECEBIDO', status: 'EM_PREPARO' })
      });
      assert.equal(patch.status, 200);
      const atualizado = await nextPedidosEvent();
      assert.equal(atualizado[0].itens[0].status, 'EM_PREPARO');
      assert.equal(atualizado[0].itens[1].status, 'ENTREGUE');
    } finally {
      controller.abort();
      await reader.cancel().catch(() => {});
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  }
});

