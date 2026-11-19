/**
 * Desafio: Batalha naval em tabuleiro 10 x 10, para 2 jogadores.
 *
 * Toda a regra de negócio do jogo está neste arquivo, junto com os casos de
 * teste. Os testes simulam a partida: posicionamento da frota, troca de vez,
 * tiros na água, acertos, navios afundados e a vitória.
 *
 * Frota de cada jogador:
 *   1 Porta-aviões (5 casas), 1 Encouraçado (4), 1 Submarino (3) e
 *   1 Destroier ou Hidroavião (2).
 *
 * Coordenadas no formato "A1" a "J10": letra = linha (A a J), número = coluna (1 a 10).
 */

// ---------------------------------------------------------------------------
// Regras do jogo
// ---------------------------------------------------------------------------

const TAMANHO = 10;
const LETRAS = 'ABCDEFGHIJ';

const FROTA = [
  { tipo: 'porta-avioes', nome: 'Porta-aviões', tamanho: 5 },
  { tipo: 'encouracado', nome: 'Encouraçado', tamanho: 4 },
  { tipo: 'submarino', nome: 'Submarino', tamanho: 3 },
  { tipo: 'destroier', nome: 'Destroier', tamanho: 2, apelidos: ['hidroaviao'] }, // "Destroier ou Hidroavião"
];

/** Gerador pseudoaleatório com semente (mulberry32), para partidas reproduzíveis. */
function criarAleatorio(semente) {
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** "C7" -> { linha: 2, coluna: 6 } */
function lerCoordenada(texto) {
  const m = /^([A-Ja-j])(10|[1-9])$/.exec(String(texto).trim());
  if (!m) throw new Error(`Coordenada inválida: ${texto}`);
  return { linha: LETRAS.indexOf(m[1].toUpperCase()), coluna: Number(m[2]) - 1 };
}

/** { linha: 2, coluna: 6 } -> "C7" */
function escreverCoordenada({ linha, coluna }) {
  return `${LETRAS[linha]}${coluna + 1}`;
}

class Tabuleiro {
  constructor() {
    this.navios = [];
    this.tiros = new Map(); // "C7" -> 'agua' | 'acerto'
  }

  get frotaCompleta() {
    return this.navios.length === FROTA.length;
  }

  get todosAfundados() {
    return this.frotaCompleta && this.navios.every((n) => n.afundado);
  }

  /**
   * Posiciona um navio a partir da casa inicial, para a direita ('H') ou para baixo ('V').
   * Regras: dentro do tabuleiro, sem sobrepor e sem encostar em outro navio (nem na diagonal).
   */
  posicionar(tipo, inicio, orientacao) {
    const modelo = FROTA.find((n) => n.tipo === tipo || (n.apelidos || []).includes(tipo));
    if (!modelo) throw new Error(`Navio desconhecido: ${tipo}`);
    if (this.navios.some((n) => n.tipo === modelo.tipo)) throw new Error(`${modelo.nome} já foi posicionado`);
    if (orientacao !== 'H' && orientacao !== 'V') throw new Error('Orientação deve ser H (horizontal) ou V (vertical)');

    const { linha, coluna } = lerCoordenada(inicio);
    const casas = [];
    for (let i = 0; i < modelo.tamanho; i++) {
      const l = orientacao === 'V' ? linha + i : linha;
      const c = orientacao === 'H' ? coluna + i : coluna;
      if (l >= TAMANHO || c >= TAMANHO) throw new Error(`${modelo.nome} sai do tabuleiro`);
      casas.push({ linha: l, coluna: c });
    }

    for (const casa of casas) {
      const outro = this.navioEm(casa);
      if (outro) throw new Error(`${modelo.nome} sobrepõe o ${outro.nome} em ${escreverCoordenada(casa)}`);
    }
    for (const casa of casas) {
      for (const outro of this.navios) {
        const encosta = outro.casas.some(
          (ocupada) => Math.abs(ocupada.linha - casa.linha) <= 1 && Math.abs(ocupada.coluna - casa.coluna) <= 1,
        );
        if (encosta) throw new Error(`${modelo.nome} encosta no ${outro.nome}`);
      }
    }

    const navio = { ...modelo, casas, acertos: new Set() };
    Object.defineProperty(navio, 'afundado', { get: () => navio.acertos.size === navio.tamanho });
    this.navios.push(navio);
    return navio;
  }

  /** Posiciona a frota inteira em lugares sorteados que obedecem às regras. */
  posicionarAleatoriamente(aleatorio = Math.random) {
    for (const { tipo } of FROTA) {
      if (this.navios.some((n) => n.tipo === tipo)) continue;
      for (let tentativa = 0; ; tentativa++) {
        if (tentativa > 10000) throw new Error('Não foi possível posicionar a frota');
        const orientacao = aleatorio() < 0.5 ? 'H' : 'V';
        const casa = { linha: Math.floor(aleatorio() * TAMANHO), coluna: Math.floor(aleatorio() * TAMANHO) };
        try {
          this.posicionar(tipo, escreverCoordenada(casa), orientacao);
          break;
        } catch (erro) {
          // posição inválida: sorteia outra
        }
      }
    }
  }

  navioEm({ linha, coluna }) {
    return this.navios.find((n) => n.casas.some((c) => c.linha === linha && c.coluna === coluna)) || null;
  }

  receberTiro(coordenada) {
    const casa = lerCoordenada(coordenada);
    const chave = escreverCoordenada(casa);
    if (this.tiros.has(chave)) throw new Error(`Já houve tiro em ${chave}`);
    const navio = this.navioEm(casa);
    if (!navio) {
      this.tiros.set(chave, 'agua');
      return { resultado: 'agua' };
    }
    this.tiros.set(chave, 'acerto');
    navio.acertos.add(chave);
    return { resultado: navio.afundado ? 'afundou' : 'acerto', navio: navio.nome };
  }

  /** Visão do adversário: ~ desconhecido, o água, X acerto, # navio afundado. */
  visaoDoAdversario() {
    const linhas = [];
    for (let l = 0; l < TAMANHO; l++) {
      let texto = '';
      for (let c = 0; c < TAMANHO; c++) {
        const chave = escreverCoordenada({ linha: l, coluna: c });
        const tiro = this.tiros.get(chave);
        if (!tiro) texto += '~';
        else if (tiro === 'agua') texto += 'o';
        else texto += this.navioEm({ linha: l, coluna: c }).afundado ? '#' : 'X';
      }
      linhas.push(texto);
    }
    return linhas.join('\n');
  }
}

class BatalhaNaval {
  constructor(nome1 = 'Jogador 1', nome2 = 'Jogador 2') {
    this.jogadores = [
      { nome: nome1, tabuleiro: new Tabuleiro() },
      { nome: nome2, tabuleiro: new Tabuleiro() },
    ];
    this.fase = 'posicionamento'; // 'posicionamento' | 'batalha' | 'fim'
    this.vez = 0;
    this.vencedor = null;
    this.historico = [];
  }

  get jogadorDaVez() {
    return this.jogadores[this.vez];
  }

  posicionar(indiceJogador, tipo, inicio, orientacao) {
    if (this.fase !== 'posicionamento') throw new Error('A fase de posicionamento já terminou');
    this._jogador(indiceJogador).tabuleiro.posicionar(tipo, inicio, orientacao);
    this._talvezComecarBatalha();
  }

  posicionarAleatoriamente(indiceJogador, aleatorio) {
    if (this.fase !== 'posicionamento') throw new Error('A fase de posicionamento já terminou');
    this._jogador(indiceJogador).tabuleiro.posicionarAleatoriamente(aleatorio);
    this._talvezComecarBatalha();
  }

  /** O jogador da vez atira no tabuleiro do adversário. A vez sempre passa depois de um tiro válido. */
  atirar(coordenada) {
    if (this.fase === 'posicionamento') throw new Error('As duas frotas precisam estar posicionadas antes do primeiro tiro');
    if (this.fase === 'fim') throw new Error('A partida já terminou');
    const atirador = this.vez;
    const alvo = this.jogadores[1 - atirador];
    const tiro = alvo.tabuleiro.receberTiro(coordenada);
    this.historico.push({ jogador: this.jogadores[atirador].nome, coordenada: escreverCoordenada(lerCoordenada(coordenada)), ...tiro });
    if (alvo.tabuleiro.todosAfundados) {
      this.fase = 'fim';
      this.vencedor = this.jogadores[atirador].nome;
      return { ...tiro, vitoria: true };
    }
    this.vez = 1 - atirador;
    return tiro;
  }

  _jogador(indice) {
    if (indice !== 0 && indice !== 1) throw new Error('Jogador inválido: use 0 ou 1');
    return this.jogadores[indice];
  }

  _talvezComecarBatalha() {
    if (this.jogadores.every((j) => j.tabuleiro.frotaCompleta)) this.fase = 'batalha';
  }
}

// ---------------------------------------------------------------------------
// Cenário fixo usado nos testes
// ---------------------------------------------------------------------------

/**
 * Frota padrão:
 *   Porta-aviões A1-A5 (H), Encouraçado C1-F1 (V), Submarino J8-J10 (H), Destroier E5-F5 (V)
 */
function posicionarFrotaPadrao(jogo, indice) {
  jogo.posicionar(indice, 'porta-avioes', 'A1', 'H');
  jogo.posicionar(indice, 'encouracado', 'C1', 'V');
  jogo.posicionar(indice, 'submarino', 'J8', 'H');
  jogo.posicionar(indice, 'destroier', 'E5', 'V');
}

const CASAS_DA_FROTA_PADRAO = ['A1', 'A2', 'A3', 'A4', 'A5', 'C1', 'D1', 'E1', 'F1', 'J8', 'J9', 'J10', 'E5', 'F5'];

/** 14 casas de água na frota padrão (linhas G e H), usadas pelo jogador que vai errar. */
const CASAS_DE_AGUA = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10', 'G1', 'G2', 'G3', 'G4'];

function partidaPronta() {
  const jogo = new BatalhaNaval('Ana', 'Bruno');
  posicionarFrotaPadrao(jogo, 0);
  posicionarFrotaPadrao(jogo, 1);
  return jogo;
}

function todasAsCasas() {
  const lista = [];
  for (let l = 0; l < TAMANHO; l++) for (let c = 0; c < TAMANHO; c++) lista.push(escreverCoordenada({ linha: l, coluna: c }));
  return lista;
}

// ---------------------------------------------------------------------------
// Casos de teste
// ---------------------------------------------------------------------------

describe('Coordenadas', () => {
  test('convertem de A1 a J10 para linha e coluna', () => {
    expect(lerCoordenada('A1')).toEqual({ linha: 0, coluna: 0 });
    expect(lerCoordenada('J10')).toEqual({ linha: 9, coluna: 9 });
    expect(lerCoordenada('c7')).toEqual({ linha: 2, coluna: 6 });
    expect(escreverCoordenada({ linha: 4, coluna: 9 })).toBe('E10');
  });

  test('o tabuleiro tem 10 x 10 = 100 casas', () => {
    expect(todasAsCasas()).toHaveLength(100);
    expect(new Set(todasAsCasas()).size).toBe(100);
  });

  test.each(['K1', 'A0', 'A11', '1A', '', 'AA', 'B 3'])('coordenada fora do tabuleiro ou mal escrita é recusada: "%s"', (texto) => {
    expect(() => lerCoordenada(texto)).toThrow('Coordenada inválida');
  });
});

describe('Frota', () => {
  test('tem 4 navios que ocupam 5, 4, 3 e 2 casas', () => {
    expect(FROTA.map((n) => n.nome)).toEqual(['Porta-aviões', 'Encouraçado', 'Submarino', 'Destroier']);
    expect(FROTA.map((n) => n.tamanho)).toEqual([5, 4, 3, 2]);
    expect(FROTA.reduce((s, n) => s + n.tamanho, 0)).toBe(14);
  });
});

describe('Posicionamento', () => {
  test('navio na horizontal ocupa casas para a direita', () => {
    const t = new Tabuleiro();
    const navio = t.posicionar('porta-avioes', 'B2', 'H');
    expect(navio.casas.map(escreverCoordenada)).toEqual(['B2', 'B3', 'B4', 'B5', 'B6']);
  });

  test('navio na vertical ocupa casas para baixo', () => {
    const t = new Tabuleiro();
    const navio = t.posicionar('encouracado', 'G10', 'V');
    expect(navio.casas.map(escreverCoordenada)).toEqual(['G10', 'H10', 'I10', 'J10']);
  });

  test('navio que sai do tabuleiro é recusado', () => {
    const t = new Tabuleiro();
    expect(() => t.posicionar('porta-avioes', 'A7', 'H')).toThrow('sai do tabuleiro');
    expect(() => t.posicionar('submarino', 'I1', 'V')).toThrow('sai do tabuleiro');
    expect(t.navios).toHaveLength(0);
  });

  test('navio que sobrepõe outro é recusado', () => {
    const t = new Tabuleiro();
    t.posicionar('porta-avioes', 'C1', 'H');
    expect(() => t.posicionar('encouracado', 'A3', 'V')).toThrow('sobrepõe o Porta-aviões em C3');
  });

  test('navio encostado em outro, de lado ou na diagonal, é recusado', () => {
    const t = new Tabuleiro();
    t.posicionar('porta-avioes', 'C1', 'H'); // C1-C5
    expect(() => t.posicionar('destroier', 'D1', 'H')).toThrow('encosta'); // logo abaixo
    expect(() => t.posicionar('destroier', 'C6', 'H')).toThrow('encosta'); // logo ao lado
    expect(() => t.posicionar('destroier', 'D6', 'V')).toThrow('encosta'); // na diagonal
    expect(() => t.posicionar('destroier', 'E1', 'H')).not.toThrow(); // uma linha de distância
  });

  test('cada navio só pode ser posicionado uma vez', () => {
    const t = new Tabuleiro();
    t.posicionar('submarino', 'A1', 'H');
    expect(() => t.posicionar('submarino', 'J1', 'H')).toThrow('Submarino já foi posicionado');
  });

  test('o navio de 2 casas pode ser chamado de Destroier ou de Hidroavião, mas é um só', () => {
    const t = new Tabuleiro();
    const navio = t.posicionar('hidroaviao', 'A1', 'H');
    expect(navio.tipo).toBe('destroier');
    expect(navio.casas).toHaveLength(2);
    expect(() => t.posicionar('destroier', 'J1', 'H')).toThrow('Destroier já foi posicionado');
  });

  test('navio que não faz parte da frota é recusado', () => {
    const t = new Tabuleiro();
    expect(() => t.posicionar('cruzador', 'A1', 'H')).toThrow('Navio desconhecido');
  });

  test('orientação diferente de H ou V é recusada', () => {
    const t = new Tabuleiro();
    expect(() => t.posicionar('submarino', 'A1', 'D')).toThrow('Orientação');
  });

  test.each([1, 7, 13, 99, 2026])('posicionamento sorteado sempre respeita as regras (semente %i)', (semente) => {
    const t = new Tabuleiro();
    t.posicionarAleatoriamente(criarAleatorio(semente));
    expect(t.frotaCompleta).toBe(true);
    const casas = t.navios.flatMap((n) => n.casas);
    expect(casas).toHaveLength(14);
    casas.forEach((c) => {
      expect(c.linha).toBeLessThan(10);
      expect(c.coluna).toBeLessThan(10);
    });
    for (const a of t.navios) {
      for (const b of t.navios) {
        if (a === b) continue;
        for (const ca of a.casas) {
          for (const cb of b.casas) {
            expect(Math.max(Math.abs(ca.linha - cb.linha), Math.abs(ca.coluna - cb.coluna))).toBeGreaterThan(1);
          }
        }
      }
    }
  });
});

describe('Início da partida', () => {
  test('a partida começa na fase de posicionamento, com a vez do jogador 1', () => {
    const jogo = new BatalhaNaval('Ana', 'Bruno');
    expect(jogo.fase).toBe('posicionamento');
    expect(jogo.jogadorDaVez.nome).toBe('Ana');
  });

  test('não se atira antes de as duas frotas estarem completas', () => {
    const jogo = new BatalhaNaval();
    posicionarFrotaPadrao(jogo, 0);
    expect(() => jogo.atirar('A1')).toThrow('As duas frotas precisam estar posicionadas');
    jogo.posicionar(1, 'porta-avioes', 'A1', 'H');
    expect(jogo.fase).toBe('posicionamento');
  });

  test('com as duas frotas completas, a batalha começa', () => {
    expect(partidaPronta().fase).toBe('batalha');
  });

  test('depois que a batalha começa, ninguém reposiciona navio', () => {
    const jogo = partidaPronta();
    expect(() => jogo.posicionar(0, 'submarino', 'H1', 'H')).toThrow('posicionamento já terminou');
  });

  test('jogador inválido é recusado', () => {
    const jogo = new BatalhaNaval();
    expect(() => jogo.posicionar(2, 'submarino', 'A1', 'H')).toThrow('Jogador inválido');
  });
});

describe('Tiros', () => {
  test('tiro na água', () => {
    const jogo = partidaPronta();
    expect(jogo.atirar('H3')).toEqual({ resultado: 'agua' });
  });

  test('tiro que acerta um navio diz qual foi atingido', () => {
    const jogo = partidaPronta();
    expect(jogo.atirar('A3')).toEqual({ resultado: 'acerto', navio: 'Porta-aviões' });
  });

  test('o último acerto num navio o afunda', () => {
    const jogo = partidaPronta();
    jogo.atirar('E5'); // Ana acerta o destroier do Bruno
    jogo.atirar('A10'); // Bruno erra
    expect(jogo.atirar('F5')).toEqual({ resultado: 'afundou', navio: 'Destroier' });
    expect(jogo.jogadores[1].tabuleiro.navios.find((n) => n.tipo === 'destroier').afundado).toBe(true);
  });

  test('a vez passa depois de cada tiro, acertando ou não', () => {
    const jogo = partidaPronta();
    expect(jogo.jogadorDaVez.nome).toBe('Ana');
    jogo.atirar('H3');
    expect(jogo.jogadorDaVez.nome).toBe('Bruno');
    jogo.atirar('A1');
    expect(jogo.jogadorDaVez.nome).toBe('Ana');
  });

  test('cada jogador atira no tabuleiro do adversário', () => {
    const jogo = partidaPronta();
    jogo.atirar('A1'); // Ana -> tabuleiro do Bruno
    expect(jogo.jogadores[1].tabuleiro.tiros.get('A1')).toBe('acerto');
    expect(jogo.jogadores[0].tabuleiro.tiros.size).toBe(0);
  });

  test('tiro repetido na mesma casa é recusado e a vez não passa', () => {
    const jogo = partidaPronta();
    jogo.atirar('H3'); // Ana
    jogo.atirar('H3'); // Bruno, no tabuleiro da Ana: é outra casa, vale
    expect(() => jogo.atirar('h3')).toThrow('Já houve tiro em H3');
    expect(jogo.jogadorDaVez.nome).toBe('Ana');
  });

  test('tiro fora do tabuleiro é recusado e a vez não passa', () => {
    const jogo = partidaPronta();
    expect(() => jogo.atirar('K5')).toThrow('Coordenada inválida');
    expect(jogo.jogadorDaVez.nome).toBe('Ana');
  });

  test('o histórico guarda a coordenada no formato do tabuleiro', () => {
    const jogo = partidaPronta();
    jogo.atirar(' h3 ');
    expect(jogo.historico[0]).toEqual({ jogador: 'Ana', coordenada: 'H3', resultado: 'agua' });
  });

  test('a visão do adversário mostra água, acertos e navios afundados', () => {
    const jogo = partidaPronta();
    jogo.atirar('A1'); // Ana acerta o porta-aviões
    jogo.atirar('J1'); // Bruno
    jogo.atirar('B1'); // Ana: água
    jogo.atirar('J2'); // Bruno
    jogo.atirar('E5'); // Ana
    jogo.atirar('J3'); // Bruno
    jogo.atirar('F5'); // Ana afunda o destroier
    const visao = jogo.jogadores[1].tabuleiro.visaoDoAdversario().split('\n');
    expect(visao[0]).toBe('X~~~~~~~~~');
    expect(visao[1]).toBe('o~~~~~~~~~');
    expect(visao[4]).toBe('~~~~#~~~~~');
    expect(visao[5]).toBe('~~~~#~~~~~');
  });
});

describe('Fim da partida', () => {
  test('quem afunda a frota inteira do adversário vence', () => {
    const jogo = partidaPronta();
    let resultado;
    CASAS_DA_FROTA_PADRAO.forEach((casa, i) => {
      resultado = jogo.atirar(casa); // Ana
      if (jogo.fase !== 'fim') jogo.atirar(CASAS_DE_AGUA[i]); // Bruno
    });
    expect(resultado).toEqual({ resultado: 'afundou', navio: 'Destroier', vitoria: true });
    expect(jogo.fase).toBe('fim');
    expect(jogo.vencedor).toBe('Ana');
    expect(jogo.jogadores[1].tabuleiro.todosAfundados).toBe(true);
    expect(jogo.jogadores[0].tabuleiro.todosAfundados).toBe(false);
  });

  test('o segundo jogador também pode vencer', () => {
    const jogo = partidaPronta();
    CASAS_DA_FROTA_PADRAO.forEach((casa, i) => {
      jogo.atirar(CASAS_DE_AGUA[i]);
      jogo.atirar(casa);
    });
    expect(jogo.vencedor).toBe('Bruno');
  });

  test('depois do fim nenhum tiro é aceito', () => {
    const jogo = partidaPronta();
    CASAS_DA_FROTA_PADRAO.forEach((casa, i) => {
      jogo.atirar(casa);
      if (jogo.fase !== 'fim') jogo.atirar(CASAS_DE_AGUA[i]);
    });
    expect(jogo.fase).toBe('fim');
    expect(() => jogo.atirar('J1')).toThrow('A partida já terminou');
  });
});

describe('Partida simulada', () => {
  test('dois jogadores com frotas sorteadas atiram em casas sorteadas até alguém vencer', () => {
    const aleatorio = criarAleatorio(2026);
    const jogo = new BatalhaNaval('Ana', 'Bruno');
    jogo.posicionarAleatoriamente(0, aleatorio);
    jogo.posicionarAleatoriamente(1, aleatorio);
    expect(jogo.fase).toBe('batalha');

    const restantes = [todasAsCasas(), todasAsCasas()];
    let tiros = 0;
    while (jogo.fase === 'batalha') {
      const lista = restantes[jogo.vez];
      const [casa] = lista.splice(Math.floor(aleatorio() * lista.length), 1);
      jogo.atirar(casa);
      tiros++;
    }

    expect(jogo.fase).toBe('fim');
    expect(['Ana', 'Bruno']).toContain(jogo.vencedor);
    const perdedor = jogo.jogadores.find((j) => j.nome !== jogo.vencedor);
    expect(perdedor.tabuleiro.todosAfundados).toBe(true);
    expect(tiros).toBeLessThanOrEqual(200);
    expect(jogo.historico).toHaveLength(tiros);
    expect(jogo.historico.filter((t) => t.resultado === 'afundou' && t.jogador === jogo.vencedor)).toHaveLength(4);
  });
});
