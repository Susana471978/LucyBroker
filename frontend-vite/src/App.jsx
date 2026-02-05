import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { getHealthStatus } from './services/api'

function App() {
  const [count, setCount] = useState(0)

  const [backend, setBackend] = useState('ERROR')
  const [mongo, setMongo] = useState('ERROR')
  const [gmail, setGmail] = useState('NOT CONFIGURED')
  const [redis, setRedis] = useState('NOT CONFIGURED')
  const [timestamp, setTimestamp] = useState('')

  useEffect(() => {
    let isMounted = true

    getHealthStatus()
      .then((data) => {
        if (!isMounted) return

        setBackend('OK')

        setMongo(
          data?.db?.status === 'ok' ? 'OK' : 'ERROR'
        )

        setGmail(
          data?.gmail?.status === 'ok'
            ? 'CONFIGURED'
            : 'NOT CONFIGURED'
        )

        setRedis(
          data?.redis?.status === 'ok'
            ? 'CONFIGURED'
            : 'NOT CONFIGURED'
        )

        setTimestamp(data?.timestamp ?? '')
      })
      .catch(() => {
        if (!isMounted) return

        setBackend('ERROR')
        setMongo('ERROR')
        setGmail('NOT CONFIGURED')
        setRedis('NOT CONFIGURED')
        setTimestamp('')
      })

    return () => {
      isMounted = false
    }
  }, [])

  function MainAppView() {
    const styles = {
      app: {
        background: '#0B0E14',
        color: '#E6E9EF',
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '240px 1fr',
      },
      sidebar: {
        padding: '24px 20px',
        borderRight: '1px solid #1C2130',
      },
      navItem: {
        padding: '10px 12px',
        borderRadius: '8px',
        color: '#C9D2E3',
        marginBottom: '8px',
        background: '#141824',
      },
      main: {
        display: 'grid',
        gridTemplateRows: '64px 1fr',
      },
      header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid #1C2130',
      },
      logo: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      },
      accent: {
        color: '#6CA4FF',
        fontWeight: 600,
      },
      dashboard: {
        padding: '24px',
        overflow: 'auto',
      },
      card: {
        background: '#141824',
        border: '1px solid #1C2130',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
      },
      cardTitle: {
        margin: '0 0 6px 0',
        fontSize: '16px',
        fontWeight: 600,
      },
      cardMeta: {
        margin: 0,
        color: '#9AA6BF',
        fontSize: '13px',
      },
      list: {
        display: 'grid',
        gap: '12px',
        marginTop: '16px',
      },
    }

    const emails = [
      {
        subject: 'Revisión contrato Q1',
        sender: 'legal@empresa.com',
        preview: 'Adjunto versión final para aprobación.',
        time: 'Hace 5 min',
        priority: 'Alta',
      },
      {
        subject: 'Informe semanal de soporte',
        sender: 'soporte@empresa.com',
        preview: 'Resumen de tickets críticos y SLA.',
        time: 'Hace 20 min',
        priority: 'Media',
      },
      {
        subject: 'Solicitud acceso cliente ACME',
        sender: 'ventas@empresa.com',
        preview: 'Necesitamos habilitar credenciales hoy.',
        time: 'Hace 45 min',
        priority: 'Alta',
      },
      {
        subject: 'Campaña onboarding febrero',
        sender: 'marketing@empresa.com',
        preview: 'Ajustes en la secuencia de emails.',
        time: 'Hace 1 h',
        priority: 'Baja',
      },
    ]

    return (
      <div style={styles.app}>
        <aside style={styles.sidebar}>
          <div style={{ marginBottom: '20px', fontWeight: 600 }}>
            Email Control
          </div>
          <div style={styles.navItem}>Inbox</div>
          <div style={styles.navItem}>Prioridad</div>
          <div style={styles.navItem}>Estadísticas</div>
          <div style={styles.navItem}>Configuración</div>
        </aside>

        <div style={styles.main}>
          <header style={styles.header}>
            <div style={styles.logo}>
              <span style={styles.accent}>●</span>
              <span>Email Control System</span>
            </div>
            <div style={{ display: 'flex', gap: '16px', color: '#9AA6BF' }}>
              <span>Estado: OK</span>
              <span>Usuario: Admin</span>
            </div>
          </header>

          <section style={styles.dashboard}>
            <h2 style={{ margin: 0 }}>Bandeja priorizada</h2>
            <p style={{ color: '#9AA6BF', marginTop: '6px' }}>
              Emails recientes con foco en prioridad y SLA.
            </p>

            <div style={styles.list}>
              {emails.map((email) => (
                <div key={`${email.subject}-${email.time}`} style={styles.card}>
                  <h3 style={styles.cardTitle}>{email.subject}</h3>
                  <p style={styles.cardMeta}>{email.sender} • {email.time}</p>
                  <p style={{ margin: '10px 0', color: '#C9D2E3' }}>
                    {email.preview}
                  </p>
                  <p style={styles.cardMeta}>Prioridad: {email.priority}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    )
  }

  function StatusView() {
    return (
      <div className="card">
        <button onClick={() => setCount((c) => c + 1)}>
          count is {count}
        </button>

        <p>Backend: {backend}</p>
        <p>Mongo: {mongo}</p>
        <p>Gmail: {gmail}</p>
        <p>Redis: {redis}</p>
        <p>Timestamp: {timestamp}</p>

        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
    )
  }

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank" rel="noreferrer">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>

        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>

      <h1>Vite + React</h1>

      {backend === 'OK' ? <MainAppView /> : <StatusView />}

      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
