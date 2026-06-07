import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { mockEmails, mockStats, mockAlerts } from '../services/mockData';
import { Mail, Inbox, Clock, Paperclip, AlertTriangle, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

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
  if (label === 'PRIORITARIO') return { bg: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' };
  if (label === 'SEGUIMIENTO') return { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' };
  return { bg: 'rgba(201,178,124,0.06)', color: C.gold, border: `1px solid ${C.border}` };
};

export default function BrokerDashboard() {
  const { user, logout } = useAuth();
  const [selected, setSelected] = useState(null);
  const firstName = user?.name?.split(' ')[0] || 'Agente';
  const hour = new Date().getHours();
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const selectedEmail = mockEmails.find(e => e.email.id === selected);

  return (
    <div style={{
      minHeight: '100vh',
      background: C.black,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      color: C.textPrimary,
    }}>

      {/* Navbar */}
      <header style={{
        borderBottom: `1px solid ${C.border}`,
        padding: '0 2rem',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(3,3,5,0.92)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: '1.3rem',
            color: C.gold,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}>
            Objetiva<span style={{ color: C.champagne }}>.</span>
          </div>
          <div style={{
            fontSize: '9px',
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: C.textMuted,
            borderLeft: `1px solid ${C.border}`,
            paddingLeft: '0.75rem',
          }}>
            Correduría de Seguros
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.78rem', color: C.textSecondary }}>{user?.name}</span>
          <button onClick={logout} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.textMuted, transition: 'color .2s',
          }}>
            <LogOut size={15} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2.5rem 2rem' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '2.5rem' }}>
          <div style={{
            fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.3em',
            color: C.gold, opacity: 0.6, marginBottom: '0.4rem',
          }}>{greeting}</div>
          <h1 style={{
            fontFamily: 'Cormorant Garamond, serif',
            fontSize: '2.4rem', fontWeight: 300,
            color: C.textPrimary, margin: 0, lineHeight: 1.05,
          }}>
            Tu bandeja, {firstName}
          </h1>
          <p style={{ fontSize: '0.75rem', color: C.textMuted, marginTop: '0.4rem' }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </motion.div>

        {/* Alertas */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
          {mockAlerts.map((alert, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1rem',
              background: alert.urgency === 'high' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
              border: alert.urgency === 'high' ? '1px solid rgba(239,68,68,0.18)' : '1px solid rgba(245,158,11,0.18)',
            }}>
              <AlertTriangle size={13} strokeWidth={1.5} color={alert.urgency === 'high' ? '#f87171' : '#fbbf24'} />
              <span style={{ fontSize: '0.76rem', color: alert.urgency === 'high' ? '#fca5a5' : '#fcd34d' }}>
                {alert.text}
              </span>
            </div>
          ))}
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1px', background: C.border,
            border: `1px solid ${C.border}`,
            marginBottom: '2.5rem',
          }}>
          {[
            { icon: <Inbox size={15} strokeWidth={1.5} />, label: 'Total correos', value: mockStats.total },
            { icon: <Mail size={15} strokeWidth={1.5} />, label: 'Prioritarios', value: mockStats.prioritarios, highlight: true },
            { icon: <Clock size={15} strokeWidth={1.5} />, label: 'Seguimiento', value: mockStats.seguimiento },
            { icon: <Paperclip size={15} strokeWidth={1.5} />, label: 'Con adjuntos', value: mockStats.with_attachments },
          ].map((stat, i) => (
            <div key={i} style={{
              padding: '1.5rem 1.25rem',
              background: C.black,
              cursor: 'pointer',
            }}>
              <div style={{ color: stat.highlight ? C.gold : C.textMuted, marginBottom: '0.75rem' }}>{stat.icon}</div>
              <div style={{ fontSize: '2rem', fontFamily: 'Cormorant Garamond, serif', fontWeight: 300, color: stat.highlight ? C.gold : C.textPrimary, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: '0.65rem', color: C.textMuted, marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.15em' }}>{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Emails */}
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: C.textMuted, marginBottom: '1rem' }}>
              Requieren atención
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: C.border }}>
              {mockEmails.map((item, i) => {
                const pStyle = getPriorityStyle(item.priority.priority_label);
                const isSelected = selected === item.email.id;
                return (
                  <motion.div
                    key={item.email.id}
                    initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i }}
                    onClick={() => setSelected(isSelected ? null : item.email.id)}
                    style={{
                      padding: '1rem 1.25rem',
                      background: isSelected ? C.surfaceHover : C.black,
                      cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem',
                      borderLeft: isSelected ? `2px solid ${C.gold}` : '2px solid transparent',
                      transition: 'background .2s, border-color .2s',
                    }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{
                          ...pStyle, fontSize: '8px', textTransform: 'uppercase',
                          letterSpacing: '0.12em', padding: '2px 8px',
                        }}>
                          {item.priority.priority_label}
                        </span>
                        {item.email.has_attachments && <Paperclip size={10} strokeWidth={1.5} color={C.textMuted} />}
                      </div>
                      <div style={{ fontSize: '0.84rem', color: C.textPrimary, fontWeight: 400, marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.email.subject}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: C.textMuted }}>
                        {item.email.from_name} · {new Date(item.email.date).toLocaleDateString('es-ES')}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: C.textSecondary, marginTop: '0.3rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.email.snippet}
                      </div>
                    </div>
                    <div style={{
                      width: '32px', height: '32px',
                      background: 'rgba(201,178,124,0.08)',
                      border: `1px solid ${C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: C.gold }}>{item.priority.priority_score}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Panel detalle */}
          {selectedEmail && (
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              style={{
                padding: '1.5rem',
                background: C.black,
                border: `1px solid ${C.borderGold}`,
              }}>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: C.gold, opacity: 0.6, marginBottom: '1rem' }}>
                Detalle
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 400, color: C.textPrimary, marginBottom: '0.5rem', fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 300 }}>
                {selectedEmail.email.subject}
              </h3>
              <div style={{ fontSize: '0.72rem', color: C.textMuted, marginBottom: '1.5rem' }}>
                De: {selectedEmail.email.from_name} &lt;{selectedEmail.email.from_email}&gt;
              </div>
              <p style={{ fontSize: '0.82rem', color: C.textSecondary, lineHeight: 1.75, marginBottom: '2rem' }}>
                {selectedEmail.email.snippet}
              </p>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '1.25rem' }}>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.2em', color: C.textMuted, marginBottom: '0.75rem' }}>
                  Respuesta sugerida
                </div>
                <div style={{
                  fontSize: '0.8rem', color: C.textSecondary, lineHeight: 1.75,
                  padding: '1rem',
                  background: 'rgba(201,178,124,0.03)',
                  border: `1px solid ${C.border}`,
                }}>
                  Estimado/a {selectedEmail.email.from_name.split(' ')[0]}, gracias por contactar con nosotros. Hemos recibido su mensaje y nos pondremos en contacto con usted a la mayor brevedad posible. Quedamos a su disposición para cualquier consulta adicional.
                </div>
                <button style={{
                  marginTop: '1rem', width: '100%', padding: '0.75rem',
                  background: 'transparent',
                  border: `1px solid ${C.borderGold}`,
                  color: C.gold,
                  fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.18em',
                  cursor: 'pointer', transition: 'all .2s',
                }}
                  onMouseEnter={e => e.target.style.background = 'rgba(201,178,124,0.06)'}
                  onMouseLeave={e => e.target.style.background = 'transparent'}
                >
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
