# Referências visuais — Sprint 4

Arquivo fornecido pelo responsável e consultado pelo conector Figma em 23/11/2026: [Sistema do restaurante](https://www.figma.com/design/d4bhW06MzSoifev04TyKF2/Sem-t%C3%ADtulo?node-id=0-1). A página consultada é `0:1`.

| Tela | Nó e link | Captura versionada |
|---|---|---|
| Caixa | [4:1654](https://www.figma.com/design/d4bhW06MzSoifev04TyKF2/Sem-t%C3%ADtulo?node-id=4-1654) | `apps/caixa/screenshots/figma-caixa.png` |
| Administração | [4:1702](https://www.figma.com/design/d4bhW06MzSoifev04TyKF2/Sem-t%C3%ADtulo?node-id=4-1702) | `apps/administracao/screenshots/figma-administracao.png` |
| Mesa: solicitação e aviso de carrinho | [14:5524](https://www.figma.com/design/d4bhW06MzSoifev04TyKF2/Sem-t%C3%ADtulo?node-id=14-5524) | `apps/mesa/screenshots/figma-solicitacao-conta.png` |
| Mesa: confirmação de fechamento | [14:5556](https://www.figma.com/design/d4bhW06MzSoifev04TyKF2/Sem-t%C3%ADtulo?node-id=14-5556) | `apps/mesa/screenshots/figma-confirmacao-fechamento.png` |
| Mesa: conta solicitada | [14:5588](https://www.figma.com/design/d4bhW06MzSoifev04TyKF2/Sem-t%C3%ADtulo?node-id=14-5588) | `apps/mesa/screenshots/figma-conta-solicitada.png` |

Contexto de design consultado para caixa, administração e aviso da mesa; os demais estados foram localizados na página e exportados como referência. As capturas são documentação, não devem ser usadas como imagem de fundo para simular uma interface.

## Adaptações autorizadas

O Figma do caixa reúne exemplos de consulta, confirmação, duplicidade e histórico na mesma composição. A prévia implementada em `apps/caixa` adapta essa base em cartões e navegação entre conferência e pré-conta, com o visual existente do monorepo e botões comuns. Não representa contas reais.

O Figma da administração apresenta uma visão geral e descreve os campos de produto, mas não desenha o formulário completo. O responsável autorizou preparar o formulário e as áreas de taxas/pré-conta seguindo os componentes existentes. `ProdutosPreview.tsx` usa o shell da administração e não substitui as categorias funcionais. Não copiar indicadores, relatórios ou US-27/28/29/30 só porque aparecem no protótipo.

Pré-conta, taxas configuráveis pelo caixa, escolha de pagamento pelo cliente e chamada do garçom são complementos definidos na conversa de preparação; seus critérios estão em `sprint-04.md` e prevalecem sobre exemplos genéricos do Figma. A implementação futura deve fornecer estados de carregamento, vazio, erro e conflito reais; os valores e nomes ilustrativos do protótipo não são seeds.

A mesa já possui uma interface funcional. Nesta preparação não se altera sua navegação de pedidos: os três estados acima ficam versionados para a implementação da US-22, evitando ativar fechamento sem API. O mesmo vale para novos avisos no garçom.
