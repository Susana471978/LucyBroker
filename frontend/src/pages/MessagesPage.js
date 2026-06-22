import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';

import {
  Paperclip, Send, Sparkles, Loader2,
  Clock, AlertCircle, Info, ChevronRight,
  Mail, X, FileText, Mic, MicOff, Eye, EyeOff, Building2
} from 'lucide-react';

import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import Layout from '../components/Layout';

import { fetchEmails as fetchEmailsService, fetchMessageDetail } from '../services/mailService';
import { summarizeEmail, generateDraft } from '../services/aiService';
import apiClient from '../services/apiClient';
import { useVoice } from '../voice/VoiceProvider';

/* ─── TTS ejecutivo ───────────────────────────────────── */
const API_URL = `${import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'}/api`;

let _currentAudio = null;

const speakExecutive = async (text) => {
  if (!text) return;
  try {
    // Detener cualquier audio previo
    if (_currentAudio) {
      _currentAudio.pause();
      _currentAudio = null;
    }
    window.speechSynthesis.cancel();

    const token = localStorage.getItem('auth_token');
    const res = await fetch(`${API_URL}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      _currentAudio = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        _currentAudio = null;
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        _currentAudio = null;
      };
      await audio.play();
    } else {
      console.error('TTS error: server returned', res.status);
    }
  } catch (err) {
    console.error('TTS error:', err);
  }
};

/* ─── Priority badge ──────────────────────────────────── */
const PriorityDot = ({ label }) => {
  if (label === 'PRIORITARIO') return (
    <span className="w-1.5 h-1.5 rounded-full bg-[var(--champagne)] shadow-[0_0_6px_rgba(201,178,124,0.7)] flex-shrink-0 mt-1.5" />
  );
  if (label === 'SEGUIMIENTO') return (
    <span className="w-1.5 h-1.5 rounded-full bg-[rgba(201,178,124,0.35)] flex-shrink-0 mt-1.5" />
  );
  return (
    <span className="w-1.5 h-1.5 rounded-full bg-[rgba(255,255,255,0.1)] flex-shrink-0 mt-1.5" />
  );
};

const PriorityChip = ({ label }) => {
  if (label === 'PRIORITARIO') return (
    <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full
      bg-[rgba(201,178,124,0.1)] text-[var(--champagne)] border border-[rgba(201,178,124,0.25)]">
      Prioritario
    </span>
  );
  if (label === 'SEGUIMIENTO') return (
    <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full
      bg-[rgba(255,255,255,0.05)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]">
      Seguimiento
    </span>
  );
  return null;
};

const VipChip = ({ companyName }) => {
  if (!companyName) return null;
  return (
    <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full inline-flex items-center gap-1
      bg-[var(--champagne-faint)] text-[var(--champagne)] border border-[rgba(201,178,124,0.3)]
      shadow-[0_0_8px_rgba(201,178,124,0.15)]">
      <Building2 className="w-2.5 h-2.5" />
      {companyName}
    </span>
  );
};

/* ─── Filter pill ─────────────────────────────────────── */
const FilterPill = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    className={`px-3 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs uppercase tracking-[0.08em] font-medium
      transition-all duration-200
      ${active
        ? 'bg-[var(--champagne-faint)] text-[var(--champagne)] border border-[rgba(201,178,124,0.3)]'
        : 'text-[var(--text-tertiary)] border border-transparent hover:text-[var(--text-secondary)] hover:border-[rgba(255,255,255,0.1)]'
      }`}
  >
    {label}
  </button>
);

/* ─── Attachment row ──────────────────────────────────── */
const AttachmentRow = ({ attachment, emailId, onSummary }) => {
  const [loading, setLoading] = useState(false);

  const handleSummarize = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post('/ai/summarize-attachment', {
        email_id: emailId,
        attachment_id: attachment.id,
        filename: attachment.name,
        mime_type: attachment.mime_type,
      });
      const summary = res.data?.data?.summary || res.data?.summary || '';
      if (summary) onSummary(attachment.name, summary);
    } catch (err) {
      console.error('Attachment summarize error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isSummarizable = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv',
  ].includes(attachment.mime_type) ||
    /\.(pdf|doc|docx|txt|csv)$/i.test(attachment.name);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl
      border border-[var(--border-subtle)]"
      style={{ background: 'linear-gradient(180deg, rgba(7,12,24,0.80) 0%, rgba(4,8,18,0.75) 100%)' }}>
      <FileText className="w-4 h-4 text-[rgba(201,178,124,0.5)] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--text-primary)] truncate">{attachment.name}</p>
        {attachment.size > 0 && (
          <p className="text-[10px] text-[rgba(255,255,255,0.2)]">{formatSize(attachment.size)}</p>
        )}
      </div>
      {isSummarizable && (
        <button
          onClick={handleSummarize}
          disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-[0.08em]
            bg-[var(--glow-champagne)] text-[var(--champagne-dim)]
            border border-[var(--glow-champagne-md)]
            hover:bg-[rgba(201,178,124,0.14)] hover:text-[var(--champagne)]
            transition-all duration-200 disabled:opacity-40 flex-shrink-0"
        >
          {loading
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Sparkles className="w-3 h-3" />}
          {loading ? 'Analizando…' : 'Resumir'}
        </button>
      )}
    </div>
  );
};

/* ─── Sanitize HTML — protección XSS ─────────────────── */
const sanitizeHTML = (html) => {
  if (!html) return '<div style="color:rgba(255,255,255,0.2)">(Sin contenido)</div>';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'table', 'thead',
      'tbody', 'tr', 'td', 'th', 'img', 'blockquote', 'pre', 'code', 'hr',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'width', 'height',
      'style', 'class', 'colspan', 'rowspan',
    ],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  });
};

/* ─── Main ────────────────────────────────────────────── */
export default function MessagesPage() {
  const { language } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [filter, setFilter] = useState(searchParams.get('filter') || 'all');

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftInstructions, setDraftInstructions] = useState('');
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [attachmentSummaries, setAttachmentSummaries] = useState([]);
  const { startListening, voiceState, STATES, setWakeWordEnabled } = useVoice();
  const [voiceListening, setVoiceListening] = useState(false);
  const [fullBody, setFullBody] = useState(null);
  const [bodyLoading, setBodyLoading] = useState(false);

  /* ── fetch (always light mode — no body) ── */
  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      // Always fetch all emails (light mode); filtering is client-side
      const response = await fetchEmailsService({ max_results: 50 });
      let normalized = [];
      if (Array.isArray(response)) normalized = response;
      else if (Array.isArray(response?.data)) normalized = response.data;
      else if (Array.isArray(response?.emails)) normalized = response.emails;
      setEmails(normalized);
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  /* ── Client-side filtering ── */
  const filteredEmails = useMemo(() => {
    if (filter === 'all') return emails;
    if (filter === 'attachments') {
      return emails.filter(item => item?.email?.has_attachments);
    }
    if (filter === 'vip') {
      return emails.filter(item => item?.email?.is_vip);
    }
    // Filter by priority label (PRIORITARIO, SEGUIMIENTO)
    return emails.filter(item => item?.priority?.priority_label === filter);
  }, [emails, filter]);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setSearchParams({ filter: newFilter });
  };

  const handleSelectEmail = (email) => {
    setSelectedEmail(email);
    setSummary(null);
    setDrafts([]);
    setDraftInstructions('');
    setShowReplyBox(false);
    setAttachmentSummaries([]);
    setFullBody(null);
    setBodyLoading(false);
    // Detener cualquier audio al cambiar de email
    if (_currentAudio) {
      _currentAudio.pause();
      _currentAudio = null;
    }
    try { window.speechSynthesis.cancel(); } catch (_) { }
  };

  /* ── Load full body on demand ── */
  const handleLoadFullBody = async () => {
    if (!selectedEmail?.email?.id || bodyLoading) return;
    setBodyLoading(true);
    try {
      const detail = await fetchMessageDetail(selectedEmail.email.id);
      setFullBody(detail.body || detail.body_text || '');
    } catch (error) {
      console.error('Load body error:', error);
    } finally {
      setBodyLoading(false);
    }
  };

  /* ── AI ── */
  const handleSummarize = async () => {
    if (!selectedEmail?.email?.id) return;
    setSummaryLoading(true);
    try {
      const result = await summarizeEmail(selectedEmail.email.id);
      const text = typeof result === 'string' ? result : '';
      setSummary(text || null);
      if (text) speakExecutive('Resumen del correo. ' + text);
    } catch (error) {
      console.error('Summarize error:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleDraftReply = async () => {
    if (!selectedEmail?.email?.id || !draftInstructions.trim()) return;
    setDraftsLoading(true);
    try {
      const draftsData = await generateDraft(selectedEmail.email.id, draftInstructions);
      setDrafts(Array.isArray(draftsData) ? draftsData : []);
    } catch (error) {
      console.error('Draft error:', error);
    } finally {
      setDraftsLoading(false);
    }
  };

  const handleVoiceDictate = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    setWakeWordEnabled(false);
    setTimeout(() => {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      setVoiceListening(true);
      recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        setDraftInstructions(prev => (prev ? prev + ' ' + text : text));
        setVoiceListening(false);
        setWakeWordEnabled(true);
      };
      recognition.onerror = () => { setVoiceListening(false); setWakeWordEnabled(true); };
      recognition.onend = () => { setVoiceListening(false); setWakeWordEnabled(true); };
      recognition.start();
    }, 400);
  };

  const handleAttachmentSummary = (filename, summaryText) => {
    setAttachmentSummaries(prev => {
      const exists = prev.findIndex(s => s.filename === filename);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = { filename, summary: summaryText };
        return updated;
      }
      return [...prev, { filename, summary: summaryText }];
    });
    speakExecutive(`Resumen de ${filename}. ${summaryText}`);
  };

  const renderEmailBody = () => {
    if (fullBody) {
      const htmlContent = fullBody.includes('<') ? fullBody : fullBody.replace(/\n/g, '<br/>');
      return sanitizeHTML(htmlContent);
    }
    // Light mode: snippet is plain text, short (~160 chars from Gmail)
    const snippet = selectedEmail?.email?.snippet || '';
    if (!snippet) return '<div style="color:rgba(255,255,255,0.2)">(Sin contenido)</div>';
    // Escape HTML entities in snippet (it's plain text from Gmail metadata)
    const escaped = snippet
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<div>${escaped}</div>`;
  };

  const currentAttachments = selectedEmail?.email?.attachments || [];

  /* ── UI ── */
  return (
    <Layout>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">
        {/* ══ LEFT — Lista ══════════════════════════════════ */}
        <div className="w-full md:w-[38%] flex flex-col border-r border-[var(--border-subtle)]"
          style={{ background: 'linear-gradient(180deg, rgba(7,12,24,0.92) 0%, rgba(4,8,18,0.88) 100%)' }}>
          <div className="px-3 sm:px-5 pt-4 pb-2">
            <button onClick={() => window.history.back()}
              className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors duration-200 mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Volver
            </button>
            <h1 className="font-light tracking-tight text-[var(--text-primary)]"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem' }}>
              Correo
            </h1>
          </div>
          <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-[var(--border-subtle)] flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <FilterPill active={filter === 'all'} onClick={() => handleFilterChange('all')} label="Todos" />
            <FilterPill active={filter === 'PRIORITARIO'} onClick={() => handleFilterChange('PRIORITARIO')} label="Prioritarios" />
            <FilterPill active={filter === 'SEGUIMIENTO'} onClick={() => handleFilterChange('SEGUIMIENTO')} label="Seguimiento" />
            <FilterPill active={filter === 'vip'} onClick={() => handleFilterChange('vip')} label="VIP" />
            <FilterPill active={filter === 'attachments'} onClick={() => handleFilterChange('attachments')} label="Adjuntos" />
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center
                  bg-[var(--glow-champagne)] border border-[var(--glow-champagne-md)]">
                  <svg width="14" height="14" viewBox="0 0 22 22" fill="none">
                    <path d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z"
                      fill="rgba(201,178,124,0.5)" className="animate-pulse" />
                  </svg>
                </div>
                <p className="text-xs text-[rgba(255,255,255,0.2)] uppercase tracking-[0.1em]">Cargando correos…</p>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Mail className="w-8 h-8 text-[rgba(255,255,255,0.1)]" />
                <p className="text-sm text-[rgba(255,255,255,0.2)]">Sin correos</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {filteredEmails.map((item, idx) => {
                  const email = item?.email;
                  const priority = item?.priority?.priority_label;
                  if (!email?.id) return null;
                  const isSelected = selectedEmail?.email?.id === email.id;

                  return (
                    <motion.button
                      key={email.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03, duration: 0.3 }}
                      onClick={() => handleSelectEmail(item)}
                      className={`w-full px-5 py-4 text-left transition-all duration-200 group relative
                        ${isSelected
                          ? 'bg-[rgba(201,178,124,0.06)] border-r-2 border-r-[rgba(201,178,124,0.4)]'
                          : 'hover:bg-[var(--surface-glass-hover)]'
                        }`}
                    >
                      {isSelected && (
                        <div className="absolute inset-y-0 left-0 w-px bg-[rgba(201,178,124,0.5)]" />
                      )}
                      <div className="flex gap-3">
                        <PriorityDot label={priority} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className={`text-sm leading-snug truncate
                              ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)] group-hover:text-[var(--text-primary)]'}`}>
                              {email.subject || '(Sin asunto)'}
                            </p>
                            {email.has_attachments && (
                              <Paperclip className="w-3 h-3 text-[rgba(255,255,255,0.2)] flex-shrink-0 mt-0.5" />
                            )}
                          </div>
                          <p className="text-xs text-[var(--text-tertiary)] truncate leading-relaxed">
                            {email.snippet || ''}
                          </p>
                          {(priority && priority !== 'INFORMATIVO' || email.is_vip) && (
                            <div className="mt-2 flex items-center gap-1.5">
                              {email.is_vip && <VipChip companyName={email.vip_company_name} />}
                              {priority && priority !== 'INFORMATIVO' && !email.is_vip && <PriorityChip label={priority} />}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* ══ RIGHT — Detalle ═══════════════════════════════ */}
        <div className="hidden md:flex md:flex-1 flex-col overflow-hidden"
          style={{ background: 'linear-gradient(180deg, rgba(5,10,20,0.94) 0%, rgba(3,6,12,0.97) 100%)' }}>

          <AnimatePresence mode="wait">
            {selectedEmail?.email ? (
              <motion.div
                key={selectedEmail.email.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col h-full"
              >
                {/* Header */}
                <div className="px-8 py-5 border-b border-[var(--border-subtle)] flex-shrink-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-light text-[var(--text-primary)] leading-snug mb-2 tracking-tight"
                        style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                        {selectedEmail.email.subject || '(Sin asunto)'}
                      </h2>
                      <div className="flex items-center gap-3">
                        {selectedEmail.email.is_vip && (
                          <VipChip companyName={selectedEmail.email.vip_company_name} />
                        )}
                        {selectedEmail.priority?.priority_label && (
                          <PriorityChip label={selectedEmail.priority.priority_label} />
                        )}
                        {selectedEmail.email.has_attachments && (
                          <span className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.08em]">
                            <Paperclip className="w-3 h-3" /> Adjunto
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={handleSummarize}
                        disabled={summaryLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs
                          bg-[var(--glow-champagne)] text-[rgba(201,178,124,0.7)]
                          border border-[var(--border-champagne)]
                          hover:bg-[rgba(201,178,124,0.14)] hover:text-[var(--champagne)]
                          transition-all duration-200 disabled:opacity-40"
                      >
                        {summaryLoading
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Sparkles className="w-3.5 h-3.5" />}
                        Resumir
                      </button>

                      <button
                        onClick={() => setShowReplyBox(prev => { const next = !prev; setWakeWordEnabled(!next); return next; })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs
                          border transition-all duration-200
                          ${showReplyBox
                            ? 'bg-[var(--border-subtle)] text-[var(--text-secondary)] border-[rgba(255,255,255,0.12)]'
                            : 'bg-[rgba(255,255,255,0.04)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[rgba(255,255,255,0.07)] hover:text-[var(--text-secondary)]'
                          }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        Responder
                      </button>
                    </div>
                  </div>
                </div>

                <ScrollArea className="flex-1 px-8 py-6">
                  <div className="space-y-5 max-w-2xl">

                    {/* Resumen email */}
                    <AnimatePresence>
                      {summary && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          className="relative rounded-2xl p-5 overflow-hidden
                            bg-[rgba(201,178,124,0.04)] border border-[var(--glow-champagne-md)]"
                        >
                          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.4)] to-transparent" />
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 rounded-lg flex items-center justify-center bg-[rgba(201,178,124,0.1)]">
                              <svg width="10" height="10" viewBox="0 0 22 22" fill="none">
                                <path d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z" fill="#C9B27C" />
                              </svg>
                            </div>
                            <p className="text-xs text-[var(--champagne)] uppercase tracking-[0.1em]">Lucy — Resumen</p>
                            <button onClick={() => setSummary(null)}
                              className="ml-auto text-[rgba(255,255,255,0.2)] hover:text-[var(--text-secondary)] transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-sm text-[var(--text-primary)] leading-relaxed"
                            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem' }}>
                            {summary}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Resúmenes de adjuntos */}
                    <AnimatePresence>
                      {attachmentSummaries.map((as) => (
                        <motion.div
                          key={as.filename}
                          initial={{ opacity: 0, y: -8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          className="relative rounded-2xl p-5 overflow-hidden
                            bg-[var(--surface-glass)] border border-[var(--champagne-faint)]"
                        >
                          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(201,178,124,0.25)] to-transparent" />
                          <div className="flex items-center gap-2 mb-3">
                            <FileText className="w-4 h-4 text-[rgba(201,178,124,0.5)]" />
                            <p className="text-xs text-[rgba(201,178,124,0.7)] uppercase tracking-[0.1em] truncate flex-1">
                              {as.filename}
                            </p>
                            <button
                              onClick={() => setAttachmentSummaries(prev => prev.filter(s => s.filename !== as.filename))}
                              className="text-[rgba(255,255,255,0.2)] hover:text-[var(--text-secondary)] transition-colors flex-shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-sm text-[var(--text-primary)] leading-relaxed"
                            style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem' }}>
                            {as.summary}
                          </p>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Lista adjuntos */}
                    <AnimatePresence>
                      {currentAttachments.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                          <p className="text-[10px] text-[rgba(255,255,255,0.2)] uppercase tracking-[0.1em] mb-2">Adjuntos</p>
                          {currentAttachments.map((att) => (
                            <AttachmentRow
                              key={att.id}
                              attachment={att}
                              emailId={selectedEmail.email.id}
                              onSummary={handleAttachmentSummary}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Cuerpo email */}
                    <div className="rounded-2xl p-6 border border-[var(--border-subtle)]"
                      style={{
                        background: 'linear-gradient(180deg, rgba(7,12,24,0.92) 0%, rgba(4,8,18,0.88) 100%)',
                        boxShadow: '0 0 0 1px rgba(90,170,255,0.06) inset, 0 0 10px rgba(54,126,255,0.06)'
                      }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] text-[rgba(201,178,124,0.4)] uppercase tracking-[0.1em]">
                          {fullBody ? 'Mensaje completo' : 'Vista previa'}
                        </p>
                        {fullBody && (
                          <button
                            onClick={() => setFullBody(null)}
                            className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                          >
                            <EyeOff className="w-3 h-3" />
                            Cerrar
                          </button>
                        )}
                      </div>
                      <div
                        className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap"
                        style={{ fontFamily: "var(--font-family-base)" }}
                        dangerouslySetInnerHTML={{ __html: renderEmailBody() }}
                      />
                      {!fullBody && !bodyLoading && (
                        <button onClick={handleLoadFullBody}
                          className="mt-4 flex items-center gap-1.5 text-xs text-[rgba(201,178,124,0.5)] hover:text-[var(--champagne)] transition-colors">
                          <Eye className="w-3 h-3" />
                          Ver mensaje completo
                        </button>
                      )}
                      {bodyLoading && (
                        <div className="mt-4 flex items-center gap-2 text-xs text-[rgba(255,255,255,0.2)]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Cargando mensaje…
                        </div>
                      )}
                    </div>
                    {/* Reply box */}
                    <AnimatePresence>
                      {showReplyBox && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          className="rounded-2xl p-5 border border-[var(--border-subtle)]
                            transition-all duration-300 hover:border-[rgba(201,178,124,0.25)]"
                          style={{ background: 'linear-gradient(180deg, rgba(7,12,24,0.88) 0%, rgba(4,8,18,0.85) 100%)' }}
                        >
                          <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-[0.1em] mb-3">
                            Instrucciones para Lucy
                          </p>
                          <div className="relative mb-3">
                            <textarea
                              value={draftInstructions}
                              onChange={(e) => setDraftInstructions(e.target.value)}
                              placeholder="Ej: Confirmar la reunión para el jueves por la tarde…"
                              rows={3}
                              className="w-full bg-[var(--surface-glass-hover)] border border-[var(--border-subtle)]
                                rounded-xl px-4 py-3 pr-12 text-sm text-[var(--text-primary)]
                                placeholder:text-[rgba(255,255,255,0.2)] resize-none outline-none
                                focus:border-[rgba(201,178,124,0.35)] focus:bg-[rgba(255,255,255,0.04)]
                                transition-all duration-200"
                            />
                            <button
                              onClick={handleVoiceDictate}
                              disabled={voiceListening}
                              title="Dictar instrucciones por voz"
                              className={`absolute bottom-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center
                                transition-all duration-200
                                ${voiceListening
                                  ? 'bg-[var(--border-champagne)] text-[var(--champagne)] border border-[rgba(201,178,124,0.4)] animate-pulse'
                                  : 'bg-[rgba(255,255,255,0.04)] text-[var(--text-tertiary)] border border-[var(--border-subtle)] hover:text-[var(--champagne)] hover:border-[rgba(201,178,124,0.3)]'
                                }`}
                            >
                              {voiceListening
                                ? <MicOff className="w-3.5 h-3.5" />
                                : <Mic className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <button
                            onClick={handleDraftReply}
                            disabled={draftsLoading || !draftInstructions.trim()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs
                              bg-[rgba(201,178,124,0.1)] text-[var(--champagne)]
                              border border-[rgba(201,178,124,0.25)]
                              hover:bg-[rgba(201,178,124,0.16)] transition-all duration-200
                              disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            {draftsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            {draftsLoading ? 'Generando…' : 'Generar respuesta'}
                          </button>

                          <AnimatePresence>
                            {drafts.length > 0 && (
                              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
                                {drafts.map((draft, i) => (
                                  <div key={i} className="rounded-xl p-4 text-sm text-[var(--text-primary)] leading-relaxed
                                    bg-[rgba(201,178,124,0.04)] border border-[rgba(201,178,124,0.1)] whitespace-pre-wrap">
                                    {draft}
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>
                </ScrollArea>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center gap-5">
                <div className="w-14 h-14 rounded-[24px] flex items-center justify-center
                  bg-[rgba(201,178,124,0.06)] border border-[var(--champagne-faint)]
                  shadow-[0_0_18px_rgba(201,178,124,0.06)]">
                  <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
                    <path d="M11 2L12.8 8.2H19.2L14 12.1L15.8 18.3L11 14.4L6.2 18.3L8 12.1L2.8 8.2H9.2L11 2Z"
                      fill="rgba(201,178,124,0.3)" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm text-[var(--text-tertiary)] mb-1">Selecciona un correo</p>
                  <p className="text-xs text-[rgba(255,255,255,0.1)]">Lucy analizará su contenido</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </Layout>
  );
}