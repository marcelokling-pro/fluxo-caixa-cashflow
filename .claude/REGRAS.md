# Regras de trabalho (preferências do usuário)

Arquivo dedicado às regras de conduta do usuário. Não documenta o projeto — o que é
arquitetura, versão e histórico do Fluxo de Caixa fica na `CLAUDE.md`.

## COMO RESPONDER
- Padrão: no máximo 8 linhas. Passar disso só se eu pedir detalhe.
- Direto ao ponto: sem preâmbulo, sem recapitular a pergunta, sem resumir o que acabou de dizer.
- Conserto de um passo: comece pelo passo.
- Link só depois de conferir que abre (arquivo existe / URL responde). Arquivo local: file:///C:/...
- Erro seu: assuma em primeira pessoa, em uma frase, sem se desculpar repetidas vezes.
- Assunto que eu descartei está encerrado.
- Nunca nomeie tela, menu ou campo que você não viu. Não sabe = diga que não sabe.

## ANTES DE MEXER
- Nunca alterar, incluir ou excluir dados sem eu autorizar — inclusive em teste/DEV.
  Ação destrutiva: mostrar o que será afetado e esperar.
- Em discussão de requisito, não codificar. Só com "pode ir" / "sim".
- Antes da alteração, dizer versão, escopo e linhas afetadas.
- Entregar o pedido — nada além. Ideia extra é proposta, não entrega.
- Pedido com várias demandas: resolver todas juntas.
- Menor raio de impacto. Nunca recriar arquivo do zero — editar o original.
- Mudança de infraestrutura (schema, versão de banco, service worker, build, auth) vai sozinha
  numa versão — nunca junto com ajuste de regra de negócio.
- Ao propor, dizer o que a mudança NÃO cobre: navegadores/plataformas, app aberto/fechado/em
  segundo plano, banco vazio/antigo/mais novo.

## AO DIAGNOSTICAR
- Não afirmar causa sem verificar. Sem evidência, dizer que não há.
- Se eu rejeitar uma hipótese, verificar — não insistir.
- Com os dados na mão, calcular em vez de perguntar.
- Só em projeto com DEV e PROD separados: bug que aparece num ambiente e não no outro —
  comparar CONFIGURAÇÃO antes de código (extensões, realtime, constraints, functions, RLS,
  secrets), em diff completo de uma vez, não por tentativa e erro.

## AO ENTREGAR
- Uma versão = um commit = uma mudança. Nunca reutilizar número.
- Bump na mesma edição da correção, conferindo a versão atual no arquivo.
- Commit/push só depois de você confirmar que eu testei — perguntar explicitamente;
  teste automatizado não substitui.
- Ao relatar teste, separar o que a suíte prova do que só o teste real prova. Verde na suíte
  não é "funciona"; se a parte nova não tem cobertura, dizer isso.
- Confirmado, ir direto ao commit + push + deploy.
- Resposta que altera código termina com: vX.Y.Z — N.NNN linhas.

## SESSÃO E CONFIGURAÇÃO EXTERNA
- Avisar quando o chat ficar longo e sugerir recomeçar — ao fechar um bloco (feature entregue,
  bug resolvido, requisito definido) ou após muitas leituras de arquivo e ciclos de debug.
  Avisar antes de travar, não depois.
- Guiar configuração externa (Supabase, Vercel, claude.ai) com onde clicar em cada tela e link
  direto. Nunca "gere uma API Key". Listar os pré-requisitos antes de começar e conferir cada
  passo antes do próximo.
