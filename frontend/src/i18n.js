// Internationalization context
const translations = {
  es: {
    // Auth
    login: "Iniciar sesión",
    register: "Registrarse",
    email: "Correo electrónico",
    password: "Contraseña",
    name: "Nombre",
    logout: "Cerrar sesión",
    noAccount: "¿No tienes cuenta?",
    hasAccount: "¿Ya tienes cuenta?",
    invalidCredentials: "Credenciales inválidas",
    
    // Navigation
    overview: "Resumen",
    messages: "Mensajes",
    settings: "Configuración",
    
    // Overview
    welcomeTitle: "Tu correo, bajo control",
    welcomeSubtitle: "Transforma tu bandeja en un panel de decisiones. Reduce el ruido, prioriza acciones.",
    silenceMode: "Nada requiere acción inmediata",
    silenceModeDesc: "Todos tus correos están al día. Disfruta el momento.",
    priorityItems: "Requieren atención",
    
    // Messages
    allEmails: "Todos",
    priority: "Prioritarios",
    followUp: "Seguimiento",
    info: "Informativos",
    attachments: "Con adjuntos",
    showFullMessage: "Ver mensaje completo",
    hideFullMessage: "Ocultar mensaje",
    downloadAttachment: "Descargar",
    reply: "Responder",
    
    // AI Card
    aiHelp: "¿Te ayudo con la respuesta?",
    aiPlaceholder: "Escribe qué necesitas...",
    aiSummarize: "Resumir",
    aiDraft: "Redactar respuesta",
    
    // Priority labels
    prioritario: "PRIORITARIO",
    seguimiento: "SEGUIMIENTO",
    informativo: "INFO",
    
    // General
    loading: "Cargando...",
    error: "Error",
    noResults: "Sin resultados",
    from: "De",
    subject: "Asunto",
    date: "Fecha",
    why: "¿Por qué es prioritario?",
    summary: "Resumen",
    draftOptions: "Opciones de respuesta",
    useDraft: "Usar este borrador",
    generating: "Generando...",
  },
  en: {
    // Auth
    login: "Sign in",
    register: "Sign up",
    email: "Email",
    password: "Password",
    name: "Name",
    logout: "Sign out",
    noAccount: "Don't have an account?",
    hasAccount: "Already have an account?",
    invalidCredentials: "Invalid credentials",
    
    // Navigation
    overview: "Overview",
    messages: "Messages",
    settings: "Settings",
    
    // Overview
    welcomeTitle: "Your email, under control",
    welcomeSubtitle: "Transform your inbox into a decision panel. Reduce noise, prioritize actions.",
    silenceMode: "Nothing requires immediate action",
    silenceModeDesc: "All your emails are up to date. Enjoy the moment.",
    priorityItems: "Need attention",
    
    // Messages
    allEmails: "All",
    priority: "Priority",
    followUp: "Follow up",
    info: "Info",
    attachments: "With attachments",
    showFullMessage: "Show full message",
    hideFullMessage: "Hide message",
    downloadAttachment: "Download",
    reply: "Reply",
    
    // AI Card
    aiHelp: "Need help with your reply?",
    aiPlaceholder: "Type what you need...",
    aiSummarize: "Summarize",
    aiDraft: "Draft reply",
    
    // Priority labels
    prioritario: "PRIORITY",
    seguimiento: "FOLLOW UP",
    informativo: "INFO",
    
    // General
    loading: "Loading...",
    error: "Error",
    noResults: "No results",
    from: "From",
    subject: "Subject",
    date: "Date",
    why: "Why is it priority?",
    summary: "Summary",
    draftOptions: "Reply options",
    useDraft: "Use this draft",
    generating: "Generating...",
  }
};

export const getTranslation = (lang, key) => {
  return translations[lang]?.[key] || translations.es[key] || key;
};

export const t = getTranslation;

export default translations;
