#!/bin/bash
# ============================================================
#  LucyBroker — Migración CRA → Vite
#  Ejecutar desde la raíz del repo: bash migrar_a_vite.sh
# ============================================================

set -e  # Para si hay algún error

REPO_ROOT="$(pwd)"
FRONTEND="$REPO_ROOT/frontend"

echo ""
echo "🔍 Comprobando que estás en la raíz del repo..."
if [ ! -d "$FRONTEND" ]; then
  echo "❌ No se encuentra la carpeta 'frontend'. Asegúrate de ejecutar este script desde la raíz del repo LucyBroker."
  exit 1
fi
echo "✅ Carpeta frontend encontrada."
echo ""

# ─── 1. ELIMINAR frontend-vite ───────────────────────────────
echo "🗑️  Eliminando frontend-vite..."
rm -rf "$REPO_ROOT/frontend-vite"
echo "✅ frontend-vite eliminado."

# ─── 2. ELIMINAR archivos CRA obsoletos ──────────────────────
echo "🗑️  Eliminando archivos CRA obsoletos..."
rm -f "$FRONTEND/craco.config.js"
rm -f "$FRONTEND/jsconfig.json"
rm -f "$FRONTEND/package.json.bak-proxy"
echo "✅ Archivos CRA eliminados."

# ─── 3. CREAR vite.config.js ─────────────────────────────────
echo "📝 Creando vite.config.js..."
cat > "$FRONTEND/vite.config.js" << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'build',
    sourcemap: false,
  },
})
EOF
echo "✅ vite.config.js creado."

# ─── 4. MOVER Y ADAPTAR index.html ───────────────────────────
echo "📝 Creando index.html en la raíz del frontend..."
cat > "$FRONTEND/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <!-- PWA -->
    <meta name="theme-color" content="#0B0E14" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Lucy" />

    <!-- SEO / descripción -->
    <meta name="description" content="Lucy · Tu secretaria virtual inteligente" />
    <meta name="application-name" content="Lucy" />

    <!-- Manifest -->
    <link rel="manifest" href="/manifest.json" />

    <!-- Favicon SVG -->
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

    <!-- Apple touch icons -->
    <link rel="apple-touch-icon" href="/icons/icon-192.png" />
    <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
    <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />

    <!-- Fuentes -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

    <title>Objetiva · Correduría de Seguros</title>
</head>

<body>
    <noscript>
        Necesitas habilitar JavaScript para usar esta aplicación.
    </noscript>
    <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>

</html>
EOF
echo "✅ index.html creado."

# ─── 5. CREAR src/main.jsx ───────────────────────────────────
echo "📝 Creando src/main.jsx..."
cat > "$FRONTEND/src/main.jsx" << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/index.css'
import App from '@/App'
import { registerSW } from './registerSW'

registerSW()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
EOF
echo "✅ src/main.jsx creado."

# ─── 6. ACTUALIZAR package.json ──────────────────────────────
echo "📝 Actualizando package.json..."
cat > "$FRONTEND/package.json" << 'EOF'
{
  "name": "lucybroker-frontend",
  "version": "0.2.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext .js,.jsx"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.0.1",
    "@radix-ui/react-accordion": "^1.2.8",
    "@radix-ui/react-alert-dialog": "^1.1.11",
    "@radix-ui/react-aspect-ratio": "^1.1.4",
    "@radix-ui/react-avatar": "^1.1.7",
    "@radix-ui/react-checkbox": "^1.2.3",
    "@radix-ui/react-collapsible": "^1.1.8",
    "@radix-ui/react-context-menu": "^2.2.12",
    "@radix-ui/react-dialog": "^1.1.11",
    "@radix-ui/react-dropdown-menu": "^2.1.12",
    "@radix-ui/react-hover-card": "^1.1.11",
    "@radix-ui/react-label": "^2.1.4",
    "@radix-ui/react-menubar": "^1.1.12",
    "@radix-ui/react-navigation-menu": "^1.2.10",
    "@radix-ui/react-popover": "^1.1.11",
    "@radix-ui/react-progress": "^1.1.4",
    "@radix-ui/react-radio-group": "^1.3.4",
    "@radix-ui/react-scroll-area": "^1.2.6",
    "@radix-ui/react-select": "^2.2.2",
    "@radix-ui/react-separator": "^1.1.4",
    "@radix-ui/react-slider": "^1.3.2",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-switch": "^1.2.2",
    "@radix-ui/react-tabs": "^1.1.9",
    "@radix-ui/react-toast": "^1.2.11",
    "@radix-ui/react-toggle": "^1.1.6",
    "@radix-ui/react-toggle-group": "^1.1.7",
    "@radix-ui/react-tooltip": "^1.2.4",
    "axios": "^1.8.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "date-fns": "^4.1.0",
    "dompurify": "^3.3.3",
    "embla-carousel-react": "^8.6.0",
    "framer-motion": "^12.31.0",
    "input-otp": "^1.4.2",
    "lucide-react": "^0.507.0",
    "next-themes": "^0.4.6",
    "react": "^18.3.1",
    "react-day-picker": "8.10.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.56.2",
    "react-resizable-panels": "^3.0.1",
    "react-router-dom": "^6.22.3",
    "recharts": "^3.6.0",
    "sonner": "^2.0.3",
    "tailwind-merge": "^3.2.0",
    "tailwindcss-animate": "^1.0.7",
    "three": "^0.183.1",
    "vaul": "^1.1.2",
    "zod": "^3.24.4"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.23.0",
    "eslint-plugin-react": "^7.37.4",
    "eslint-plugin-react-hooks": "^5.2.0",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "vite": "^5.4.11"
  }
}
EOF
echo "✅ package.json actualizado."

# ─── 7. ACTUALIZAR tailwind.config.js ────────────────────────
echo "📝 Actualizando tailwind.config.js..."
cat > "$FRONTEND/tailwind.config.js" << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.html"
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        }
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: [],
}
EOF
echo "✅ tailwind.config.js actualizado."

# ─── 8. ACTUALIZAR postcss.config.js ─────────────────────────
echo "📝 Actualizando postcss.config.js..."
cat > "$FRONTEND/postcss.config.js" << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF
echo "✅ postcss.config.js actualizado."

# ─── 9. ACTUALIZAR vercel.json ────────────────────────────────
echo "📝 Actualizando vercel.json..."
cat > "$FRONTEND/vercel.json" << 'EOF'
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "framework": "vite"
}
EOF
echo "✅ vercel.json actualizado."

# ─── 10. CREAR .env.example ──────────────────────────────────
echo "📝 Creando .env.example..."
cat > "$FRONTEND/.env.example" << 'EOF'
# Variables de entorno para el frontend (Vite)
# Copia este archivo como .env.local y rellena los valores

# URL del backend (por defecto apunta a desarrollo local)
VITE_BACKEND_URL=http://127.0.0.1:8000
EOF
echo "✅ .env.example creado."

# ─── 11. MIGRAR process.env → import.meta.env ────────────────
echo "📝 Migrando variables de entorno en el código..."
# MessagesPage.js
sed -i 's|process\.env\.REACT_APP_BACKEND_URL|import.meta.env.VITE_BACKEND_URL|g' \
  "$FRONTEND/src/pages/MessagesPage.js"
# index.js
sed -i "s|process\.env\.NODE_ENV === 'production'|import.meta.env.PROD|g" \
  "$FRONTEND/src/index.js"
# Eliminar el require() duplicado de registerSW en index.js (es CRA legacy)
sed -i "/const { registerSW } = require('.\/registerSW');/d" \
  "$FRONTEND/src/index.js"
echo "✅ Variables de entorno migradas."

# ─── 12. ACTUALIZAR run_dev.sh ───────────────────────────────
echo "📝 Actualizando scripts/run_dev.sh..."
cat > "$REPO_ROOT/scripts/run_dev.sh" << 'EOF'
#!/bin/bash
# Script de desarrollo — arranca backend y frontend en paralelo

export ENV=development

echo "🚀 Arrancando backend (FastAPI)..."
VENV_PYTHON="/home/susana/repos/EmailSystem-control/.venv/bin/python"
if [ -x "$VENV_PYTHON" ]; then
    "$VENV_PYTHON" -m uvicorn backend.server:app --host 0.0.0.0 --port 8000 --reload &
else
    uvicorn backend.server:app --host 0.0.0.0 --port 8000 --reload &
fi

BACKEND_PID=$!
echo "✅ Backend PID: $BACKEND_PID"

echo "🚀 Arrancando frontend (Vite)..."
cd frontend && npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend PID: $FRONTEND_PID"

echo ""
echo "Backend  → http://localhost:8000"
echo "Frontend → http://localhost:3000"
echo ""
echo "Ctrl+C para detener ambos procesos"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
EOF
chmod +x "$REPO_ROOT/scripts/run_dev.sh"
echo "✅ run_dev.sh actualizado."

# ─── 13. GIT COMMIT ──────────────────────────────────────────
echo ""
echo "📦 Haciendo commit..."
cd "$REPO_ROOT"
git add -A
git commit -m "feat: migrar frontend de CRA a Vite

- Eliminar frontend-vite (esqueleto vacío sin valor)
- Añadir vite.config.js con alias @ y proxy /api → backend:8000
- Mover index.html a la raíz (convención Vite)
- Crear src/main.jsx como entry point limpio
- Migrar process.env → import.meta.env (REACT_APP_ → VITE_)
- Convertir tailwind.config.js y postcss.config.js a ESM
- Actualizar package.json: scripts dev/build/preview, quitar CRA/craco
- Actualizar vercel.json: framework vite
- Actualizar run_dev.sh: arranca backend + frontend en paralelo
- Añadir .env.example con variables VITE_*
- Eliminar craco.config.js, jsconfig.json, package.json.bak-proxy"

echo ""
echo "🚀 Haciendo push..."
git push

echo ""
echo "=============================================="
echo "  ✅ Migración completada y subida a GitHub"
echo "=============================================="
echo ""
echo "Para arrancar en local:"
echo "  cd frontend && npm install && npm run dev"
echo ""
echo "O arrancar todo junto:"
echo "  bash scripts/run_dev.sh"
echo ""
