import { SALAS, SALA_POR_ID, HORA_INICIO, HORA_FIM, PASSO, MAX_MIN_SEM_DIRETORIA, DIAS_ANTECEDENCIA, DIAS_ANTECEDENCIA_DIRETORIA, MAX_SEMANAS, FUSO } from './config.js';
import { LOGO_INNER, LOGO_VIEWBOX } from './logo.js';

/* ================= utilidades ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const toMin = h => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
const toHM = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
const fmtH = m => { const h = Math.floor(m / 60), mm = m % 60; return h + 'h' + (mm ? pad(mm) : ''); };
const fmtDur = m => m % 60 ? `${Math.floor(m / 60)}h${pad(m % 60)}` : `${m / 60}h`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const WD_L = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function agora() {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date()).map(x => [x.type, x.value]));
  return { dia: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
function somarDias(dia, n) { const d = new Date(dia + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
const diaSemana = dia => new Date(dia + 'T12:00:00Z').getUTCDay();
function fmtDia(dia, longo) { const d = new Date(dia + 'T12:00:00Z'); return (longo ? WD_L[d.getUTCDay()] + ', ' : '') + d.getUTCDate() + ' de ' + MES[d.getUTCMonth()]; }
const fmtCurto = dia => `${dia.slice(8)}/${dia.slice(5, 7)}`;
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { return null; } }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 4200); }
const logoSVG = (cls = 'fea-logo') => `<svg class="${cls}" viewBox="${LOGO_VIEWBOX}" role="img" aria-label="FEA Júnior USP">${LOGO_INNER}</svg>`;
const ICON_LOCK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const ICON_REPEAT = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>';

/* ================= estado ================= */
const h0 = agora();
const S = {
  nome: ls('fj-nome') || '', codigo: ls('fj-codigo') || '', dir: ls('fj-diretoria') || '', dirOk: false, dirConfigurada: true,
  tokens: JSON.parse(ls('fj-tokens') || '{}'),
  dia: h0.dia, hora: 9 * 60, view: 'mapa', room: null, porDia: {}, sincronizado: null, erroRede: false, todas: false,
};
S.hora = (h0.min >= HORA_INICIO && h0.min < HORA_FIM) ? Math.floor(h0.min / PASSO) * PASSO : 9 * 60;
if (h0.min >= HORA_FIM - PASSO) { S.dia = somarDias(h0.dia, 1); S.hora = 9 * 60; }
const salvarTokens = () => ls('fj-tokens', JSON.stringify(S.tokens));
const reservasDoDia = (dia = S.dia) => (S.porDia[dia]?.reservas || []).filter(r => SALA_POR_ID[r.sala]);
const tokenDe = r => S.tokens[r.id] || (r.serieId && S.tokens['s:' + r.serieId]) || '';
const podeCancelar = r => !!tokenDe(r) || S.dirOk;
const ehMinha = r => !!tokenDe(r) || (S.nome && r.nome.toLowerCase() === S.nome.toLowerCase());
const quemOcupa = (sala, t, dia = S.dia) => reservasDoDia(dia).find(r => r.sala === sala && toMin(r.inicio) <= t && t < toMin(r.fim)) || null;
const reservasDaSala = (sala, dia = S.dia) => reservasDoDia(dia).filter(r => r.sala === sala).sort((a, b) => toMin(a.inicio) - toMin(b.inicio));
function livreAPartirDe(sala, t, dia = S.dia) { let m = t, g = 0; while (g++ < 60) { const r = quemOcupa(sala, m, dia); if (!r) return m < HORA_FIM ? m : null; m = toMin(r.fim); } return null; }
function proximaOcupacao(sala, t, dia = S.dia) { const p = reservasDaSala(sala, dia).find(r => toMin(r.inicio) > t); return p ? toMin(p.inicio) : null; }
const podeReservarSala = id => !SALA_POR_ID[id].apenasDiretoria || S.dirOk;
const maxDur = () => S.dirOk ? HORA_FIM - HORA_INICIO : MAX_MIN_SEM_DIRETORIA;

/* ================= API ================= */
async function api(method, params = {}, body, token) {
  const url = '/api/reservas' + (Object.keys(params).length ? '?' + new URLSearchParams(params) : '');
  const headers = { 'x-codigo': S.codigo };
  if (body) headers['content-type'] = 'application/json';
  if (token) headers['x-token'] = token;
  if (S.dir) headers['x-diretoria'] = S.dir;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  let dados = {}; try { dados = await res.json(); } catch {}
  if (res.status === 401 && dados.erro === 'codigo') pedirNome(true);
  return { ok: res.ok, status: res.status, dados };
}
async function carregar(dia = S.dia, silencioso = false) {
  try {
    const { ok, dados } = await api('GET', { de: dia, dias: 1 });
    if (!ok) throw new Error(dados.mensagem || 'erro');
    S.porDia[dia] = { reservas: dados.reservas }; S.dirConfigurada = dados.diretoriaConfigurada !== false;
    S.sincronizado = new Date(); S.erroRede = false;
  } catch { S.erroRede = true; if (!silencioso) toast('Não foi possível atualizar as reservas.'); }
  renderSync(); renderTudo();
}
function renderSync() {
  const s = $('#sync'); s.classList.toggle('err', S.erroRede);
  $('span', s).textContent = S.erroRede ? 'Sem conexão com o servidor' : S.sincronizado ? `Atualizado às ${pad(S.sincronizado.getHours())}:${pad(S.sincronizado.getMinutes())}` : 'Carregando…';
}
async function verificarDiretoria(silencioso) {
  if (!S.dir) { S.dirOk = false; renderDir(); return false; }
  const { ok, dados } = await api('GET', { verificar: 1 }).catch(() => ({ ok: false, dados: {} }));
  S.dirOk = !!(ok && dados.diretoria); S.dirConfigurada = dados.diretoriaConfigurada !== false;
  if (!S.dirOk && !silencioso) toast('Senha da diretoria incorreta.');
  if (!S.dirOk) { S.dir = ''; ls('fj-diretoria', null); }
  renderDir(); renderTudo(); return S.dirOk;
}

/* ================= barra de data e hora ================= */
function renderWhen() {
  const h = agora().dia, box = $('#dates'); box.innerHTML = ''; let naLista = false;
  for (let i = 0; i < 7; i++) {
    const d = somarDias(h, i), b = document.createElement('button'), on = d === S.dia; if (on) naLista = true;
    b.className = 'dchip'; b.setAttribute('aria-pressed', on);
    b.innerHTML = `<small>${i === 0 ? 'hoje' : i === 1 ? 'amanhã' : WD[diaSemana(d)]}</small><b>${fmtCurto(d)}</b>`;
    b.onclick = () => mudarDia(d); box.appendChild(b);
  }
  $('#dPick').value = naLista ? '' : S.dia;
  const sel = $('#hPick'); if (!sel.options.length) for (let m = HORA_INICIO; m < HORA_FIM; m += PASSO) sel.add(new Option(toHM(m), m));
  sel.value = S.hora;
}
function mudarDia(d) { S.dia = d; renderWhen(); renderTudo(); carregar(d, true); }
$('#dPick').onchange = e => { if (e.target.value) mudarDia(e.target.value); };
$('#hPick').onchange = e => { S.hora = Number(e.target.value); renderTudo(); };

/* ================= planta (baseada no Caderno de Projeto, pág. 4 e 5) ================= */
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
const pts = a => a.map(p => p.join(',')).join(' ');
const R = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const GEO = {
  azul: [[85, 152], [120, 112], [290, 112], [290, 388], [85, 388]],
  amarela: R(85, 388, 290, 660),
  estudos: R(368, 320, 500, 490),
  copa: R(290, 490, 500, 660),
  cow: [[518, 162], [595, 162], [645, 112], [890, 112], [925, 150], [925, 660], [518, 660]],
};
const RECEPCAO = [[290, 112], [365, 112], [415, 162], [500, 162], [500, 320], [368, 320], [368, 490], [290, 490]];
const PLACA = { azul: [95, 330], amarela: [95, 400], estudos: [372, 326], copa: [300, 548], cow: [530, 172] };
const PLACA_W = { azul: 130, amarela: 136, estudos: 124, copa: 130, cow: 160 };
const INICIO = { x: 30, y: 66 };
function caminho(id) {
  if (id === 'cow') return [INICIO, { x: 555, y: 66 }, { x: 555, y: 162 }, { x: 555, y: 238 }];
  const rec = [INICIO, { x: 457, y: 66 }, { x: 457, y: 162 }, { x: 457, y: 215 }, { x: 352, y: 215 }];
  if (id === 'azul') return [...rec, { x: 352, y: 345 }, { x: 290, y: 345 }, { x: 258, y: 345 }];
  if (id === 'amarela') return [...rec, { x: 352, y: 435 }, { x: 290, y: 435 }, { x: 258, y: 440 }];
  if (id === 'estudos') return [...rec, { x: 352, y: 400 }, { x: 368, y: 400 }, { x: 405, y: 400 }];
  return [...rec, { x: 352, y: 470 }, { x: 330, y: 470 }, { x: 330, y: 490 }, { x: 330, y: 520 }];
}
function caixa(id) {
  const p = GEO[id], xs = p.map(q => q[0]), ys = p.map(q => q[1]);
  return [Math.min(...xs) - 20, Math.min(...ys) - 20, Math.max(...xs) - Math.min(...xs) + 40, Math.max(...ys) - Math.min(...ys) + 40];
}
const WOOD = '#D9B287', TABLE = '#C4652B', CHAIR = '#2E2F33';
function cadeira(g, x, y) { el('rect', { x: x - 12, y: y - 12, width: 24, height: 24, rx: 7, fill: CHAIR }, g); el('rect', { x: x - 8, y: y - 8, width: 16, height: 16, rx: 5, fill: '#4A4C52' }, g); }
function rect(g, x, y, w, h, fill, extra = {}) { return el('rect', { x, y, width: w, height: h, fill, ...extra }, g); }
function moveis(id, g) {
  if (id === 'azul') {
    rect(g, 140, 116, 115, 18, '#1F2025', { rx: 2 }); rect(g, 196, 118, 22, 13, '#E6E6E6', { rx: 2 });
    rect(g, 165, 145, 72, 162, TABLE, { rx: 36, stroke: '#8A4318', 'stroke-width': 1.5 });
    [[143, 185], [138, 232], [148, 280], [258, 172], [264, 222], [256, 274]].forEach(([x, y]) => cadeira(g, x, y));
    rect(g, 150, 384, 60, 8, '#F4F4F4', { stroke: '#9AA0AA', 'stroke-width': 1 }); // lousa/TV na divisória
  }
  if (id === 'amarela') {
    rect(g, 88, 498, 150, 66, TABLE, { rx: 3, stroke: '#8A4318', 'stroke-width': 1.5 });
    [[115, 472], [172, 468], [228, 474], [108, 592], [168, 596], [226, 590]].forEach(([x, y]) => cadeira(g, x, y));
  }
  if (id === 'estudos') {
    rect(g, 368, 320, 132, 5, '#00A99D');
    rect(g, 476, 327, 20, 158, WOOD, { stroke: '#9C7549', 'stroke-width': 1 });
    rect(g, 480, 360, 12, 18, '#EDEDED'); rect(g, 480, 430, 12, 18, '#EDEDED');
    cadeira(g, 448, 400); cadeira(g, 448, 455);
  }
  if (id === 'copa') {
    rect(g, 468, 494, 30, 162, WOOD, { stroke: '#9C7549', 'stroke-width': 1 });
    rect(g, 473, 510, 20, 16, '#F2F2F2', { stroke: '#999' }); rect(g, 473, 540, 20, 16, '#F2F2F2', { stroke: '#999' }); rect(g, 471, 600, 24, 26, '#FFFFFF', { stroke: '#999' });
    rect(g, 294, 624, 170, 30, WOOD, { stroke: '#9C7549', 'stroke-width': 1 });
    el('circle', { cx: 390, cy: 512, r: 15, fill: '#F7D21E', stroke: '#C9A800' }, g); el('circle', { cx: 432, cy: 512, r: 15, fill: '#F7D21E', stroke: '#C9A800' }, g);
  }
  if (id === 'cow') {
    rect(g, 620, 116, 272, 44, WOOD, { stroke: '#9C7549', 'stroke-width': 1 });
    rect(g, 640, 121, 232, 11, '#F08A2C', { rx: 3 }); rect(g, 660, 143, 190, 9, '#283069', { rx: 3 });
    [[520, 275, 265, 80], [520, 450, 265, 78]].forEach(([x, y, w, h]) => rect(g, x, y, w, h, '#E8C79B', { stroke: '#B08A5A', 'stroke-width': 1.2 }));
    [262, 368, 437, 541].forEach(y => { for (let k = 0; k < 5; k++) cadeira(g, 548 + k * 52, y); });
    rect(g, 842, 166, 22, 256, '#283069'); rect(g, 896, 166, 24, 256, '#F5A800');
    rect(g, 882, 424, 38, 198, WOOD, { stroke: '#9C7549', 'stroke-width': 1 }); cadeira(g, 862, 470); cadeira(g, 862, 540);
    rect(g, 518, 624, 407, 32, WOOD, { stroke: '#9C7549', 'stroke-width': 1 });
    for (let k = 0; k < 6; k++) { rect(g, 560 + k * 60, 638, 26, 12, '#1F2025', { rx: 2 }); cadeira(g, 573 + k * 60, 604); }
  }
}
let visitante, camVB = [0, 0, 960, 690], movendo = false;
function montarPlanta() {
  const svg = $('#plan'); svg.innerHTML = '';
  const defs = el('defs', {}, svg);
  const hatch = el('pattern', { id: 'ocupada', width: 12, height: 12, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 5, height: 12, fill: '#D0342C', opacity: .32 }, hatch);
  const floor = el('pattern', { id: 'piso', width: 60, height: 14, patternUnits: 'userSpaceOnUse' }, defs);
  el('rect', { width: 60, height: 14, fill: 'var(--floor)' }, floor); el('path', { d: 'M0 13.5H60M30 0V14', stroke: 'var(--floor-line)', 'stroke-width': 1 }, floor);
  const rub = el('pattern', { id: 'borracha', width: 8, height: 8, patternUnits: 'userSpaceOnUse' }, defs);
  el('rect', { width: 8, height: 8, fill: 'var(--street)' }, rub); el('circle', { cx: 4, cy: 4, r: 1.2, fill: '#4A4F5A' }, rub);
  el('symbol', { id: 'fealogo', viewBox: LOGO_VIEWBOX }, defs).innerHTML = LOGO_INNER;

  const decor = el('g', { class: 'decor' }, svg);
  el('rect', { x: 0, y: 18, width: 960, height: 96, fill: 'url(#borracha)' }, decor);
  el('polygon', { points: pts([[365, 112], [415, 162], [595, 162], [645, 112]]), fill: 'url(#borracha)' }, decor);
  el('text', { x: 16, y: 40, class: 'street-lbl', 'font-size': 12 }, decor).textContent = 'Corredor do prédio';
  el('polygon', { points: pts(RECEPCAO), fill: 'url(#piso)' }, decor);
  rect(decor, 293, 114, 16, 168, '#8A5A32'); // estante de madeira
  rect(decor, 297, 124, 44, 46, '#F3EDE0', { rx: 5, stroke: '#B38A5C' }); rect(decor, 297, 184, 44, 46, '#F3EDE0', { rx: 5, stroke: '#B38A5C' });
  rect(decor, 388, 292, 30, 20, '#F08A2C', { rx: 3 }); rect(decor, 430, 256, 48, 40, '#F3EDE0', { rx: 5, stroke: '#B38A5C' }); rect(decor, 482, 238, 14, 42, '#283069');
  el('use', { href: '#fealogo', x: 392, y: 172, width: 90, height: 32, style: 'color:#1D2330' }, decor);
  el('text', { x: 316, y: 312, class: 'plan-lbl', 'font-size': 12 }, decor).textContent = 'Recepção';
  rect(decor, 500, 162, 18, 498, 'var(--wall)');

  const salasG = el('g', {}, svg);
  SALAS.forEach(s => {
    const g = el('g', { class: 'room-g', 'data-room': s.id, tabindex: 0, role: 'button', 'aria-label': s.nome }, salasG);
    el('polygon', { points: pts(GEO[s.id]), fill: 'url(#piso)' }, g);
    el('polygon', { class: 'tint', points: pts(GEO[s.id]), fill: s.cor, opacity: .16 }, g);
    moveis(s.id, el('g', {}, g));
    el('polygon', { class: 'busy', points: pts(GEO[s.id]), fill: 'url(#ocupada)', opacity: 0 }, g);
    el('polygon', { class: 'wallp', points: pts(GEO[s.id]), fill: 'none', stroke: 'var(--wall)', 'stroke-width': 6, 'stroke-linejoin': 'round' }, g);
    const [px, py] = PLACA[s.id], w = PLACA_W[s.id];
    const pl = el('g', { class: 'plate', transform: `translate(${px} ${py})` }, g);
    rect(pl, 0, 0, w, 40, '#FFFFFF', { rx: 4, stroke: '#C9CCD3' }); rect(pl, w - 30, 0, 30, 40, s.cor, { rx: 0 });
    el('path', { d: `M${w - 22} 20h13m-5-5 5 5-5 5`, stroke: s.escura ? '#1C1400' : '#fff', 'stroke-width': 2.2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, pl);
    el('use', { href: '#fealogo', x: 6, y: 4, width: 28, height: 10, style: 'color:#000207' }, pl);
    el('text', { x: 6, y: 25, class: 'plate-name', 'font-size': Math.min(11, (w - 40) / (0.9 * s.nome.length)).toFixed(1) }, pl).textContent = s.nome.toUpperCase();
    el('circle', { class: 'pdot', cx: 10, cy: 33, r: 3.5, fill: '#1E8A55' }, pl);
    el('text', { class: 'plate-st', x: 17, y: 36, 'font-size': 8 }, pl).textContent = 'Livre';
    g.addEventListener('click', () => irParaSala(s.id));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irParaSala(s.id); } });
  });
  const paredes = el('g', { class: 'decor', 'pointer-events': 'none' }, svg);
  el('polygon', { points: pts(RECEPCAO), fill: 'none', stroke: 'var(--wall)', 'stroke-width': 6, 'stroke-linejoin': 'round' }, paredes);
  const janela = (x1, y1, x2, y2) => { el('line', { x1, y1, x2, y2, stroke: 'var(--glass)', 'stroke-width': 6 }, paredes); el('line', { x1, y1, x2, y2, stroke: 'var(--wall)', 'stroke-width': 1 }, paredes); };
  janela(100, 660, 280, 660); janela(300, 660, 460, 660); janela(530, 660, 915, 660);
  el('line', { x1: 290, y1: 190, x2: 290, y2: 312, stroke: 'var(--glass)', 'stroke-width': 4 }, paredes); // vidro da Sala Azul para a recepção
  const porta = (x, y, vertical, len, vidro) => {
    const h = len / 2, a = vertical ? { x1: x, y1: y - h, x2: x, y2: y + h } : { x1: x - h, y1: y, x2: x + h, y2: y };
    el('line', { ...a, stroke: 'var(--floor)', 'stroke-width': 8 }, paredes);
    if (vidro) el('line', { ...a, stroke: 'var(--glass)', 'stroke-width': 3 }, paredes);
  };
  porta(457, 162, false, 54, true); porta(555, 162, false, 48); porta(290, 345, true, 34); porta(290, 435, true, 34); porta(368, 400, true, 34); porta(330, 490, false, 42);
  el('text', { x: 457, y: 150, class: 'street-lbl', 'font-size': 10, 'text-anchor': 'middle' }, paredes).textContent = 'Entrada';
  visitante = el('g', { transform: `translate(${INICIO.x} ${INICIO.y})`, 'pointer-events': 'none' }, svg);
  el('circle', { r: 16, fill: '#0091FF', opacity: .25 }, visitante); el('circle', { r: 9, fill: '#0091FF', stroke: '#fff', 'stroke-width': 3 }, visitante);
}
function pintarPlanta() {
  SALAS.forEach(s => {
    const g = $(`.room-g[data-room="${s.id}"]`); if (!g) return;
    const r = quemOcupa(s.id, S.hora);
    $('.busy', g).setAttribute('opacity', r ? 1 : 0);
    $('.pdot', g).setAttribute('fill', r ? '#D0342C' : '#1E8A55');
    $('.plate-st', g).textContent = r ? `Ocupada até ${fmtH(toMin(r.fim))}` : (s.apenasDiretoria && !S.dirOk ? 'Só diretoria' : 'Livre');
    g.setAttribute('aria-label', `${s.nome}: ${r ? 'ocupada até ' + fmtH(toMin(r.fim)) + ' por ' + r.nome : 'livre'}`);
  });
}
const easeIO = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function animar(ms, fn) { return new Promise(res => { if (reduceMotion || ms <= 0) { fn(1); return res(); } const t0 = performance.now(); const p = t => { const k = Math.min(1, (t - t0) / ms); fn(easeIO(k)); k < 1 ? requestAnimationFrame(p) : res(); }; requestAnimationFrame(p); }); }
function setVB(v) { camVB = v; $('#plan').setAttribute('viewBox', v.map(n => n.toFixed(1)).join(' ')); }
const camera = (alvo, ms) => { const de = [...camVB]; return animar(ms, k => setVB(de.map((a, i) => a + (alvo[i] - a) * k))); };
async function andar(p) {
  const seg = []; let total = 0;
  for (let i = 1; i < p.length; i++) { const a = p[i - 1], b = p[i], l = Math.hypot(b.x - a.x, b.y - a.y); if (l > .5) { seg.push({ a, b, l }); total += l; } }
  await animar(Math.min(1500, Math.max(600, total * .9)), k => { let d = k * total; for (const s of seg) { if (d <= s.l) { visitante.setAttribute('transform', `translate(${s.a.x + (s.b.x - s.a.x) * d / s.l} ${s.a.y + (s.b.y - s.a.y) * d / s.l})`); return; } d -= s.l; } });
  const u = p[p.length - 1]; visitante.setAttribute('transform', `translate(${u.x} ${u.y})`);
}
async function irParaSala(id) {
  if (movendo || S.room === id) return; movendo = true;
  S.room = id; renderLado(); barraPalco();
  if (camVB[2] < 959) await camera([0, 0, 960, 690], 380);
  $('#plan').classList.add('dim'); $$('.room-g').forEach(g => g.classList.toggle('active', g.dataset.room === id));
  await andar(caminho(id)); await camera(caixa(id), 650);
  movendo = false;
}
async function verSede() {
  if (movendo) return; movendo = true; S.room = null; renderLado(); barraPalco();
  await camera([0, 0, 960, 690], 500); $('#plan').classList.remove('dim'); $$('.room-g').forEach(g => g.classList.remove('active')); movendo = false;
}
function barraPalco() { const s = S.room && SALA_POR_ID[S.room]; $('#stageTitle').textContent = s ? `${s.nome} · ${s.apelido}` : 'Planta da sede'; $('#zoomOut').hidden = !s; }
$('#zoomOut').onclick = verSede;
function passoSala(d) { const i = S.room ? SALAS.findIndex(s => s.id === S.room) : -1; irParaSala(SALAS[(i + d + SALAS.length) % SALAS.length].id); }
$('#prevRoom').onclick = () => passoSala(-1); $('#nextRoom').onclick = () => passoSala(1);

/* ================= painel lateral ================= */
function linhaDoDia(lista, comAgora) {
  const W = HORA_FIM - HORA_INICIO; let h = '<div class="dayline">';
  lista.forEach(x => { const a = Math.max(HORA_INICIO, toMin(x.inicio)), b = Math.min(HORA_FIM, toMin(x.fim)); h += `<i style="left:${(a - HORA_INICIO) / W * 100}%;width:${(b - a) / W * 100}%;background:${SALA_POR_ID[x.sala].cor}" title="${esc(`${x.inicio}–${x.fim} ${x.nome}`)}"></i>`; });
  if (comAgora) { const n = agora().min; if (S.dia === agora().dia && n > HORA_INICIO && n < HORA_FIM) h += `<span class="now" style="left:${(n - HORA_INICIO) / W * 100}%"></span>`; }
  return h + '</div><div class="dayticks"><span>7h</span><span>10h</span><span>13h</span><span>16h</span><span>19h</span><span>22h</span></div>';
}
function renderLado() {
  const lado = $('#side'), quando = `${cap(fmtDia(S.dia, true))}, às ${fmtH(S.hora)}`;
  if (!S.room) {
    lado.innerHTML = `<div class="panel"><h3>Salas</h3><p class="muted" style="margin:4px 0 0;font-size:14px">${esc(quando)}</p><div class="rows" id="rows"></div></div>
      <div class="panel"><h3 style="font-size:17px">Regras</h3><ul class="rules">
        <li>Cada reserva pode ter no máximo <b>2 horas</b>.</li>
        <li>O <b>Coworking</b> só pode ser reservado pela diretoria.</li>
        <li>Reuniões <b>semanais</b> (como a RD Estratégia) são marcadas pela diretoria.</li></ul></div>`;
    SALAS.forEach(s => {
      const r = quemOcupa(s.id, S.hora), b = document.createElement('button'); b.className = 'room-row';
      b.innerHTML = `<i class="sw" style="background:${s.cor}"></i><div style="flex:1;min-width:0"><b>${esc(s.nome)} ${s.apenasDiretoria ? `<span class="lock" title="Só diretoria">${ICON_LOCK}</span>` : ''}</b><span>${r ? `${esc(r.nome)} até ${fmtH(toMin(r.fim))}` : esc(s.apelido)}</span></div><span class="st ${r ? 'busy' : 'free'}">${r ? 'Ocupada' : 'Livre'}</span>`;
      b.onclick = () => irParaSala(s.id); $('#rows').appendChild(b);
    });
    return;
  }
  const s = SALA_POR_ID[S.room], r = quemOcupa(s.id, S.hora), doDia = reservasDaSala(s.id), prox = proximaOcupacao(s.id, S.hora);
  lado.innerHTML = `<div class="panel">
      <span class="chip"><i class="dot" style="background:${s.cor}"></i>${esc(s.apelido)}</span>
      <h3 style="margin-top:8px">${esc(s.nome)}</h3>
      <div class="status-line"><span class="pulse ${r ? 'busy' : ''}"></span>${r ? `Ocupada até ${fmtH(toMin(r.fim))} por ${esc(r.nome)}` : prox != null ? `Livre até ${fmtH(prox)}` : 'Livre pelo resto do dia'}</div>
      <p class="muted" style="margin:0;font-size:13.5px">${esc(quando)}${r && r.motivo ? ' · ' + esc(r.motivo) : ''}</p>
      ${linhaDoDia(doDia, true)}
      <div style="margin-top:14px">${podeReservarSala(s.id) ? '<button class="btn btn-primary" id="bRes" style="width:100%">Reservar esta sala</button>' : `<div class="locked">${ICON_LOCK}<span>O Coworking só pode ser reservado pela diretoria.</span></div><button class="btn btn-ghost" id="bDir" style="width:100%;margin-top:8px">Entrar como diretoria</button>`}</div>
    </div>
    <div class="panel"><h3 style="font-size:17px">Reservas do dia</h3>${doDia.length ? '<ul class="daylist" id="dl"></ul>' : '<p class="muted" style="margin:8px 0 0;font-size:14px">Nenhuma reserva nesta sala no dia.</p>'}</div>`;
  $('#bRes')?.addEventListener('click', () => abrirReserva(s.id));
  $('#bDir')?.addEventListener('click', abrirDiretoria);
  const dl = $('#dl'); if (dl) doDia.forEach(x => { const li = document.createElement('li'); li.tabIndex = 0; li.innerHTML = `<b>${x.inicio}–${x.fim}</b><span style="flex:1">${esc(x.nome)}${x.serieId ? ` <span class="rep" title="Semanal">${ICON_REPEAT}</span>` : ''}<br><small class="muted">${esc(x.motivo || '')}</small></span>`; li.onclick = () => abrirDetalhe(x); li.onkeydown = e => { if (e.key === 'Enter') abrirDetalhe(x); }; dl.appendChild(li); });
}

/* ================= calendário ================= */
function renderAgenda() {
  $('#agTitle').textContent = cap(fmtDia(S.dia, true));
  const cal = $('#cal'), W = HORA_FIM - HORA_INICIO, pct = m => ((m - HORA_INICIO) / W * 100) + '%';
  let h = '<div class="hd"></div><div class="hd hours">';
  for (let m = HORA_INICIO + 60; m < HORA_FIM; m += 60) h += `<span style="left:${pct(m)}">${m / 60}h</span>`;
  h += '</div>';
  const a = agora(), mostrarAgora = S.dia === a.dia && a.min > HORA_INICIO && a.min < HORA_FIM;
  SALAS.forEach(s => {
    const trava = !podeReservarSala(s.id);
    h += `<div class="rl"><i class="dot" style="background:${s.cor};width:11px;height:11px"></i>${esc(s.nome)}${s.apenasDiretoria ? `<span class="lock">${ICON_LOCK}</span>` : ''}</div><div class="tr ${trava ? 'locked-row' : ''}" data-sala="${s.id}"><div class="ghost"></div>`;
    reservasDaSala(s.id).forEach(r => {
      h += `<button class="blk ${s.escura ? 'dark' : ''} ${ehMinha(r) ? 'mine' : ''}" data-id="${r.id}" style="left:${pct(toMin(r.inicio))};width:calc(${(toMin(r.fim) - toMin(r.inicio)) / W * 100}% - 2px);background:${s.cor}" title="${esc(`${r.inicio}–${r.fim} ${r.nome} · ${r.motivo || ''}`)}">${r.serieId ? ICON_REPEAT + ' ' : ''}${esc(`${r.inicio}–${r.fim} · ${r.nome}`)}</button>`;
    });
    if (mostrarAgora) h += `<span class="nowline" style="left:${pct(a.min)}"></span>`;
    h += '</div>';
  });
  cal.innerHTML = h;
  $$('.tr', cal).forEach(tr => {
    const sala = tr.dataset.sala, ghost = $('.ghost', tr);
    const slot = e => { const r = tr.getBoundingClientRect(); const m = HORA_INICIO + Math.floor(((e.clientX - r.left) / r.width) * W / PASSO) * PASSO; return Math.max(HORA_INICIO, Math.min(HORA_FIM - PASSO, m)); };
    tr.addEventListener('mousemove', e => { const m = slot(e); ghost.style.left = pct(m); ghost.style.width = `calc(${60 / W * 100}% - 2px)`; ghost.textContent = podeReservarSala(sala) ? toHM(m) : 'Só diretoria'; });
    tr.addEventListener('click', e => {
      const b = e.target.closest('.blk'); if (b) { abrirDetalhe(reservasDoDia().find(x => x.id === b.dataset.id)); return; }
      if (!podeReservarSala(sala)) { abrirDiretoria(); return; }
      abrirReserva(sala, slot(e));
    });
  });
}

/* ================= minhas reservas ================= */
async function renderMinhas() {
  const box = $('#minhas'), a = agora();
  $('#todasWrap').hidden = !S.dirOk; $('#todas').checked = S.todas && S.dirOk;
  box.innerHTML = '<div class="empty"><h3>Carregando…</h3></div>';
  const { ok, dados } = await api('GET', { de: a.dia, dias: 31 });
  if (!ok) { box.innerHTML = `<div class="empty"><h3>Não foi possível carregar</h3><p>${esc(dados.mensagem || 'Confira sua conexão.')}</p></div>`; return; }
  const lista = dados.reservas.filter(r => SALA_POR_ID[r.sala] && (S.todas && S.dirOk ? true : ehMinha(r)) && !(r.data === a.dia && toMin(r.fim) <= a.min))
    .sort((x, y) => (x.data + x.inicio).localeCompare(y.data + y.inicio));
  if (!lista.length) { box.innerHTML = `<div class="empty"><h3>${S.todas ? 'Nenhuma reserva nos próximos 30 dias' : 'Você não tem reservas nos próximos 30 dias'}</h3>${S.todas ? '' : `<p style="margin:0">As reservas feitas com o nome "${esc(S.nome)}" aparecem aqui.</p>`}</div>`; return; }
  box.innerHTML = '';
  lista.forEach(r => {
    const s = SALA_POR_ID[r.sala], c = document.createElement('div'); c.className = 'mcard';
    c.innerHTML = `<div class="band" style="background:${s.cor}"></div><div class="body"><span class="ttl">${esc(s.nome)}${r.serieId ? ` <span class="chip">${ICON_REPEAT} Semanal</span>` : ''}</span>
      <span class="w">${esc(cap(fmtDia(r.data, true)))}, ${r.inicio}–${r.fim}</span><span class="muted" style="font-size:14px">${esc(r.motivo || '')}${S.todas ? ' · ' + esc(r.nome) : ''}</span>
      <div class="acts"></div></div>`;
    const acts = $('.acts', c);
    if (podeCancelar(r)) {
      const b1 = document.createElement('button'); b1.className = 'btn btn-bad sm'; b1.textContent = r.serieId ? 'Cancelar esta data' : 'Cancelar reserva';
      b1.onclick = async () => { if (await cancelar(r)) renderMinhas(); }; acts.appendChild(b1);
      if (r.serieId) { const b2 = document.createElement('button'); b2.className = 'btn btn-bad sm'; b2.textContent = 'Cancelar a série daqui em diante'; b2.onclick = async () => { if (await cancelarSerie(r)) renderMinhas(); }; acts.appendChild(b2); }
    } else acts.innerHTML = '<span class="muted" style="font-size:13px">Feita em outro aparelho: cancele por lá.</span>';
    box.appendChild(c);
  });
}
$('#todas').onchange = e => { S.todas = e.target.checked; renderMinhas(); };
async function cancelar(r) {
  if (!confirm(`Cancelar a reserva da ${SALA_POR_ID[r.sala].nome} em ${fmtDia(r.data)}, ${r.inicio}–${r.fim}?`)) return false;
  const { ok, dados } = await api('DELETE', { id: r.id, data: r.data }, null, tokenDe(r));
  if (!ok) { toast(dados.mensagem || 'Não foi possível cancelar.'); return false; }
  delete S.tokens[r.id]; salvarTokens(); toast('Reserva cancelada'); carregar(S.dia, true); return true;
}
async function cancelarSerie(r) {
  if (!confirm(`Cancelar todas as reuniões desta série a partir de ${fmtDia(r.data)}?`)) return false;
  const { ok, dados } = await api('DELETE', { serie: r.serieId, aPartirDe: r.data }, null, tokenDe(r));
  if (!ok) { toast(dados.mensagem || 'Não foi possível cancelar.'); return false; }
  toast(`${dados.removidas} reunião(ões) canceladas`); carregar(S.dia, true); return true;
}

/* ================= reservar uma sala ================= */
let F = null, simTimer = null;
function abrirReserva(sala, inicioPref) {
  if (!S.nome) { pedirNome(false, () => abrirReserva(sala, inicioPref)); return; }
  if (!podeReservarSala(sala)) { abrirDiretoria(); return; }
  const a = agora(); let ini = inicioPref ?? S.hora;
  if (S.dia === a.dia) ini = Math.max(ini, Math.ceil(a.min / PASSO) * PASSO);
  ini = livreAPartirDe(sala, Math.max(HORA_INICIO, ini)) ?? ini;
  const prox = proximaOcupacao(sala, ini);
  F = { sala, inicio: ini, fim: Math.max(ini + PASSO, Math.min(HORA_FIM, ini + 60, prox ?? HORA_FIM)), motivo: '', pick: 'start', semanal: false, ate: somarDias(S.dia, 7 * 11), pular: false, sim: null };
  $('#drTitle').textContent = `Reservar ${SALA_POR_ID[sala].nome}`;
  renderForm(); abrirDrawer();
}
function estadoSlot(m) {
  const a = agora();
  if (S.dia < a.dia || (S.dia === a.dia && m + PASSO <= a.min)) return 'past';
  const r = quemOcupa(F.sala, m); if (!r) return 'free';
  return ehMinha(r) ? 'mine' : 'busy';
}
const selecaoLivre = () => { for (let m = F.inicio; m < F.fim; m += PASSO) if (estadoSlot(m) !== 'free') return false; return true; };
function ajustarFim() { const lim = F.inicio + maxDur(); if (F.fim > lim) F.fim = lim; if (F.fim > HORA_FIM) F.fim = HORA_FIM; if (F.fim <= F.inicio) F.fim = Math.min(HORA_FIM, F.inicio + PASSO); }
function renderForm(msgErro = '') {
  const s = SALA_POR_ID[F.sala], r = quemOcupa(F.sala, S.hora), a = agora();
  let estado;
  if (r) {
    const livre = livreAPartirDe(F.sala, S.hora);
    estado = `<div class="state busy"><h4>Ocupada até ${fmtH(toMin(r.fim))} por ${esc(r.nome)}</h4><p>Não está disponível às ${fmtH(S.hora)}${r.motivo ? ` · ${esc(r.motivo)}` : ''}.</p>${livre != null ? `<button class="btn btn-primary" id="bDepois">Reservar a partir das ${fmtH(livre)}</button>` : '<p style="margin-top:8px">Não há mais horário livre neste dia.</p>'}</div>`;
  } else {
    const prox = proximaOcupacao(F.sala, S.hora);
    estado = `<div class="state free"><h4>Livre às ${fmtH(S.hora)}</h4><p>${prox != null ? `Disponível até ${fmtH(prox)}.` : 'Disponível pelo resto do dia.'}</p></div>`;
  }
  let barra = '<div class="avail" role="group" aria-label="Horários do dia">';
  for (let m = HORA_INICIO; m < HORA_FIM; m += PASSO) {
    const st = estadoSlot(m), sel = m >= F.inicio && m < F.fim, oc = quemOcupa(F.sala, m);
    barra += `<button type="button" class="av ${st === 'free' ? '' : st} ${sel && st === 'free' ? 'sel' : ''}" data-m="${m}" data-h="${m % 60 === 0 ? m / 60 + 'h' : ''}" title="${toHM(m)}${oc ? ' · ' + esc(oc.nome) : ''}" aria-label="${toHM(m)}: ${st === 'free' ? 'livre' : st === 'past' ? 'já passou' : 'ocupada por ' + esc(oc?.nome || '')}"></button>`;
  }
  barra += '</div><div class="avticks">'; for (let m = HORA_INICIO; m < HORA_FIM; m += 60) barra += `<span>${m / 60}h</span>`; barra += '</div>';
  const opts = (de, ate, v) => { let o = ''; for (let m = de; m <= ate; m += PASSO) o += `<option value="${m}" ${m === v ? 'selected' : ''}>${toHM(m)}</option>`; return o; };
  const doDia = reservasDaSala(F.sala);
  const semanalHTML = S.dirOk ? `<div class="q semanal">
      <label class="switch"><input type="checkbox" id="fSem" ${F.semanal ? 'checked' : ''}><span>Repetir toda ${WD_L[diaSemana(S.dia)]} <small class="muted">(diretoria)</small></span></label>
      ${F.semanal ? `<div class="field" style="margin-top:10px"><label for="fAte">Até</label><input type="date" class="inp" id="fAte" style="width:auto" min="${S.dia}" max="${somarDias(a.dia, DIAS_ANTECEDENCIA_DIRETORIA)}" value="${F.ate}"></div><div id="fSim" class="sim"></div>` : ''}
    </div>` : '';
  $('#drBody').innerHTML = `${estado}
    <div class="q"><span class="lbl">Horários de ${esc(fmtDia(S.dia, true))}</span><p class="help">Toque no início e depois no fim do período. ${S.dirOk ? 'Com a senha da diretoria não há limite de duração.' : 'Máximo de 2 horas por reserva.'}</p>${barra}
      <div class="avleg"><span><i style="background:var(--free-soft)"></i>Livre</span><span><i style="background:var(--busy-soft)"></i>Ocupada</span><span><i style="background:var(--blue)"></i>Seu horário</span></div>
      <div class="times2"><div class="field"><label for="fIni">Das</label><select class="inp" id="fIni">${opts(HORA_INICIO, HORA_FIM - PASSO, F.inicio)}</select></div>
      <div class="field"><label for="fFim">Até</label><select class="inp" id="fFim">${opts(F.inicio + PASSO, Math.min(HORA_FIM, F.inicio + maxDur()), F.fim)}</select></div>
      <span class="dur">${fmtDur(F.fim - F.inicio)}</span></div>
      ${doDia.length ? `<ul class="daylist">${doDia.map(x => `<li><b>${x.inicio}–${x.fim}</b><span style="flex:1">${esc(x.nome)}${x.serieId ? ` <span class="rep">${ICON_REPEAT}</span>` : ''}</span></li>`).join('')}</ul>` : ''}</div>
    ${semanalHTML}
    <div class="q field"><label for="fNome" class="lbl">Seu nome</label><input class="inp" id="fNome" maxlength="60" value="${esc(S.nome)}"></div>
    <div class="q field"><label for="fMot" class="lbl">Motivo</label><input class="inp" id="fMot" maxlength="200" placeholder="Ex.: reunião da área comercial" value="${esc(F.motivo)}"></div>
    <p class="err" id="fErr">${esc(msgErro)}</p>`;
  const livreSel = selecaoLivre();
  const n = F.semanal && F.sim ? F.sim.datas.length - (F.pular ? new Set(F.sim.conflitos.map(c => c.data)).size : 0) : 1;
  $('#drFoot').innerHTML = `<button class="btn btn-ghost" id="fCancel">Fechar</button><button class="btn btn-primary" id="fOk" ${livreSel && S.dia >= a.dia ? '' : 'disabled'}>${F.semanal ? `Reservar ${n} semana${n === 1 ? '' : 's'}` : `Reservar ${toHM(F.inicio)}–${toHM(F.fim)}`}</button>`;
  if (!livreSel && !msgErro) $('#fErr').textContent = 'O período escolhido cruza com outra reserva. Escolha só horários verdes.';
  $('#fCancel').onclick = fecharDrawer; $('#fOk').onclick = enviar;
  $('#fMot').oninput = e => F.motivo = e.target.value;
  $('#bDepois')?.addEventListener('click', () => { const l = livreAPartirDe(F.sala, S.hora); const p = proximaOcupacao(F.sala, l); F.inicio = l; F.fim = Math.min(HORA_FIM, l + 60, p ?? HORA_FIM); renderForm(); simular(); });
  $('#fIni').onchange = e => { F.inicio = Number(e.target.value); if (F.fim <= F.inicio) F.fim = F.inicio + 60; ajustarFim(); renderForm(); simular(); };
  $('#fFim').onchange = e => { F.fim = Number(e.target.value); ajustarFim(); renderForm(); simular(); };
  $$('.av').forEach(b => b.onclick = () => {
    const m = Number(b.dataset.m); if (estadoSlot(m) !== 'free') return;
    if (F.pick === 'end' && m >= F.inicio) { F.fim = m + PASSO; F.pick = 'start'; if (F.fim - F.inicio > maxDur()) $('#fErr').textContent = ''; }
    else { F.inicio = m; const p = proximaOcupacao(F.sala, m); F.fim = Math.min(HORA_FIM, m + 60, p ?? HORA_FIM); F.pick = 'end'; }
    const excedeu = F.fim - F.inicio > maxDur(); ajustarFim(); renderForm(excedeu ? 'Cada reserva pode ter no máximo 2 horas. Ajustei o término.' : ''); simular();
  });
  $('#fSem')?.addEventListener('change', e => { F.semanal = e.target.checked; F.sim = null; renderForm(); simular(); });
  $('#fAte')?.addEventListener('change', e => { if (e.target.value) { F.ate = e.target.value; F.sim = null; simular(); } });
  if (F.semanal) renderSim();
}
function renderSim() {
  const box = $('#fSim'); if (!box) return;
  if (!F.sim) { box.innerHTML = '<p class="muted" style="margin:8px 0 0;font-size:13.5px">Verificando as datas…</p>'; return; }
  const dc = [...new Set(F.sim.conflitos.map(c => c.data))];
  box.innerHTML = `<p style="margin:10px 0 0;font-size:14px"><b>${F.sim.datas.length} reuniões</b>: toda ${WD_L[diaSemana(S.dia)]}, das ${toHM(F.inicio)} às ${toHM(F.fim)}, de ${fmtCurto(F.sim.datas[0])} a ${fmtCurto(F.sim.datas[F.sim.datas.length - 1])}.</p>
    ${dc.length ? `<div class="conflict"><b>${dc.length} data${dc.length > 1 ? 's' : ''} já ${dc.length > 1 ? 'têm' : 'tem'} reserva nesse horário:</b><ul>${F.sim.conflitos.map(c => `<li>${fmtCurto(c.data)}, ${c.inicio}–${c.fim} · ${esc(c.nome)}</li>`).join('')}</ul>
      <label class="switch"><input type="checkbox" id="fPular" ${F.pular ? 'checked' : ''}><span>Criar a série pulando essas datas</span></label></div>` : '<p class="okmsg" style="margin-top:6px">Todas as datas estão livres.</p>'}`;
  $('#fPular')?.addEventListener('change', e => { F.pular = e.target.checked; const k = $('#fOk'); const n = F.sim.datas.length - (F.pular ? dc.length : 0); k.textContent = `Reservar ${n} semana${n === 1 ? '' : 's'}`; });
}
function corpoReserva(extra = {}) {
  return { nome: ($('#fNome')?.value || S.nome).trim(), sala: F.sala, data: S.dia, inicio: toHM(F.inicio), fim: toHM(F.fim), motivo: (F.motivo || '').trim() || 'verificação', semanal: F.semanal, repetirAte: F.ate, ...extra };
}
function simular() {
  if (!F || !F.semanal) return; clearTimeout(simTimer); F.sim = null; renderSim();
  simTimer = setTimeout(async () => {
    const pedido = { ...F };
    const { ok, dados } = await api('POST', {}, corpoReserva({ simular: true, nome: S.nome || 'verificação' })).catch(() => ({ ok: false, dados: {} }));
    if (!F || F.inicio !== pedido.inicio || F.fim !== pedido.fim || F.ate !== pedido.ate) return;
    if (ok) { F.sim = dados; renderSim(); const n = F.sim.datas.length; const k = $('#fOk'); if (k) k.textContent = `Reservar ${n - (F.pular ? new Set(dados.conflitos.map(c => c.data)).size : 0)} semanas`; }
    else { $('#fSim').innerHTML = `<p class="err">${esc(dados.mensagem || 'Não foi possível verificar as datas.')}</p>`; }
  }, 350);
}
async function enviar() {
  const nome = $('#fNome').value.trim().replace(/\s+/g, ' '), motivo = $('#fMot').value.trim();
  if (nome.length < 2) { $('#fErr').textContent = 'Informe seu nome.'; return; }
  if (!motivo) { $('#fErr').textContent = 'Informe o motivo da reserva.'; $('#fMot').focus(); return; }
  if (F.semanal && F.sim && F.sim.conflitos.length && !F.pular) { $('#fErr').textContent = 'Algumas datas já estão ocupadas. Marque "pular essas datas" ou mude o horário.'; return; }
  F.motivo = motivo; S.nome = nome; ls('fj-nome', nome); renderMe();
  const b = $('#fOk'); b.disabled = true; b.textContent = 'Reservando…';
  const corpo = corpoReserva({ nome, motivo, pularConflitos: F.pular });
  const { ok, status, dados } = await api('POST', {}, corpo).catch(() => ({ ok: false, status: 0, dados: {} }));
  if (ok) {
    if (dados.serieId) S.tokens['s:' + dados.serieId] = dados.token; else S.tokens[dados.reservas[0].id] = dados.token;
    salvarTokens();
    dados.reservas.forEach(r => { if (S.porDia[r.data]) S.porDia[r.data].reservas.push(r); });
    const sala = SALA_POR_ID[corpo.sala].prep + ' ' + SALA_POR_ID[corpo.sala].nome;
    fecharDrawer(); renderTudo();
    toast(dados.serieId ? `${dados.reservas.length} reuniões semanais marcadas ${sala}${dados.puladas?.length ? ` (${dados.puladas.length} data(s) puladas)` : ''}` : `Reservado ${sala}, ${corpo.inicio}–${corpo.fim}`);
    carregar(S.dia, true); return;
  }
  if (status === 409) { await carregar(S.dia, true); const c = dados.conflitos?.[0]; if (F) { F.sim = null; renderForm(c ? `Alguém reservou antes: ${c.nome}, ${fmtCurto(c.data)} das ${c.inicio} às ${c.fim}.` : dados.mensagem); simular(); } return; }
  renderForm(dados.mensagem || 'Não foi possível reservar. Confira sua conexão e tente de novo.');
}

/* ================= detalhe de uma reserva ================= */
function abrirDetalhe(r) {
  if (!r) return; F = null;
  const s = SALA_POR_ID[r.sala];
  $('#drTitle').textContent = s.nome;
  $('#drBody').innerHTML = `<div class="ticket" style="border-left:8px solid ${s.cor}"><b>${esc(r.inicio)}–${esc(r.fim)}</b><span>${esc(cap(fmtDia(r.data, true)))}</span></div>
    <dl class="dl"><dt>Reservada por</dt><dd>${esc(r.nome)}</dd><dt>Motivo</dt><dd>${esc(r.motivo || '—')}</dd>${r.serieId ? `<dt>Repetição</dt><dd>${ICON_REPEAT} Toda ${WD_L[diaSemana(r.data)]}</dd>` : ''}</dl><p class="err" id="dErr"></p>`;
  const foot = $('#drFoot'); foot.innerHTML = '';
  if (podeCancelar(r)) {
    const b1 = document.createElement('button'); b1.className = 'btn btn-bad'; b1.textContent = r.serieId ? 'Cancelar esta data' : 'Cancelar reserva'; b1.onclick = async () => { if (await cancelar(r)) fecharDrawer(); }; foot.appendChild(b1);
    if (r.serieId) { const b2 = document.createElement('button'); b2.className = 'btn btn-bad'; b2.textContent = 'Cancelar a série daqui em diante'; b2.onclick = async () => { if (await cancelarSerie(r)) fecharDrawer(); }; foot.appendChild(b2); }
  }
  if (podeReservarSala(r.sala) && livreAPartirDe(r.sala, toMin(r.fim)) != null) { const b3 = document.createElement('button'); b3.className = 'btn btn-primary'; b3.textContent = `Reservar a partir das ${fmtH(livreAPartirDe(r.sala, toMin(r.fim)))}`; b3.onclick = () => abrirReserva(r.sala, toMin(r.fim)); foot.appendChild(b3); }
  const f = document.createElement('button'); f.className = 'btn btn-ghost'; f.textContent = 'Fechar'; f.onclick = fecharDrawer; foot.appendChild(f);
  abrirDrawer();
}

/* ================= drawer, nome, diretoria, abas ================= */
let focoAnterior = null;
function abrirDrawer() { focoAnterior = document.activeElement; $('#scrim').classList.add('on'); $('#drawer').classList.add('on'); setTimeout(() => $('#drClose').focus(), 60); }
function fecharDrawer() { $('#scrim').classList.remove('on'); $('#drawer').classList.remove('on'); F = null; focoAnterior?.focus?.(); }
$('#scrim').onclick = fecharDrawer; $('#drClose').onclick = fecharDrawer;
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if ($('#drawer').classList.contains('on')) fecharDrawer(); if (!$('#dirModal').hidden) $('#dirModal').hidden = true; } });

let depoisDoNome = null;
function pedirNome(precisaCodigo, depois) {
  depoisDoNome = depois || null;
  $('#mNome').value = S.nome; $('#mCod').value = S.codigo;
  $('#mCodWrap').hidden = !precisaCodigo && !S.codigo;
  $('#mErr').textContent = precisaCodigo && S.codigo ? 'Código de acesso inválido.' : '';
  $('#modal').hidden = false; setTimeout(() => (precisaCodigo ? $('#mCod') : $('#mNome')).focus(), 50);
}
$('#mForm').onsubmit = e => {
  e.preventDefault();
  const nome = $('#mNome').value.trim().replace(/\s+/g, ' ');
  if (nome.length < 2) { $('#mErr').textContent = 'Digite seu nome para continuar.'; return; }
  S.nome = nome; ls('fj-nome', nome);
  const mudouCodigo = !$('#mCodWrap').hidden; if (mudouCodigo) { S.codigo = $('#mCod').value.trim(); ls('fj-codigo', S.codigo); }
  $('#modal').hidden = true; renderMe(); renderTudo(); if (mudouCodigo) { carregar(S.dia); verificarDiretoria(true); }
  const d = depoisDoNome; depoisDoNome = null; d?.();
};
function renderMe() {
  $('#meNome').textContent = S.nome ? S.nome.split(' ')[0] : 'Entrar';
  $('#meAv').textContent = S.nome ? S.nome.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() : '?';
}
$('#meBtn').onclick = () => pedirNome(false);
function abrirDiretoria() {
  if (S.dirOk) { if (confirm('Sair do modo diretoria neste aparelho?')) { S.dir = ''; S.dirOk = false; ls('fj-diretoria', null); renderDir(); renderTudo(); toast('Modo diretoria desligado'); } return; }
  $('#dErrM').textContent = S.dirConfigurada ? '' : 'A senha da diretoria ainda não foi configurada no Netlify (variável CODIGO_DIRETORIA).';
  $('#dSenha').value = ''; $('#dirModal').hidden = false; setTimeout(() => $('#dSenha').focus(), 50);
}
$('#dirBtn').onclick = abrirDiretoria;
$('#dCancel').onclick = () => { $('#dirModal').hidden = true; };
$('#dForm').onsubmit = async e => {
  e.preventDefault();
  const senha = $('#dSenha').value; if (!senha) return;
  const b = $('#dForm button[type=submit]'); b.disabled = true; b.textContent = 'Verificando…';
  S.dir = senha; const ok = await verificarDiretoria(true);
  b.disabled = false; b.textContent = 'Entrar';
  if (!ok) { $('#dErrM').textContent = S.dirConfigurada ? 'Senha incorreta.' : 'A senha da diretoria ainda não foi configurada no Netlify (variável CODIGO_DIRETORIA).'; return; }
  ls('fj-diretoria', senha); $('#dirModal').hidden = true; toast('Modo diretoria ativado: sem limite de horário, Coworking liberado e reuniões semanais.');
  if (F) renderForm();
};
function renderDir() {
  const b = $('#dirBtn'); b.classList.toggle('on', S.dirOk);
  $('#dirTxt').textContent = S.dirOk ? 'Diretoria' : 'Diretoria';
  b.setAttribute('aria-pressed', S.dirOk); b.title = S.dirOk ? 'Modo diretoria ativo. Clique para sair.' : 'Entrar com a senha da diretoria';
}

function trocarAba(v) {
  S.view = v;
  $$('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.view === v));
  $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
  $('#whenBar').hidden = v === 'minhas';
  renderTudo(); if (v === 'minhas') renderMinhas();
}
$$('.tab').forEach(t => t.onclick = () => trocarAba(t.dataset.view));
function renderTudo() {
  pintarPlanta(); if (!movendo) renderLado();
  if (S.view === 'agenda') renderAgenda();
  if (F && $('#drawer').classList.contains('on') && !document.activeElement?.matches?.('#fNome,#fMot,#fAte')) renderForm();
}

/* ================= início ================= */
$('#logoTop').innerHTML = logoSVG(); $('#logoModal').innerHTML = logoSVG();
montarPlanta(); renderWhen(); renderMe(); renderDir(); barraPalco(); renderTudo();
if (!S.nome) pedirNome(false);
carregar(S.dia, true); if (S.dir) verificarDiretoria(true);
setInterval(() => { if (document.visibilityState === 'visible' && !(F && F.semanal)) { const a = agora(); if (S.dia < a.dia) mudarDia(a.dia); else carregar(S.dia, true); } }, 45000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') carregar(S.dia, true); });
