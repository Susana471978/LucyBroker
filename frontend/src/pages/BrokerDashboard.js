import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Inbox, Clock, Paperclip, LogOut, RefreshCw, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../services/apiClient';

const logAction = async (accion, email) => {
  try {
    await api.post('/log/accion', {
      accion,
      correo_id: email?.id || '',
      correo_asunto: email?.subject || '',
      correo_de: email?.from_email || '',
      categoria: email?.categoria || '',
      prioridad: email?.priority?.priority_label || '',
    });
  } catch (e) {}
};

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

const getPriorityStyle = (label) => {
  if (label === 'ALTA' || label === 'PRIORITARIO') return { bg: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' };
  if (label === 'MEDIA' || label === 'SEGUIMIENTO') return { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' };
  return { bg: 'rgba(201,178,124,0.06)', color: C.gold, border: `1px solid ${C.border}` };
};

export default function BrokerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  const firstName = user?.name?.split(' ')[0] || 'Agente';
  const hour = new Date().getHours();
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const today = new Date().toISOString().split('T')[0];

  const fetchEmails = async () => {
    try {
      setSyncing(true);
      const res = await api.get('/emails');
      const data = res.data?.data || res.data || [];
      setEmails(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError('Error al cargar correos');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => { fetchEmails(); }, []);

  const selectedEmail = emails.find(e => e.email?.id === selected);

  const stats = {
    total: emails.length,
    prioritarios: emails.filter(e => ['ALTA', 'PRIORITARIO'].includes(e.priority?.priority_label)).length,
    seguimiento: emails.filter(e => ['MEDIA', 'SEGUIMIENTO'].includes(e.priority?.priority_label)).length,
    with_attachments: emails.filter(e => e.email?.has_attachments).length,
  };

  return (
    <div style={{ minHeight: '100vh', background: C.black, fontFamily: "'Plus Jakarta Sans', sans-serif", color: C.textPrimary }}>

      <header style={{ borderBottom: `1px solid ${C.border}`, padding: '0 2rem', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(3,3,5,0.92)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', color: C.gold, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            OBJETIVA<span style={{ color: C.champagne }}>.</span>
          </div>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.18em', color: C.textMuted, borderLeft: `1px solid ${C.border}`, paddingLeft: '0.75rem' }}>
            Correduría de Seguros
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={fetchEmails} disabled={syncing} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}>
            <RefreshCw size={14} strokeWidth={1.5} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button
            title="Descargar informe del día"
            onClick={async () => {
              try {
                const res = await api.get(`/log/pdf?fecha=${today}`, { responseType: 'blob' });
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = `informe_objetiva_${today}.pdf`;
                a.click();
                window.URL.revokeObjectURL(url);
              } catch(e) { alert('Error al descargar el informe'); }
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, display: 'flex', alignItems: 'center' }}
          >
            <Download size={14} strokeWidth={1.5} />
          </button>
          { user?.role === 'director' || user?.role === 'admin' ? (
            <button onClick={() => navigate('/admin/users')} style={{ background: 'none', cursor: 'pointer', fontSize: '0.75rem', color: C.gold, padding: '2px 8px', borderRadius: '6px', border: `1px solid ${C.borderGold}` }}>
              Usuarios
            </button>
          ) : null }
          <span style={{ fontSize: '0.78rem', color: C.textSecondary }}>{user?.name}</span>
          <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted }}>
            <LogOut size={15} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '4rem 3rem' }}>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.3em', color: C.gold, opacity: 0.6, marginBottom: '0.4rem' }}>{greeting}</div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.4rem', fontWeight: 300, color: C.textPrimary, margin: 0, lineHeight: 1.05 }}>
            Tu bandeja, {firstName}
          </h1>
          <p style={{ fontSize: '0.75rem', color: C.textMuted, marginTop: '0.4rem' }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: C.border, border: `1px solid ${C.border}`, marginBottom: '2.5rem' }}>
          {[
            { icon: <Inbox size={15} strokeWidth={1.5} />, label: 'Total correos', value: stats.total },
            { icon: <Mail size={15} strokeWidth={1.5} />, label: 'Prioritarios', value: stats.prioritarios, highlight: true },
            { icon: <Clock size={15} strokeWidth={1.5} />, label: 'Seguimiento', value: stats.seguimiento },
            { icon: <Paperclip size={15} strokeWidth={1.5} />, label: 'Con adjuntos', value: stats.with_attachments },
          ].map((stat, i) => (
            <div key={i} style={{ padding: '1.5rem 1.25rem', background: C.black }}>
              <div style={{ color: stat.highlight ? C.gold : C.textMuted, marginBottom: '0.75rem' }}>{stat.icon}</div>
              <div style={{ fontSize: '2rem', fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, color: stat.highlight ? C.gold : C.textPrimary, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: '0.65rem', color: C.textMuted, marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.15em' }}>{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '4rem', color: C.textMuted, fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Cargando correos...
          </div>
        )}
        {error && (
          <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171', fontSize: '0.78rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: C.textMuted, marginBottom: '1rem' }}>
                Requieren atención — {emails.length} correos
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: C.border }}>
                {emails.map((item, i) => {
                  const pStyle = getPriorityStyle(item.priority?.priority_label);
                  const isSelected = selected === item.email?.id;
                  return (
                    <motion.div key={item.email?.id}
                      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
                      onClick={() => {
                        if (!isSelected) logAction('LEIDO', { ...item.email, categoria: item.categoria, priority: item.priority });
                        setSelected(isSelected ? null : item.email?.id);
                      }}
                      style={{ padding: '1rem 1.25rem', background: isSelected ? C.surfaceHover : C.black, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', borderLeft: isSelected ? `2px solid ${C.gold}` : '2px solid transparent', transition: 'background .2s' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span style={{ ...pStyle, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.12em', padding: '2px 8px' }}>
                            {item.priority?.priority_label}
                          </span>
                          {item.categoria && (
                            <span style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.1em', color: C.textMuted }}>
                              {item.categoria}
                            </span>
                          )}
                          {item.email?.has_attachments && <Paperclip size={10} strokeWidth={1.5} color={C.textMuted} />}
                        </div>
                        <div style={{ fontSize: '0.84rem', color: C.textPrimary, marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.email?.subject}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: C.textMuted }}>
                          {item.email?.from_name} · {new Date(item.email?.date).toLocaleDateString('es-ES')}
                        </div>
                        {item.resumen && (
                          <div style={{ fontSize: '0.73rem', color: C.textSecondary, marginTop: '0.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.resumen}
                          </div>
                        )}
                      </div>
                      <div style={{ width: '32px', height: '32px', background: 'rgba(201,178,124,0.08)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: C.gold }}>{item.priority?.priority_score}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {selectedEmail && (
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                style={{ padding: '1.5rem', background: C.black, border: `1px solid ${C.borderGold}` }}>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: C.gold, opacity: 0.6, marginBottom: '1rem' }}>Detalle</div>
                <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 300, color: C.textPrimary, marginBottom: '0.5rem' }}>
                  {selectedEmail.email?.subject}
                </h3>
                <div style={{ fontSize: '0.72rem', color: C.textMuted, marginBottom: '0.5rem' }}>
                  De: {selectedEmail.email?.from_name} &lt;{selectedEmail.email?.from_email}&gt;
                </div>
                {selectedEmail.datos_clave && Object.values(selectedEmail.datos_clave).some(v => v) && (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(201,178,124,0.03)', border: `1px solid ${C.border}` }}>
                    {selectedEmail.datos_clave.cliente && <div style={{ fontSize: '0.72rem', color: C.textMuted }}>Cliente: <span style={{ color: C.textSecondary }}>{selectedEmail.datos_clave.cliente}</span></div>}
                    {selectedEmail.datos_clave.poliza && <div style={{ fontSize: '0.72rem', color: C.textMuted }}>Póliza: <span style={{ color: C.gold }}>{selectedEmail.datos_clave.poliza}</span></div>}
                    {selectedEmail.datos_clave.aseguradora && <div style={{ fontSize: '0.72rem', color: C.textMuted }}>Aseguradora: <span style={{ color: C.textSecondary }}>{selectedEmail.datos_clave.aseguradora}</span></div>}
                    {selectedEmail.datos_clave.urgencia && <div style={{ fontSize: '0.72rem', color: '#f87171' }}>{selectedEmail.datos_clave.urgencia}</div>}
                  </div>
                )}
                {selectedEmail.resumen && (
                  <p style={{ fontSize: '0.82rem', color: C.textSecondary, lineHeight: 1.75, marginBottom: '1.5rem' }}>
                    {selectedEmail.resumen}
                  </p>
                )}
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '1.25rem' }}>
                  <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: C.textMuted, marginBottom: '0.75rem' }}>Respuesta sugerida</div>
                  <div style={{ fontSize: '0.8rem', color: C.textSecondary, lineHeight: 1.75, padding: '1rem', background: 'rgba(201,178,124,0.03)', border: `1px solid ${C.border}`, whiteSpace: 'pre-wrap' }}>
                    {selectedEmail.borrador || `Estimado/a ${selectedEmail.email?.from_name?.split(' ')[0]}, gracias por contactar con nosotros. Hemos recibido su mensaje y nos pondremos en contacto con usted a la mayor brevedad posible.`}
                  </div>
                  <button
                    onClick={() => logAction('RESPONDIDO', { ...selectedEmail.email, categoria: selectedEmail.categoria, priority: selectedEmail.priority })}
                    style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', background: 'transparent', border: `1px solid ${C.borderGold}`, color: C.gold, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.18em', cursor: 'pointer' }}
                    onMouseEnter={e => e.target.style.background = 'rgba(201,178,124,0.06)'}
                    onMouseLeave={e => e.target.style.background = 'transparent'}>
                    Enviar respuesta
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
