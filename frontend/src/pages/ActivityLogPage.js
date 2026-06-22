import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, Download, RefreshCw, Users, Filter, FileText } from 'lucide-react';
import api from '../services/apiClient';

const C = {
  black: '#030305',
  gold: '#C9B27C',
  champagne: '#E8D5A3',
  surface: 'rgba(201,178,124,0.03)',
  surfaceHover: 'rgba(201,178,124,0.06)',
  border: 'rgba(201,178,124,0.1)',
  borderGold: 'rgba(201,178,124,0.3)',
  textPrimary: '#F3F3EE',
  textSecondary: 'rgba(243,243,238,0.6)',
  textMuted: 'rgba(243,243,238,0.35)',
};

const Badge = ({ text, color }) => (
  <span style={{
    background: `${color}18`,
    color,
    border: `1px solid ${color}40`,
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.05em',
  }}>{text}</span>
);

const accionColor = (accion) => {
  if (!accion) return C.textMuted;
  const a = accion.toUpperCase();
  if (a.includes('ELIMINAD') || a.includes('ERROR')) return '#f87171';
  if (a.includes('ENVIADO') || a.includes('CREADO') || a.includes('REGISTRADO')) return '#34d399';
  if (a.includes('LEIDO') || a.includes('VISTO')) return C.gold;
  if (a.includes('EDITADO') || a.includes('ACTUALIZADO')) return '#60a5fa';
  return C.textSecondary;
};

export default function ActivityLogPage() {
  const { user } = useAuth();
  const isPrivileged = ['director', 'admin'].includes(user?.role);

  const [logs, setLogs]           = useState([]);
  const [summary, setSummary]     = useState(null);
  const [ranking, setRanking]     = useState([]);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [fecha, setFecha]         = useState(new Date().toISOString().split('T')[0]);
  const [filterUser, setFilterUser] = useState('');
  const [error, setError]         = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isPrivileged) {
        const params = new URLSearchParams({ fecha });
        if (filterUser) params.append('filter_user_id', filterUser);
        const [infoRes, globalRes] = await Promise.all([
          api.get(`/log/informe?${params}`),
          api.get(`/log/global?fecha=${fecha}`),
        ]);
        const info = infoRes.data?.data || infoRes.data;
        const global = globalRes.data?.data || globalRes.data;
        setLogs(info.logs || []);
        setSummary(info);
        setRanking(global.ranking_usuarios || []);
      } else {
        const res = await api.get(`/log/informe?fecha=${fecha}`);
        const info = res.data?.data || res.data;
        setLogs(info.logs || []);
        setSummary(info);
      }
    } catch (e) {
      setError('Error al cargar el log de actividad');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!isPrivileged) return;
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data?.users || []);
    } catch {}
  };

  useEffect(() => { fetchLogs(); }, [fecha, filterUser]);
  useEffect(() => { fetchUsers(); }, []);

  const downloadPDF = async () => {
    try {
      const res = await api.get(`/log/pdf?fecha=${fecha}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `informe_objetiva_${fecha}.pdf`;
      a.click();
    } catch {}
  };

  const downloadCSV = async () => {
    try {
      const res = await api.get(`/log/csv?fecha=${fecha}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `informe_objetiva_${fecha}.csv`;
      a.click();
    } catch {}
  };

  return (
    <div style={{ minHeight: '100vh', background: C.black, color: C.textPrimary, fontFamily: 'Inter, sans-serif', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Activity size={22} color={C.gold} />
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: C.textPrimary, margin: 0 }}>Audit Log</h1>
            <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>Registro de actividad · Objetiva</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchLogs} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 12px', color: C.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <RefreshCw size={14} /> Actualizar
          </button>
          <button onClick={downloadPDF} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 12px', color: C.gold, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <FileText size={14} /> PDF
          </button>
          <button onClick={downloadCSV} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 12px', color: C.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 12px' }}>
          <Filter size={13} color={C.textMuted} />
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: C.textPrimary, fontSize: 13, outline: 'none' }}
          />
        </div>
        {isPrivileged && users.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 12px' }}>
            <Users size={13} color={C.textMuted} />
            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: C.textPrimary, fontSize: 13, outline: 'none' }}
            >
              <option value="">Todos los usuarios</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Stats cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total acciones', value: summary.total_acciones },
            ...Object.entries(summary.por_accion || {}).slice(0, 4).map(([k, v]) => ({ label: k, value: v })),
          ].map((s, i) => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 20px' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: i === 0 ? C.gold : C.textPrimary }}>{s.value}</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isPrivileged ? '1fr 280px' : '1fr', gap: 16 }}>

        {/* Tabla de logs */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Detalle de actividad · {logs.length} registros
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>Cargando...</div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#f87171' }}>{error}</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>Sin actividad registrada para esta fecha</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {['Hora', 'Usuario', 'Acción', 'Asunto', 'Categoría'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: C.textMuted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log.id || i} style={{ borderBottom: `1px solid ${C.border}`, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 16px', color: C.textMuted, whiteSpace: 'nowrap' }}>{log.hora?.slice(0, 5)}</td>
                      <td style={{ padding: '10px 16px', color: C.textSecondary }}>{log.user_name}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <Badge text={log.accion} color={accionColor(log.accion)} />
                      </td>
                      <td style={{ padding: '10px 16px', color: C.textSecondary, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.correo_asunto || '—'}
                      </td>
                      <td style={{ padding: '10px 16px', color: C.textMuted }}>{log.categoria || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Ranking usuarios (solo director/admin) */}
        {isPrivileged && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={13} /> Ranking del equipo
              </div>
              {ranking.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>Sin datos</div>
              ) : (
                <div>
                  {ranking.map((r, i) => (
                    <div key={i} style={{ padding: '12px 20px', borderBottom: i < ranking.length - 1 ? `1px solid ${C.border}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: i === 0 ? C.gold : C.textMuted, fontWeight: 700, width: 16 }}>#{i + 1}</span>
                        <span style={{ fontSize: 13, color: C.textPrimary }}>{r.usuario}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: i === 0 ? C.gold : C.textSecondary }}>{r.acciones}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Por categoría */}
            {summary?.por_categoria && Object.keys(summary.por_categoria).length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Por categoría
                </div>
                {Object.entries(summary.por_categoria).map(([cat, n], i, arr) => (
                  <div key={cat} style={{ padding: '10px 20px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: C.textSecondary }}>{cat}</span>
                    <span style={{ color: C.gold, fontWeight: 600 }}>{n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
