import { useState, useRef } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ── Config ────────────────────────────────────────────────────────────────────
const CLIENT_ID  = '727cd675-c75b-4c02-a1c8-1556d022313a';
const TENANT_ID  = '811ad58a-849e-4e62-bcbf-ae640a5c6dd9';
const SP_HOST    = 'odrlnet.sharepoint.com';

const msalInstance = new PublicClientApplication({
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: { cacheLocation: 'sessionStorage' },
});
await msalInstance.initialize();

const GRAPH_SCOPES = [
  'https://graph.microsoft.com/Sites.Read.All',
  'https://graph.microsoft.com/Files.Read.All',
  'User.Read',
];
const SP_SCOPES = [`https://${SP_HOST}/AllSites.Read`];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getToken(scopes) {
  const account = msalInstance.getAllAccounts()[0];
  try {
    return (await msalInstance.acquireTokenSilent({ scopes, account })).accessToken;
  } catch {
    return (await msalInstance.acquireTokenPopup({ scopes })).accessToken;
  }
}

async function graphGet(path, token) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Graph ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function spGet(url, token, raw = false) {
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json;odata=verbose',
    },
  });
  if (!r.ok) throw new Error(`SP ${url}: ${r.status}`);
  return raw ? r.arrayBuffer() : r.json();
}

function blobToBase64(buffer) {
  return new Promise(resolve => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    resolve(btoa(binary));
  });
}

function getExt(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg'].includes(ext)) return 'jpeg';
  if (ext === 'png') return 'png';
  if (ext === 'gif') return 'gif';
  return 'png';
}

// ── Excel generator ───────────────────────────────────────────────────────────
async function generateExcel(items, fieldMap, siteUrl, listName, spToken, onProgress) {
  const MAX_EV = 5;
  const ROW_H  = 120; // pixels → ExcelJS uses points (1pt ≈ 1.33px)
  const ROW_H_PT = ROW_H * 0.75;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('UAT');
  ws.views = [{ showGridLines: false }];

  const headers = ['ID', 'Cenário', 'Passo', 'Resultado',
    ...Array.from({ length: MAX_EV }, (_, i) => `Evidência ${i + 1}`), 'Link'];
  const widths  = [10, 30, 30, 20, ...Array(MAX_EV).fill(28), 18];

  ws.columns = headers.map((h, i) => ({ header: h, width: widths[i] }));
  ws.getRow(1).height = 24;
  ws.getRow(1).eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const f    = item.fields || {};
    const id   = f.id || f.ID || item.id;
    onProgress(idx + 1, items.length, `ID ${id}`);

    // Buscar anexos via SharePoint REST
    let attachments = [];
    try {
      const attUrl = `${siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listName)}')/items(${id})/AttachmentFiles`;
      const attResp = await spGet(attUrl, spToken);
      attachments = attResp?.d?.results || [];
    } catch (e) {
      console.warn(`Anexos do item ${id}:`, e.message);
    }

    const excelRow = idx + 2; // linha Excel (header=1)
    const row = ws.getRow(excelRow);
    row.height = attachments.length > 0 ? ROW_H_PT : 20;

    row.getCell(1).value = Number(id);
    row.getCell(2).value = f[fieldMap.cenario]  || '';
    row.getCell(3).value = f[fieldMap.passo]    || '';
    row.getCell(4).value = f[fieldMap.resultado] || '';

    // Imagens embutidas
    for (let i = 0; i < Math.min(attachments.length, MAX_EV); i++) {
      const att = attachments[i];
      try {
        const buf  = await spGet(`${siteUrl}${att.ServerRelativeUrl}`, spToken, true);
        const b64  = await blobToBase64(buf);
        const imgId = wb.addImage({ base64: b64, extension: getExt(att.FileName) });
        ws.addImage(imgId, {
          tl: { col: 4 + i,       row: excelRow - 1 },
          br: { col: 4 + i + 1,   row: excelRow },
          editAs: 'oneCell',
        });
      } catch (e) {
        row.getCell(5 + i).value = att.FileName;
        console.warn(`Imagem ${att.FileName}:`, e.message);
      }
    }

    // Link para pasta de evidências
    if (attachments.length > 0) {
      const folderPath = `${siteUrl}/Lists/${listName}/Attachments/${id}`;
      row.getCell(4 + MAX_EV + 1).value = {
        text: '📷 Abrir pasta',
        hyperlink: folderPath,
      };
      row.getCell(4 + MAX_EV + 1).font = { color: { argb: 'FF0563C1' }, underline: true };
    }

    row.eachCell({ includeEmpty: true }, cell => {
      if (!cell.value && typeof cell.value !== 'number') return;
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  }

  const buf  = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const date = new Date().toISOString().split('T')[0];
  saveAs(blob, `UAT_Resultados_${date}.xlsx`);
}

// ── Estilos inline ────────────────────────────────────────────────────────────
const S = {
  page:   { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f2f1' },
  card:   { background: '#fff', borderRadius: 8, padding: 40, width: 520, boxShadow: '0 2px 12px #0002' },
  title:  { fontSize: 22, fontWeight: 700, color: '#1F3864', marginBottom: 6 },
  sub:    { fontSize: 13, color: '#666', marginBottom: 28 },
  label:  { display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 },
  input:  { width: '100%', padding: '9px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, marginBottom: 18, outline: 'none' },
  btn:    { width: '100%', padding: '11px 0', background: '#0078d4', color: '#fff', border: 'none', borderRadius: 4, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  btnSec: { width: '100%', padding: '11px 0', background: '#fff', color: '#0078d4', border: '1px solid #0078d4', borderRadius: 4, fontSize: 14, cursor: 'pointer', marginTop: 10 },
  select: { width: '100%', padding: '9px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: 14, marginBottom: 18 },
  bar:    { height: 8, background: '#e0e0e0', borderRadius: 4, marginTop: 16, overflow: 'hidden' },
  fill:   { height: '100%', background: '#0078d4', borderRadius: 4, transition: 'width .3s' },
  err:    { background: '#fde7e9', color: '#c0392b', padding: 12, borderRadius: 4, fontSize: 13, marginBottom: 16 },
  ok:     { background: '#e6f4ea', color: '#276221', padding: 12, borderRadius: 4, fontSize: 13, marginBottom: 16 },
};

// ── Componente principal ──────────────────────────────────────────────────────
export default function App() {
  const [step,     setStep]     = useState('login');   // login|configure|mapping|processing|done
  const [siteUrl,  setSiteUrl]  = useState('https://odrlnet.sharepoint.com/sites/Intranet-Foresea-Sistemas');
  const [listName, setListName] = useState('');
  const [fields,   setFields]   = useState([]);        // nomes internos disponíveis na list
  const [fieldMap, setFieldMap] = useState({ cenario: '', passo: '', resultado: '' });
  const [progress, setProgress] = useState({ cur: 0, total: 0, label: '' });
  const [error,    setError]    = useState('');

  const tokensRef = useRef({});

  // ── Login ─────────────────────────────────────────────────────────────────
  async function handleLogin() {
    setError('');
    try {
      await msalInstance.loginPopup({ scopes: GRAPH_SCOPES });
      setStep('configure');
    } catch (e) { setError(e.message); }
  }

  // ── Conectar à list e buscar campos ───────────────────────────────────────
  async function handleConnect() {
    setError('');
    if (!listName.trim()) { setError('Informe o nome da MS List.'); return; }
    try {
      // Obter tokens
      const gToken = await getToken(GRAPH_SCOPES);
      const sToken = await getToken(SP_SCOPES);
      tokensRef.current = { gToken, sToken };

      // Buscar site via Graph
      const path = siteUrl.replace(`https://${SP_HOST}`, '');
      const site  = await graphGet(`/sites/${SP_HOST}:${path}`, gToken);

      // Buscar schema da list via SharePoint REST
      const schemaUrl = `${siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listName)}')/fields?$filter=Hidden eq false and ReadOnlyField eq false`;
      const schema    = await spGet(schemaUrl, sToken);
      const allFields = (schema?.d?.results || [])
        .filter(f => f.FieldTypeKind !== 12 && f.InternalName !== 'Attachments')
        .map(f => ({ label: f.Title, value: f.InternalName }));

      setFields(allFields);
      // Auto-detectar nomes comuns
      const find = (...names) => allFields.find(f => names.includes(f.value))?.value || '';
      setFieldMap({
        cenario:   find('Title', 'Titulo', 'Cenario', 'Cen_x00e1_rio'),
        passo:     find('Passo', 'Passo0', 'Passo_x0020_N_x00fa_mero'),
        resultado: find('Resultado', 'Resultado0', 'ResultadoObtido'),
      });

      // Guardar site id e list name p/ uso posterior
      tokensRef.current.siteId    = site.id;
      tokensRef.current.listNameE = listName;

      setStep('mapping');
    } catch (e) { setError(e.message); }
  }

  // ── Processar e gerar Excel ───────────────────────────────────────────────
  async function handleExport() {
    setError('');
    if (!fieldMap.cenario) { setError('Mapeie ao menos a coluna Cenário.'); return; }
    setStep('processing');
    setProgress({ cur: 0, total: 0, label: 'Buscando itens...' });

    try {
      const { gToken, sToken, listNameE } = tokensRef.current;

      // Buscar todos os itens via SharePoint REST (paginado)
      let items = [];
      let url   = `${siteUrl}/_api/web/lists/getbytitle('${encodeURIComponent(listNameE)}')/items?$top=200&$select=ID,${Object.values(fieldMap).filter(Boolean).join(',')}`;
      while (url) {
        const resp = await spGet(url, sToken);
        items = [...items, ...(resp?.d?.results || [])];
        url   = resp?.d?.__next || null;
      }
      setProgress({ cur: 0, total: items.length, label: `${items.length} itens encontrados` });

      await generateExcel(
        items.map(i => ({ id: i.ID, fields: i })),
        fieldMap,
        siteUrl,
        listNameE,
        sToken,
        (cur, total, label) => setProgress({ cur, total, label }),
      );

      setStep('done');
    } catch (e) {
      setError(e.message);
      setStep('mapping');
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  const pct = progress.total > 0 ? Math.round((progress.cur / progress.total) * 100) : 0;

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.title}>UAT Extractor</div>
        <div style={S.sub}>Extração de MS Lists com imagens para Excel</div>

        {error && <div style={S.err}>⚠ {error}</div>}

        {/* ── LOGIN ── */}
        {step === 'login' && (
          <button style={S.btn} onClick={handleLogin}>
            🔑 Entrar com conta Microsoft
          </button>
        )}

        {/* ── CONFIGURAR ── */}
        {step === 'configure' && (<>
          <label style={S.label}>URL do Site SharePoint</label>
          <input style={S.input} value={siteUrl} onChange={e => setSiteUrl(e.target.value)} />

          <label style={S.label}>Nome da MS List</label>
          <input
            style={S.input}
            placeholder="Ex: UAT - ALMOXARIFADO DE (TESTES)"
            value={listName}
            onChange={e => setListName(e.target.value)}
          />

          <button style={S.btn} onClick={handleConnect}>Conectar à lista</button>
        </>)}

        {/* ── MAPEAR COLUNAS ── */}
        {step === 'mapping' && (<>
          <p style={{ fontSize: 13, color: '#333', marginBottom: 18 }}>
            Selecione quais colunas da lista correspondem a cada campo:
          </p>

          {[
            { key: 'cenario',   label: 'Cenário *' },
            { key: 'passo',     label: 'Passo' },
            { key: 'resultado', label: 'Resultado' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label style={S.label}>{label}</label>
              <select
                style={S.select}
                value={fieldMap[key]}
                onChange={e => setFieldMap(m => ({ ...m, [key]: e.target.value }))}
              >
                <option value="">— não mapear —</option>
                {fields.map(f => (
                  <option key={f.value} value={f.value}>{f.label} ({f.value})</option>
                ))}
              </select>
            </div>
          ))}

          <button style={S.btn} onClick={handleExport}>⬇ Gerar Excel com imagens</button>
          <button style={S.btnSec} onClick={() => setStep('configure')}>← Voltar</button>
        </>)}

        {/* ── PROCESSANDO ── */}
        {step === 'processing' && (<>
          <p style={{ fontSize: 14, color: '#333', marginBottom: 8 }}>
            {progress.label}
          </p>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
            {progress.cur} de {progress.total} itens
          </p>
          <div style={S.bar}>
            <div style={{ ...S.fill, width: `${pct}%` }} />
          </div>
          <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>Não feche esta aba.</p>
        </>)}

        {/* ── CONCLUÍDO ── */}
        {step === 'done' && (<>
          <div style={S.ok}>✅ Excel gerado e baixado com sucesso!</div>
          <button style={S.btn} onClick={() => { setStep('configure'); setError(''); }}>
            Nova extração
          </button>
        </>)}
      </div>
    </div>
  );
}
