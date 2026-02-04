import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';
import axios from 'axios';
import { Mail, Paperclip, ChevronDown, ChevronUp, Download, Send, Sparkles, Loader2, FileText, Clock, AlertCircle, Info, X, Copy, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FilterBtn = ({ active, onClick, label, icon, highlight, testId }) => {
  let cls = 'px-3 py-1.5 rounded-lg text-sm font-medium ';
  if (active) {
    cls += highlight ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-700 text-slate-100';
  } else {
    cls += 'text-slate-400 hover:text-slate-200 hover:bg-slate-800';
  }
  return <button onClick={onClick} className={cls} data-testid={testId}>{icon || label}</button>;
};

export default function MessagesPage() {
  const { language } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [filter, setFilter] = useState(searchParams.get('label') || 'all');
  const [attachmentsOnly, setAttachmentsOnly] = useState(searchParams.get('attachments') === 'true');
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftInstructions, setDraftInstructions] = useState('');
  const [showDraftForm, setShowDraftForm] = useState(false);
  const [showFullBody, setShowFullBody] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(null);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('label', filter);
      if (attachmentsOnly) params.set('has_attachments', 'true');
      const response = await axios.get(`${API}/emails?${params.toString()}`);
      setEmails(response.data);
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, attachmentsOnly]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  useEffect(() => {
    const selectedId = searchParams.get('selected');
    if (selectedId && emails.length > 0) {
      const email = emails.find(e => e.email.id === selectedId);
      if (email) setSelectedEmail(email);
    }
  }, [emails, searchParams]);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setAttachmentsOnly(false);
    setSearchParams({ label: newFilter });
  };

  const handleAttachmentsFilter = () => {
    const newVal = !attachmentsOnly;
    setAttachmentsOnly(newVal);
    setFilter('all');
    setSearchParams(newVal ? { attachments: 'true' } : {});
  };

  const handleSelectEmail = (email) => {
    setSelectedEmail(email);
    setSummary(null);
    setDrafts([]);
    setShowFullBody(false);
    setShowDraftForm(false);
  };

  const handleSummarize = async () => {
    if (!selectedEmail) return;
    setSummaryLoading(true);
    try {
      const response = await axios.post(`${API}/ai/summarize`, { email_id: selectedEmail.email.id });
      setSummary(response.data.summary);
    } catch (error) {
      console.error('Summarize error:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleDraftReply = async () => {
    if (!selectedEmail || !draftInstructions.trim()) return;
    setDraftsLoading(true);
    try {
      const response = await axios.post(`${API}/ai/draft-reply`, { email_id: selectedEmail.email.id, instructions: draftInstructions });
      setDrafts(response.data.drafts);
    } catch (error) {
      console.error('Draft error:', error);
    } finally {
      setDraftsLoading(false);
    }
  };

  const copyDraft = (draft, index) => {
    navigator.clipboard.writeText(draft);
    setCopiedDraft(index);
    setTimeout(() => setCopiedDraft(null), 2000);
  };

  const getPriorityIcon = (label) => {
    if (label === 'PRIORITARIO') return <AlertCircle className="w-4 h-4 text-blue-400" strokeWidth={1.5} />;
    if (label === 'SEGUIMIENTO') return <Clock className="w-4 h-4 text-amber-400" strokeWidth={1.5} />;
    return <Info className="w-4 h-4 text-slate-400" strokeWidth={1.5} />;
  };

  const getPriorityClass = (label) => {
    if (label === 'PRIORITARIO') return 'priority-high';
    if (label === 'SEGUIMIENTO') return 'priority-medium';
    return 'priority-low';
  };

  const getPriorityLabel = (label) => {
    if (label === 'PRIORITARIO') return t(language, 'prioritario');
    if (label === 'SEGUIMIENTO') return t(language, 'seguimiento');
    return t(language, 'informativo');
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-80px)]" data-testid="messages-page">
        <div className="w-full md:w-[35%] border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <div className="flex flex-wrap gap-2">
              <FilterBtn active={filter === 'all' && !attachmentsOnly} onClick={() => handleFilterChange('all')} label={t(language, 'allEmails')} testId="filter-all" />
              <FilterBtn active={filter === 'PRIORITARIO'} onClick={() => handleFilterChange('PRIORITARIO')} label={t(language, 'priority')} highlight testId="filter-priority" />
              <FilterBtn active={filter === 'SEGUIMIENTO'} onClick={() => handleFilterChange('SEGUIMIENTO')} label={t(language, 'followUp')} testId="filter-followup" />
              <FilterBtn active={filter === 'INFO'} onClick={() => handleFilterChange('INFO')} label={t(language, 'info')} testId="filter-info" />
              <FilterBtn active={attachmentsOnly} onClick={handleAttachmentsFilter} icon={<Paperclip className="w-4 h-4" strokeWidth={1.5} />} testId="filter-attachments" />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
                <p className="mt-4 text-slate-400">{t(language, 'loading')}</p>
              </div>
            ) : emails.length === 0 ? (
              <div className="p-8 text-center">
                <Mail className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">{t(language, 'noResults')}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {emails.map((item) => (
                  <button
                    key={item.email.id}
                    onClick={() => handleSelectEmail(item)}
                    className={'w-full p-4 text-left hover:bg-slate-800/50 ' + (selectedEmail?.email.id === item.email.id ? 'bg-slate-800/70 border-l-2 border-blue-500' : '')}
                    data-testid={'email-item-' + item.email.id}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">{getPriorityIcon(item.priority.priority_label)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-200 truncate">{item.email.from_name}</span>
                          {item.email.has_attachments && <Paperclip className="w-3 h-3 text-slate-500 flex-shrink-0" strokeWidth={1.5} />}
                        </div>
                        <p className="text-sm text-slate-300 truncate mb-1">{item.email.subject}</p>
                        <p className="text-xs text-slate-500 truncate">{item.email.snippet}</p>
                        <p className="text-xs text-slate-600 mt-1">{new Date(item.email.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="hidden md:flex md:w-[65%] flex-col">
          {selectedEmail ? (
            <EmailDetail
              selectedEmail={selectedEmail}
              setSelectedEmail={setSelectedEmail}
              language={language}
              summary={summary}
              summaryLoading={summaryLoading}
              handleSummarize={handleSummarize}
              drafts={drafts}
              draftsLoading={draftsLoading}
              handleDraftReply={handleDraftReply}
              draftInstructions={draftInstructions}
              setDraftInstructions={setDraftInstructions}
              showDraftForm={showDraftForm}
              setShowDraftForm={setShowDraftForm}
              showFullBody={showFullBody}
              setShowFullBody={setShowFullBody}
              copiedDraft={copiedDraft}
              copyDraft={copyDraft}
              getPriorityIcon={getPriorityIcon}
              getPriorityClass={getPriorityClass}
              getPriorityLabel={getPriorityLabel}
              formatFileSize={formatFileSize}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Mail className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-500">Selecciona un correo para ver los detalles</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function EmailDetail({ selectedEmail, setSelectedEmail, language, summary, summaryLoading, handleSummarize, drafts, draftsLoading, handleDraftReply, draftInstructions, setDraftInstructions, showDraftForm, setShowDraftForm, showFullBody, setShowFullBody, copiedDraft, copyDraft, getPriorityIcon, getPriorityClass, getPriorityLabel, formatFileSize }) {
  return (
    <>
      <ScrollArea className="flex-1 p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key={selectedEmail.email.id}>
          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <span className={'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ' + getPriorityClass(selectedEmail.priority.priority_label)}>
                {getPriorityIcon(selectedEmail.priority.priority_label)}
                {getPriorityLabel(selectedEmail.priority.priority_label)}
                <span className="ml-1 opacity-70">({selectedEmail.priority.priority_score})</span>
              </span>
              <button onClick={() => setSelectedEmail(null)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200" data-testid="close-email-detail">
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>
            <h2 className="text-2xl font-semibold text-slate-100 mb-3">{selectedEmail.email.subject}</h2>
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span>{t(language, 'from')}: <span className="text-slate-200">{selectedEmail.email.from_name}</span></span>
              <span>{'<' + selectedEmail.email.from_email + '>'}</span>
              <span>{new Date(selectedEmail.email.date).toLocaleString()}</span>
            </div>
          </div>

          <div className="glass-subtle rounded-xl p-4 mb-6">
            <button className="w-full text-left" onClick={() => {}} data-testid="priority-explanation-trigger">
              <span className="text-sm font-medium text-slate-300">{t(language, 'why')}</span>
            </button>
            <div className="mt-2">
              <p className="text-slate-400 text-sm mb-3">{selectedEmail.priority.explain}</p>
              {selectedEmail.priority.rule_hits.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedEmail.priority.rule_hits.map((rule, i) => (
                    <span key={i} className="px-2 py-1 rounded bg-slate-800 text-xs text-slate-400 font-mono">{rule}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {summary && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-subtle rounded-xl p-4 mb-6" data-testid="email-summary">
              <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
                {t(language, 'summary')}
              </h4>
              <p className="text-slate-400 text-sm">{summary}</p>
            </motion.div>
          )}

          <div className="glass-subtle rounded-xl p-4 mb-6">
            <div className={'text-slate-300 text-sm leading-relaxed whitespace-pre-wrap ' + (!showFullBody ? 'line-clamp-6' : '')}>
              {selectedEmail.email.body}
            </div>
            <Button variant="ghost" onClick={() => setShowFullBody(!showFullBody)} className="mt-3 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 p-0 h-auto" data-testid="toggle-full-message">
              {showFullBody ? <><ChevronUp className="w-4 h-4 mr-1" />{t(language, 'hideFullMessage')}</> : <><ChevronDown className="w-4 h-4 mr-1" />{t(language, 'showFullMessage')}</>}
            </Button>
          </div>

          {selectedEmail.email.has_attachments && selectedEmail.email.attachments.length > 0 && (
            <div className="glass-subtle rounded-xl p-4 mb-6" data-testid="attachments-section">
              <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
                {t(language, 'attachments')} ({selectedEmail.email.attachments.length})
              </h4>
              <div className="space-y-2">
                {selectedEmail.email.attachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
                      <div>
                        <p className="text-sm text-slate-200">{att.name}</p>
                        <p className="text-xs text-slate-500">{formatFileSize(att.size)}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10" data-testid={'download-attachment-' + att.id}>
                      <Download className="w-4 h-4 mr-1" />{t(language, 'downloadAttachment')}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {drafts.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-subtle rounded-xl p-4 mb-6" data-testid="draft-replies">
              <h4 className="text-sm font-medium text-slate-300 mb-3">{t(language, 'draftOptions')}</h4>
              <div className="space-y-3">
                {drafts.map((draft, index) => (
                  <div key={index} className="p-3 rounded-lg bg-slate-800/50">
                    <p className="text-sm text-slate-300 whitespace-pre-wrap mb-3">{draft}</p>
                    <Button size="sm" onClick={() => copyDraft(draft, index)} className="bg-blue-600 hover:bg-blue-500 text-white" data-testid={'use-draft-' + index}>
                      {copiedDraft === index ? <><Check className="w-4 h-4 mr-1" />Copiado</> : <><Copy className="w-4 h-4 mr-1" />{t(language, 'useDraft')}</>}
                    </Button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      </ScrollArea>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <Button onClick={handleSummarize} disabled={summaryLoading} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100" data-testid="summarize-btn">
            {summaryLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" strokeWidth={1.5} />}
            {t(language, 'aiSummarize')}
          </Button>
          <Button onClick={() => setShowDraftForm(!showDraftForm)} variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100" data-testid="draft-reply-btn">
            <Send className="w-4 h-4 mr-2" strokeWidth={1.5} />{t(language, 'aiDraft')}
          </Button>
          <div className="flex-1 ml-4">
            <div className="glass-premium rounded-xl p-3 halo-card-ia ai-card flex items-center gap-3" data-testid="messages-ai-card">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-blue-400" strokeWidth={1.5} />
              </div>
              <span className="text-sm text-slate-300">{t(language, 'aiHelp')}</span>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showDraftForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden">
              <div className="glass-subtle rounded-xl p-4" data-testid="draft-form">
                <label className="text-sm text-slate-400 mb-2 block">¿Cómo quieres responder?</label>
                <Textarea value={draftInstructions} onChange={(e) => setDraftInstructions(e.target.value)} placeholder="Ej: Acepta la reunión..." className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 mb-3 min-h-[80px]" data-testid="draft-instructions-input" />
                <Button onClick={handleDraftReply} disabled={draftsLoading || !draftInstructions.trim()} className="bg-blue-600 hover:bg-blue-500 text-white" data-testid="generate-draft-btn">
                  {draftsLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t(language, 'generating')}</> : <><Sparkles className="w-4 h-4 mr-2" />Generar borradores</>}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
