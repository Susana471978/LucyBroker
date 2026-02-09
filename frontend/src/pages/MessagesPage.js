import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';

import {
  Mail,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Download,
  Send,
  Sparkles,
  Loader2,
  FileText,
  Clock,
  AlertCircle,
  Info,
  X,
  Copy,
  Check,
} from 'lucide-react';

import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';

import { motion, AnimatePresence } from 'framer-motion';
import Layout from '../components/Layout';

import { fetchEmails as fetchEmailsService } from '../services/mailService';
import { summarizeEmail, generateDraft } from '../services/aiService';

/* ---------------- FILTER BUTTON ---------------- */

const FilterBtn = ({ active, onClick, label, icon, highlight, testId }) => {
  let cls = 'px-3 py-1.5 rounded-lg text-sm font-medium ';

  if (active) {
    cls += highlight
      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
      : 'bg-slate-700 text-slate-100';
  } else {
    cls += 'text-slate-400 hover:text-slate-200 hover:bg-slate-800';
  }

  return (
    <button onClick={onClick} className={cls} data-testid={testId}>
      {icon || label}
    </button>
  );
};

/* ---------------- MAIN PAGE ---------------- */

export default function MessagesPage() {
  const { language } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();

  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedEmail, setSelectedEmail] = useState(null);

  const urlFilter = searchParams.get('filter');

  const [filter, setFilter] = useState(
    urlFilter === 'priority' ? 'PRIORITARIO'
    : urlFilter === 'followup' ? 'SEGUIMIENTO'
    : searchParams.get('label') || 'all'
  );

  const [attachmentsOnly, setAttachmentsOnly] = useState(
    urlFilter === 'attachments' || searchParams.get('attachments') === 'true'
  );

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);

  const [draftInstructions, setDraftInstructions] = useState('');

  const [showDraftForm, setShowDraftForm] = useState(false);
  const [showFullBody, setShowFullBody] = useState(false);

  const [copiedDraft, setCopiedDraft] = useState(null);

  /* ---------------- FETCH EMAILS ---------------- */

  const fetchEmails = useCallback(async () => {
    setLoading(true);

    try {
      const data = await fetchEmailsService({
        label: filter,
        attachments: attachmentsOnly,
      });

      setEmails(data);
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, attachmentsOnly]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  /* ---------------- URL SELECT ---------------- */

  useEffect(() => {
    const selectedId = searchParams.get('selected');

    if (selectedId && emails.length > 0) {
      const email = emails.find(
        (e) => e.email.id === selectedId
      );

      if (email) setSelectedEmail(email);
    }
  }, [emails, searchParams]);

  /* ---------------- FILTERS ---------------- */

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

  /* ---------------- SELECTION ---------------- */

  const handleSelectEmail = (email) => {
    setSelectedEmail(email);

    setSummary(null);
    setDrafts([]);

    setShowFullBody(false);
    setShowDraftForm(false);
  };

  /* ---------------- AI ---------------- */

  const handleSummarize = async () => {
    if (!selectedEmail) return;

    setSummaryLoading(true);

    try {
      const summaryText = await summarizeEmail(
        selectedEmail.email.id
      );

      setSummary(summaryText);
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
      const draftsData = await generateDraft(
        selectedEmail.email.id,
        draftInstructions
      );

      setDrafts(draftsData);
    } catch (error) {
      console.error('Draft error:', error);
    } finally {
      setDraftsLoading(false);
    }
  };

  /* ---------------- HELPERS ---------------- */

  const copyDraft = (draft, index) => {
    navigator.clipboard.writeText(draft);

    setCopiedDraft(index);

    setTimeout(() => setCopiedDraft(null), 2000);
  };

  const getPriorityIcon = (label) => {
    if (label === 'PRIORITARIO')
      return <AlertCircle className="w-4 h-4 text-blue-400" strokeWidth={1.5} />;

    if (label === 'SEGUIMIENTO')
      return <Clock className="w-4 h-4 text-amber-400" strokeWidth={1.5} />;

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
    if (bytes < 1024 * 1024)
      return (bytes / 1024).toFixed(1) + ' KB';

    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  /* ---------------- UI ---------------- */

  return (
    <Layout>
      <div className="flex h-[calc(100vh-80px)]" data-testid="messages-page">
        {/* LEFT LIST */}

        <div className="w-full md:w-[35%] border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <div className="flex flex-wrap gap-2">
              <FilterBtn
                active={filter === 'all' && !attachmentsOnly}
                onClick={() => handleFilterChange('all')}
                label={t(language, 'allEmails')}
              />

              <FilterBtn
                active={filter === 'PRIORITARIO'}
                onClick={() => handleFilterChange('PRIORITARIO')}
                label={t(language, 'priority')}
                highlight
              />

              <FilterBtn
                active={filter === 'SEGUIMIENTO'}
                onClick={() => handleFilterChange('SEGUIMIENTO')}
                label={t(language, 'followUp')}
              />

              <FilterBtn
                active={filter === 'INFO'}
                onClick={() => handleFilterChange('INFO')}
                label={t(language, 'info')}
              />

              <FilterBtn
                active={attachmentsOnly}
                onClick={handleAttachmentsFilter}
                icon={<Paperclip className="w-4 h-4" strokeWidth={1.5} />}
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
                <p className="mt-4 text-slate-400">
                  {t(language, 'loading')}
                </p>
              </div>
            ) : emails.length === 0 ? (
              <div className="p-8 text-center">
                <Mail className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">
                  {t(language, 'noResults')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {emails.map((item) => (
                  <button
                    key={item.email.id}
                    onClick={() => handleSelectEmail(item)}
                    className={
                      'w-full p-4 text-left hover:bg-slate-800/50 ' +
                      (selectedEmail?.email.id === item.email.id
                        ? 'bg-slate-800/70 border-l-2 border-blue-500'
                        : '')
                    }
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getPriorityIcon(item.priority.priority_label)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-slate-200 truncate">
                            {item.email.from_name}
                          </span>

                          {item.email.has_attachments && (
                            <Paperclip
                              className="w-3 h-3 text-slate-500"
                              strokeWidth={1.5}
                            />
                          )}
                        </div>

                        <p className="text-sm text-slate-300 truncate mb-1">
                          {item.email.subject}
                        </p>

                        <p className="text-xs text-slate-500 truncate">
                          {item.email.snippet}
                        </p>

                        <p className="text-xs text-slate-600 mt-1">
                          {new Date(item.email.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* RIGHT PANEL */}

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
                <p className="text-slate-500">
                  Selecciona un correo para ver los detalles
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

/* ---------------- DETAIL COMPONENT ---------------- */

function EmailDetail({
  selectedEmail,
  setSelectedEmail,
  language,
  summary,
  summaryLoading,
  handleSummarize,
  drafts,
  draftsLoading,
  handleDraftReply,
  draftInstructions,
  setDraftInstructions,
  showDraftForm,
  setShowDraftForm,
  showFullBody,
  setShowFullBody,
  copiedDraft,
  copyDraft,
  getPriorityIcon,
  getPriorityClass,
  getPriorityLabel,
  formatFileSize,
}) {
  return (
    <>
      <ScrollArea className="flex-1 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          key={selectedEmail.email.id}
        >

          {/* HEADER */}

          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <span
                className={
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ' +
                  getPriorityClass(
                    selectedEmail.priority.priority_label
                  )
                }
              >
                {getPriorityIcon(
                  selectedEmail.priority.priority_label
                )}

                {getPriorityLabel(
                  selectedEmail.priority.priority_label
                )}

                <span className="ml-1 opacity-70">
                  ({selectedEmail.priority.priority_score})
                </span>
              </span>

              <button
                onClick={() => setSelectedEmail(null)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            <h2 className="text-2xl font-semibold text-slate-100 mb-3">
              {selectedEmail.email.subject}
            </h2>

            <div className="flex items-center gap-4 text-sm text-slate-400">
              <span>
                {t(language, 'from')}:{' '}
                <span className="text-slate-200">
                  {selectedEmail.email.from_name}
                </span>
              </span>

              <span>
                {'<' + selectedEmail.email.from_email + '>'}
              </span>

              <span>
                {new Date(
                  selectedEmail.email.date
                ).toLocaleString()}
              </span>
            </div>
          </div>

          {/* BODY */}

          <div className="glass-subtle rounded-xl p-4 mb-6">
            {selectedEmail.email.body && selectedEmail.email.body.includes('<') && selectedEmail.email.body.includes('>') ? (
              <div
                className={
                  'text-slate-300 text-sm leading-relaxed ' +
                  (!showFullBody ? 'line-clamp-6 overflow-hidden' : '')
                }
                dangerouslySetInnerHTML={{ __html: selectedEmail.email.body }}
              />
            ) : (
              <div
                className={
                  'text-slate-300 text-sm leading-relaxed whitespace-pre-wrap ' +
                  (!showFullBody ? 'line-clamp-6' : '')
                }
              >
                {selectedEmail.email.body}
              </div>
            )}

            <Button
              variant="ghost"
              onClick={() => setShowFullBody(!showFullBody)}
              className="mt-3 text-blue-400 p-0 h-auto"
            >
              {showFullBody ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  {t(language, 'hideFullMessage')}
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  {t(language, 'showFullMessage')}
                </>
              )}
            </Button>
          </div>

          {/* SUMMARY */}

          {summary && (
            <div className="glass-subtle rounded-xl p-4 mb-6">
              <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                {t(language, 'summary')}
              </h4>

              <p className="text-slate-400 text-sm">{summary}</p>
            </div>
          )}
        </motion.div>
      </ScrollArea>

      {/* FOOTER */}

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3">

          <Button
            onClick={handleSummarize}
            disabled={summaryLoading}
            variant="outline"
            className="border-slate-700 text-slate-300"
          >
            {summaryLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}

            {t(language, 'aiSummarize')}
          </Button>

          <Button
            onClick={() => setShowDraftForm(!showDraftForm)}
            variant="outline"
            className="border-slate-700 text-slate-300"
          >
            <Send className="w-4 h-4 mr-2" />
            {t(language, 'aiDraft')}
          </Button>

        </div>

        <AnimatePresence>
          {showDraftForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className="glass-subtle rounded-xl p-4">
                <label className="text-sm text-slate-400 mb-2 block">
                  ¿Cómo quieres responder?
                </label>

                <Textarea
                  value={draftInstructions}
                  onChange={(e) =>
                    setDraftInstructions(e.target.value)
                  }
                  placeholder="Ej: Acepta la reunión..."
                  className="bg-slate-800/50 border-slate-700 mb-3"
                />

                <Button
                  onClick={handleDraftReply}
                  disabled={
                    draftsLoading || !draftInstructions.trim()
                  }
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {draftsLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {t(language, 'generating')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generar borradores
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
