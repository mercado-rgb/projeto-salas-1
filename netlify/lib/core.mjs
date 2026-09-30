// Lógica do servidor de reservas de salas.
// - Um documento por dia ("dias/AAAA-MM-DD") com as reservas daquele dia.
// - Reservas semanais geram uma reserva em cada dia da série e um documento "series/<id>".
// - Toda gravação é condicional (ETag): se duas pessoas reservarem a mesma sala ao mesmo
//   tempo, só a primeira grava; a segunda relê, vê o conflito e recebe 409.
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  SALA_POR_ID, HORA_INICIO, HORA_FIM, PASSO, MAX_MIN_SEM_DIRETORIA,
  DIAS_ANTECEDENCIA, DIAS_ANTECEDENCIA_DIRETORIA, MAX_SEMANAS, FUSO,
} from '../../public/config.js';

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const RE_ID = /^[0-9a-f-]{36}$/;

export function agoraNoFuso(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(date).map(x => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
export function somarDias(dia, n) { const d = new Date(dia + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const paraMin = h => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
const hash = t => createHash('sha256').update(String(t)).digest('hex');
const chaveDia = dia => `dias/${dia}`;
const chaveSerie = id => `series/${id}`;
const esperar = ms => new Promise(r => setTimeout(r, ms));
function json(status, corpo) {
  return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
const publico = r => { const { tokenHash, ...resto } = r; return resto; };
function iguais(a, b) { const x = Buffer.from(hash(a)), y = Buffer.from(hash(b)); return timingSafeEqual(x, y); }
function hashConfere(token, tokenHash) {
  if (!token || !tokenHash) return false;
  const a = Buffer.from(hash(token)), b = Buffer.from(tokenHash);
  return a.length === b.length && timingSafeEqual(a, b);
}
function ehDiretoria(req) {
  const senha = process.env.CODIGO_DIRETORIA;
  const enviada = req.headers.get('x-diretoria');
  return !!(senha && enviada && iguais(enviada, senha));
}

// Mesma sala, mesmo dia e horários que se cruzam
export function cruza(a, b) {
  return a.sala === b.sala && a.data === b.data && paraMin(a.inicio) < paraMin(b.fim) && paraMin(b.inicio) < paraMin(a.fim);
}

function validar(c, agora, dir) {
  const erros = [];
  const nome = typeof c.nome === 'string' ? c.nome.trim().replace(/\s+/g, ' ') : '';
  if (nome.length < 2 || nome.length > 60) erros.push('Informe seu nome (2 a 60 caracteres).');
  const sala = SALA_POR_ID[c.sala];
  if (!sala) erros.push('Sala inválida.');
  else if (sala.apenasDiretoria && !dir) erros.push(`${sala.nome}: só a diretoria pode reservar esta sala.`);
  const motivo = typeof c.motivo === 'string' ? c.motivo.trim().slice(0, 200) : '';
  if (!motivo) erros.push('Informe o motivo da reserva.');
  if (!RE_DIA.test(c.data || '')) erros.push('Data inválida.');
  if (!RE_HORA.test(c.inicio || '') || !RE_HORA.test(c.fim || '')) erros.push('Horário inválido.');
  let datas = [];
  if (!erros.length) {
    const i = paraMin(c.inicio), f = paraMin(c.fim);
    if (i < HORA_INICIO || f > HORA_FIM || i % PASSO || f % PASSO) erros.push(`Use horários entre ${HORA_INICIO / 60}h e ${HORA_FIM / 60}h, de ${PASSO} em ${PASSO} minutos.`);
    if (f <= i) erros.push('O término precisa ser depois do início.');
    if (!dir && f - i > MAX_MIN_SEM_DIRETORIA) erros.push(`Cada reserva pode ter no máximo ${MAX_MIN_SEM_DIRETORIA / 60} horas. Reservas maiores só com a senha da diretoria.`);
    if (c.data < agora.dia) erros.push('Essa data já passou.');
    if (c.data === agora.dia && f <= agora.min) erros.push('Esse horário já passou.');
    const limite = dir ? DIAS_ANTECEDENCIA_DIRETORIA : DIAS_ANTECEDENCIA;
    if (c.data > somarDias(agora.dia, limite)) erros.push(`Só dá para reservar até ${limite} dias à frente.`);
    datas = [c.data];
    if (c.semanal) {
      if (!dir) erros.push('Reservas semanais só podem ser feitas pela diretoria.');
      else if (!RE_DIA.test(c.repetirAte || '') || c.repetirAte < c.data) erros.push('Informe até quando a reunião se repete.');
      else {
        const fimSerie = c.repetirAte > somarDias(agora.dia, DIAS_ANTECEDENCIA_DIRETORIA) ? somarDias(agora.dia, DIAS_ANTECEDENCIA_DIRETORIA) : c.repetirAte;
        for (let d = somarDias(c.data, 7); d <= fimSerie && datas.length < MAX_SEMANAS; d = somarDias(d, 7)) datas.push(d);
      }
    }
  }
  return { erros, datas, dados: { nome, sala: c.sala, inicio: c.inicio, fim: c.fim, motivo } };
}

// Grava uma reserva num dia, com trava otimista. Retorna {ok} ou {conflitos}.
async function gravarNoDia(store, dia, nova) {
  for (let t = 0; t < 8; t++) {
    const atual = await store.getWithMetadata(chaveDia(dia), { type: 'json' });
    const reservas = atual?.data?.reservas || [];
    const choque = reservas.filter(r => cruza(r, nova));
    if (choque.length) return { conflitos: choque.map(publico) };
    const proximo = { reservas: [...reservas, nova] };
    const res = atual ? await store.setJSON(chaveDia(dia), proximo, { onlyIfMatch: atual.etag }) : await store.setJSON(chaveDia(dia), proximo, { onlyIfNew: true });
    if (res.modified) return { ok: true };
    await esperar(40 + Math.random() * 120);
  }
  return { ocupado: true };
}
async function removerDoDia(store, dia, filtro) {
  for (let t = 0; t < 8; t++) {
    const atual = await store.getWithMetadata(chaveDia(dia), { type: 'json' });
    if (!atual) return 0;
    const reservas = atual.data?.reservas || [];
    const ficam = reservas.filter(r => !filtro(r));
    if (ficam.length === reservas.length) return 0;
    const res = await store.setJSON(chaveDia(dia), { reservas: ficam }, { onlyIfMatch: atual.etag });
    if (res.modified) return reservas.length - ficam.length;
    await esperar(40 + Math.random() * 120);
  }
  throw new Error('ocupado');
}

export function criarHandler(obterStore) {
  return async function handler(req) {
    const url = new URL(req.url);
    try {
      const codigo = process.env.CODIGO_ACESSO;
      if (codigo && req.headers.get('x-codigo') !== codigo) return json(401, { erro: 'codigo', mensagem: 'Código de acesso da empresa inválido.' });
      const dir = ehDiretoria(req);
      const store = obterStore();
      const agora = agoraNoFuso();

      if (req.method === 'GET') {
        if (url.searchParams.has('verificar')) {
          if (!dir) await esperar(600); // atrasa tentativas erradas de senha
          return json(200, { diretoria: dir, diretoriaConfigurada: !!process.env.CODIGO_DIRETORIA });
        }
        const de = url.searchParams.get('de') || agora.dia;
        const dias = Math.min(31, Math.max(1, Number(url.searchParams.get('dias')) || 1));
        if (!RE_DIA.test(de)) return json(400, { erro: 'data', mensagem: 'Data inválida.' });
        const lista = await Promise.all(Array.from({ length: dias }, (_, i) =>
          store.get(chaveDia(somarDias(de, i)), { type: 'json' }).then(d => d?.reservas || [])));
        return json(200, { agora, diretoriaConfigurada: !!process.env.CODIGO_DIRETORIA, reservas: lista.flat().map(publico) });
      }

      if (req.method === 'POST') {
        let corpo; try { corpo = await req.json(); } catch { return json(400, { erro: 'corpo', mensagem: 'Pedido inválido.' }); }
        corpo = corpo || {};
        const { erros, datas, dados } = validar(corpo, agora, dir);
        if (erros.length) return json(400, { erro: 'validacao', mensagem: erros.join(' ') });

        // Verifica conflitos em todas as datas (usado também na simulação da série)
        const diasAtuais = await Promise.all(datas.map(d => store.get(chaveDia(d), { type: 'json' }).then(x => x?.reservas || [])));
        const conflitos = [];
        datas.forEach((d, i) => diasAtuais[i].filter(r => cruza(r, { ...dados, data: d })).forEach(r => conflitos.push(publico(r))));
        if (corpo.simular) return json(200, { datas, conflitos });
        const datasComConflito = new Set(conflitos.map(c => c.data));
        if (conflitos.length && !(corpo.semanal && corpo.pularConflitos)) {
          return json(409, { erro: 'conflito', mensagem: 'Essa sala já está reservada nesse horário.', conflitos });
        }
        const alvo = datas.filter(d => !datasComConflito.has(d));
        if (!alvo.length) return json(409, { erro: 'conflito', mensagem: 'Todas as datas da série já estão ocupadas.', conflitos });

        const token = randomBytes(24).toString('base64url');
        const serieId = datas.length > 1 ? randomUUID() : null;
        const base = { ...dados, criadoEm: new Date().toISOString(), tokenHash: hash(token), diretoria: dir, ...(serieId ? { serieId } : {}) };
        const criadas = [], puladas = [...datasComConflito];
        for (const d of alvo) {
          const nova = { ...base, id: randomUUID(), data: d };
          const r = await gravarNoDia(store, d, nova);
          if (r.ok) { criadas.push(nova); continue; }
          if (r.conflitos && serieId && corpo.pularConflitos) { puladas.push(d); continue; }
          // desfaz o que já foi gravado desta série
          for (const c of criadas) await removerDoDia(store, c.data, x => x.id === c.id).catch(() => {});
          if (r.conflitos) return json(409, { erro: 'conflito', mensagem: 'Alguém reservou essa sala antes de você.', conflitos: r.conflitos });
          return json(503, { erro: 'ocupado', mensagem: 'Muita gente reservando ao mesmo tempo. Tente de novo em alguns segundos.' });
        }
        if (serieId) await store.setJSON(chaveSerie(serieId), { id: serieId, datas: criadas.map(c => c.data), sala: dados.sala, inicio: dados.inicio, fim: dados.fim, nome: dados.nome, motivo: dados.motivo, tokenHash: base.tokenHash, criadoEm: base.criadoEm });
        return json(201, { reservas: criadas.map(publico), serieId, puladas: puladas.sort(), token });
      }

      if (req.method === 'DELETE') {
        const token = req.headers.get('x-token') || '';
        const serie = url.searchParams.get('serie');
        if (serie) {
          if (!RE_ID.test(serie)) return json(400, { erro: 'parametros', mensagem: 'Série inválida.' });
          const doc = await store.get(chaveSerie(serie), { type: 'json' });
          if (!doc) return json(404, { erro: 'nao_encontrada', mensagem: 'Essa série não existe mais.' });
          if (!dir && !hashConfere(token, doc.tokenHash)) return json(403, { erro: 'sem_permissao', mensagem: 'Só quem criou a série ou a diretoria pode cancelar.' });
          const aPartir = RE_DIA.test(url.searchParams.get('aPartirDe') || '') ? url.searchParams.get('aPartirDe') : agora.dia;
          let removidas = 0;
          for (const d of doc.datas.filter(d => d >= aPartir)) removidas += await removerDoDia(store, d, r => r.serieId === serie);
          await store.setJSON(chaveSerie(serie), { ...doc, datas: doc.datas.filter(d => d < aPartir) });
          return json(200, { ok: true, removidas });
        }
        const id = url.searchParams.get('id'), data = url.searchParams.get('data');
        if (!id || !RE_DIA.test(data || '')) return json(400, { erro: 'parametros', mensagem: 'Reserva não informada.' });
        const atual = await store.get(chaveDia(data), { type: 'json' });
        const alvo = (atual?.reservas || []).find(r => r.id === id);
        if (!alvo) return json(404, { erro: 'nao_encontrada', mensagem: 'Essa reserva não existe mais.' });
        if (!dir && !hashConfere(token, alvo.tokenHash)) return json(403, { erro: 'sem_permissao', mensagem: 'Só dá para cancelar no aparelho em que a reserva foi feita, ou com a senha da diretoria.' });
        await removerDoDia(store, data, r => r.id === id);
        return json(200, { ok: true });
      }

      return json(405, { erro: 'metodo', mensagem: 'Método não suportado.' });
    } catch (e) {
      console.error(e);
      return json(e?.message === 'ocupado' ? 503 : 500, { erro: 'interno', mensagem: 'Erro no servidor. Tente de novo.' });
    }
  };
}
