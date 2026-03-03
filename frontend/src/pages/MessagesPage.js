import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { t } from '../i18n';

import {
  Mail,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Send,
  Sparkles,
  Loader2,
  Clock,
  AlertCircle,
  Info,
  X
} from 'lucide-react';

import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';

import { motion } from 'framer-motion';
import Layout from '../components/Layout';

import { fetchEmails as fetchEmailsService } from '../services/mailService';
import { summarizeEmail, generateDraft } from '../services/aiService';

/* ---------------- FILTER BUTTON ---------------- */

const FilterBtn = ({ active, onClick, label, icon, highlight }) => {
  let cls = 'px-3 py-1.5 rounded-lg text-sm font-medium ';

  if (active) {
    cls += highlight
      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
      : 'bg-slate-700 text-slate-100';
  } else {
    cls += 'text-slate-400 hover:text-slate-200 hover:bg-slate-800';
  }

  return (
    <button onClick={onClick} className={cls}>
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

  const [filter, setFilter] = useState(searchParams.get('label') || 'all');
  const [attachmentsOnly, setAttachmentsOnly] = useState(false);

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);

  const [draftInstructions, setDraftInstructions] = useState('');
  const [showReplyBox, setShowReplyBox] = useState(false);

  /* ---------------- FETCH EMAILS ---------------- */

  const fetchEmails = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetchEmailsService({
        label: filter,
        attachments: attachmentsOnly,
      });

      let normalized = [];

      if (Array.isArray(response)) normalized = response;
      else if (Array.isArray(response?.data)) normalized = response.data;
      else if (Array.isArray(response?.emails)) normalized = response.emails;

      if (Array.isArray(normalized)) {
        setEmails(normalized);
      }

    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, attachmentsOnly]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  /* ---------------- FILTERS ---------------- */

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setAttachmentsOnly(false);
    setSearchParams({ label: newFilter });
  };

  const handleSelectEmail = (email) => {
    setSelectedEmail(email);
    setSummary(null);
    setDrafts([]);
    setDraftInstructions('');
    setShowReplyBox(false);
  };

  /* ---------------- AI ---------------- */

  const handleSummarize = async () => {
    if (!selectedEmail?.email?.id) return;

    setSummaryLoading(true);

    try {
      const result = await summarizeEmail(
        selectedEmail.email.id
      );

      setSummary(result || null);

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
      const draftsData = await generateDraft(
        selectedEmail.email.id,
        draftInstructions
      );

      setDrafts(Array.isArray(draftsData) ? draftsData : []);
    } catch (error) {
      console.error('Draft error:', error);
    } finally {
      setDraftsLoading(false);
    }
  };

  /* ---------------- HELPERS ---------------- */

  const getPriorityIcon = (label) => {
    if (label === 'PRIORITARIO')
      return <AlertCircle className="w-4 h-4 text-blue-400" />;

    if (label === 'SEGUIMIENTO')
      return <Clock className="w-4 h-4 text-amber-400" />;

    return <Info className="w-4 h-4 text-slate-400" />;
  };

  /* ---------------- UI ---------------- */

  return (
    <Layout>
      <div className="flex h-[calc(100vh-80px)]">

        {/* LEFT PANEL */}
        <div className="w-full md:w-[35%] border-r border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex gap-2">
            <FilterBtn
              active={filter === 'all'}
              onClick={() => handleFilterChange('all')}
              label={t(language, 'allEmails')}
            />
            <FilterBtn
              active={filter === 'PRIORITARIO'}
              onClick={() => handleFilterChange('PRIORITARIO')}
              label={t(language, 'priority')}
              highlight
            />
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
              </div>
            ) : emails.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                {t(language, 'noResults')}
              </div>
            ) : (
              emails.map((item) => {
                const email = item?.email;
                const priority = item?.priority?.priority_label;

                if (!email?.id) return null;

                return (
                  <button
                    key={email.id}
                    onClick={() => handleSelectEmail(item)}
                    className="w-full p-4 text-left hover:bg-slate-800/50"
                  >
                    <div className="flex gap-3">
                      {getPriorityIcon(priority)}
                      <div>
                        <p className="text-slate-200">
                          {email.subject || '(Sin asunto)'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {email.snippet || ''}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </ScrollArea>
        </div>

        {/* RIGHT PANEL */}
        <div className="hidden md:flex md:w-[65%] flex-col">
          {selectedEmail?.email ? (
            <ScrollArea className="flex-1 p-6">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="text-xl text-slate-100 mb-4">
                  {selectedEmail.email.subject}
                </h2>

                {/* BOTONES */}
                <div className="flex gap-3 mb-6">
                  <Button
                    onClick={handleSummarize}
                    disabled={summaryLoading}
                    className="bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-2"
                  >
                    {summaryLoading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Sparkles className="w-4 h-4" />}
                    Resumir
                  </Button>

                  <Button
                    onClick={() => setShowReplyBox(prev => !prev)}
                    className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Responder
                  </Button>
                </div>

                <div className="rounded-xl p-6 overflow-auto max-h-[75vh] mb-6 bg-slate-900/70 backdrop-blur-xl border border-slate-700">
                  <div
                    className="email-content text-slate-200"
                    dangerouslySetInnerHTML={{
                      __html: selectedEmail.email.body || '',
                    }}
                  />
                </div>

                {summary && (
                  <div className="glass-subtle rounded-xl p-4 mb-6">
                    <p className="text-slate-400">{summary}</p>
                  </div>
                )}

                {showReplyBox && (
                  <div className="glass-subtle rounded-xl p-4">
                    <Textarea
                      value={draftInstructions}
                      onChange={(e) => setDraftInstructions(e.target.value)}
                      placeholder="Escribe las instrucciones para generar la respuesta..."
                      className="mb-4"
                    />

                    <Button
                      onClick={handleDraftReply}
                      disabled={draftsLoading}
                      className="bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      {draftsLoading ? "Generando..." : "Generar respuesta"}
                    </Button>

                    {drafts.length > 0 && (
                      <div className="mt-4 space-y-4">
                        {drafts.map((draft, index) => (
                          <div key={index} className="bg-slate-800 p-4 rounded-lg text-slate-200 whitespace-pre-wrap">
                            {draft}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </motion.div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              Selecciona un correo para verlo
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}