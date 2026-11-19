# desafio_teste_batalha_naval

Casos de teste em JavaScript (Jest) que simulam uma partida de **Batalha naval** para 2 jogadores. Toda a regra de negócio do jogo está dentro do próprio arquivo de teste, [`batalha_naval.test.js`](batalha_naval.test.js): a partida acontece só pelos testes.

## Especificação do desafio

> Batalha Naval (by Cayque)
> - casos de teste para testar tabuleiro 10 x 10;
>   - 1 Porta-aviões (ocupa 5 casas)
>   - 1 Encouraçado (ocupa 4 casas)
>   - 1 Submarino (ocupa 3 casas)
>   - 1 Destroier ou Hidroavião (ocupa 2 casas)
> - casos de teste em Javascript para testar Javascript.

## Regras implementadas

- Cada jogador tem um tabuleiro 10 x 10, com coordenadas de `A1` a `J10` (letra = linha, número = coluna).
- Frota de cada jogador: Porta-aviões (5 casas), Encouraçado (4), Submarino (3) e Destroier (2), 14 casas no total.
- Posicionamento: a partir da casa inicial, para a direita (`H`) ou para baixo (`V`). O navio não pode sair do tabuleiro, sobrepor outro navio nem encostar em outro, nem na diagonal. Cada navio é posicionado uma vez.
- A batalha só começa quando as duas frotas estão completas. Depois disso, ninguém reposiciona navio.
- O jogador 1 atira primeiro. Cada tiro tem um resultado: `agua`, `acerto` ou `afundou` (quando todas as casas do navio foram atingidas).
- A vez passa depois de cada tiro válido, acertando ou não. Tiro repetido ou fora do tabuleiro é recusado e a vez não passa.
- Vence quem afundar a frota inteira do adversário. Depois do fim, nenhum tiro é aceito.

## Como executar

Requer Node.js 18 ou superior.

```bash
npm install
npm test
```

## Funcionamento dos casos de teste

O arquivo tem três partes:

1. **Regras do jogo**: conversão de coordenadas, a classe `Tabuleiro` (posicionamento, tiros e visão do adversário), a classe `BatalhaNaval` (fases, vez e vitória) e um gerador aleatório com semente (`criarAleatorio`).
2. **Cenário fixo**: uma frota padrão em posições conhecidas, usada pelos dois jogadores.
3. **Casos de teste**, agrupados assim:

| Grupo | O que verifica |
|---|---|
| Coordenadas | Conversão de `A1` a `J10`, 100 casas no tabuleiro, coordenadas inválidas recusadas |
| Frota | 4 navios de 5, 4, 3 e 2 casas, 14 no total |
| Posicionamento | Horizontal e vertical, navio fora do tabuleiro, sobreposto, encostado (de lado e na diagonal), repetido, desconhecido, orientação inválida, posicionamento sorteado sempre válido |
| Início da partida | Começa no posicionamento, só se atira com as duas frotas completas, não se reposiciona na batalha, jogador inválido |
| Tiros | Água, acerto, navio afundado, alternância da vez, tiro no tabuleiro certo, tiro repetido e fora do tabuleiro sem perder a vez, visão do adversário |
| Fim da partida | Quem afunda a frota inteira vence (jogador 1 ou 2), nada é aceito depois |
| Partida simulada | Duas frotas sorteadas e tiros sorteados até alguém vencer, com o histórico conferido |

Cada teste monta a própria partida, faz as jogadas e confere o resultado de cada tiro, a vez, a fase (`posicionamento`, `batalha` ou `fim`) e as mensagens de erro das jogadas proibidas.

## Colaborador

- Filipe ([filipesgoncalves](https://github.com/filipesgoncalves))
