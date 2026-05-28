import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockEmails, mockStats, mockAlerts } from '../services/mockData';
import { Mail, Inbox, Clock, Paperclip, AlertTriangle, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

const getPriorityClass = (label) => {
  if (label === 'PRIORITARIO') return { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' };
  if (label === 'SEGUIMIENTO') return { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' };
  return { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.3)' };
};

export default function BrokerDashboard() {
  const { user, logout } = useAuth();
  const [selected, setSelected] = useState(null);
  const firstName = user?.name?.split(' ')[0] || 'Agente';
  const hour = new Date().getHours();
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';

  const selectedEmail = mockEmails.find(e => e.email.id === selected);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background-base)', fontFamily: 'var(--font-family-base)', color: 'var(--text-primary)' }}>
      
      {/* Navbar */}
      <header style={{ borderBottom: '1px solid var(--border-subtle)', padding: '0 2rem', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-glass)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.4rem', color: 'var(--champagne)', letterSpacing: '0.05em' }}>Lucy</div>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '0.75rem' }}>Correduría de Seguros</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{user?.name}</span>
          <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <LogOut size={16} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--champagne)', opacity: 0.6, marginBottom: '0.4rem' }}>{greeting}</div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2.2rem', fontWeight: 300, color: 'var(--text-primary)', margin: 0 }}>Tu bandeja, {firstName}</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </motion.div>

        {/* Alertas */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
          {mockAlerts.map((alert, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '1px', background: alert.urgency === 'high' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border: alert.urgency === 'high' ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(245,158,11,0.2)' }}>
              <AlertTriangle size={14} strokeWidth={1.5} color={alert.urgency === 'high' ? '#ef4444' : '#f59e0b'} />
              <span style={{ fontSize: '0.78rem', color: alert.urgency === 'high' ? '#fca5a5' : '#fcd34d' }}>{alert.text}</span>
            </div>
          ))}
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { icon: <Inbox size={16} strokeWidth={1.5} />, label: 'Total correos', value: mockStats.total },
            { icon: <Mail size={16} strokeWidth={1.5} />, label: 'Prioritarios', value: mockStats.prioritarios, highlight: true },
            { icon: <Clock size={16} strokeWidth={1.5} />, label: 'Seguimiento', value: mockStats.seguimiento },
            { icon: <Paperclip size={16} strokeWidth={1.5} />, label: 'Con adjuntos', value: mockStats.with_attachments },
          ].map((stat, i) => (
            <div key={i} style={{ padding: '1.25rem', background: 'var(--surface-glass)', border: stat.highlight ? '1px solid rgba(201,178,124,0.3)' : '1px solid var(--border-subtle)', borderRadius: '1px', cursor: 'pointer' }}>
              <div style={{ color: stat.highlight ? 'var(--champagne)' : 'var(--text-muted)', marginBottom: '0.75rem' }}>{stat.icon}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Emails */}
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '1rem' }}>Requieren atención</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {mockEmails.map((item, i) => {
                const pStyle = getPriorityClass(item.priority.priority_label);
                return (
                  <motion.div key={item.email.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }}
                    onClick={() => setSelected(item.email.id === selected ? null : item.email.id)}
                    style={{ padding: '1rem 1.25rem', background: selected === item.email.id ? 'var(--surface-glass-hover)' : 'var(--surface-glass)', border: selected === item.email.id ? '1px solid rgba(201,178,124,0.3)' : '1px solid var(--border-subtle)', borderRadius: '1px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ ...pStyle, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.12em', padding: '2px 8px', borderRadius: '1px' }}>{item.priority.priority_label}</span>
                        {item.email.has_attachments && <Paperclip size={11} strokeWidth={1.5} color="var(--text-muted)" />}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email.subject}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.email.from_name} · {new Date(item.email.date).toLocaleDateString('es-ES')}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email.snippet}</div>
                    </div>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(201,178,124,0.1)', border: '1px solid rgba(201,178,124,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--champagne)' }}>{item.priority.priority_score}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Panel detalle */}
          {selectedEmail && (
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} style={{ padding: '1.5rem', background: 'var(--surface-glass)', border: '1px solid rgba(201,178,124,0.2)', borderRadius: '1px' }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--champagne)', opacity: 0.6, marginBottom: '1rem' }}>Detalle</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{selectedEmail.email.subject}</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>De: {selectedEmail.email.from_name} &lt;{selectedEmail.email.from_email}&gt;</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '2rem' }}>{selectedEmail.email.snippet}</p>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Respuesta sugerida</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7, padding: '1rem', background: 'rgba(201,178,124,0.05)', border: '1px solid rgba(201,178,124,0.1)', borderRadius: '1px' }}>
                  Estimado/a {selectedEmail.email.from_name.split(' ')[0]}, gracias por contactar con nosotros. Hemos recibido su mensaje y nos pondremos en contacto con usted a la mayor brevedad posible. Quedamos a su disposición para cualquier consulta adicional.
                </div>
                <button style={{ marginTop: '1rem', width: '100%', padding: '0.75rem', background: 'rgba(201,178,124,0.1)', border: '1px solid rgba(201,178,124,0.3)', borderRadius: '1px', color: 'var(--champagne)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.15em', cursor: 'pointer' }}>
                  Enviar respuesta
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
