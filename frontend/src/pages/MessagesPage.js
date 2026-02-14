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
import { callAssistant } from '../services/aiService';

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
  const { language, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);

  const urlFilter = searchParams.get('filter');

  const [filter, setFilter] = useState(
    urlFilter === 'priority'
      ? 'PRIORITARIO'
      : urlFilter === 'followup'
        ? 'SEGUIMIENTO'
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

  useEffect(() => {
    const selectedId = searchParams.get('selected');
    if (selectedId && emails.length > 0) {
      const email = emails.find((e) => e.email.id === selectedId);
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

  /* ---------------- FIX: MISSING FUNCTION ---------------- */

  const handleAssistantActions = (actions) => {
    console.log('Assistant actions:', actions);
  };

  /* ---------------- AI ---------------- */

  const handleSummarize = async () => {
    if (!selectedEmail) return;
    setSummaryLoading(true);
    try {
      const userInputText = `Resumir correo: ${selectedEmail.email.subject || ''
        }\n${selectedEmail.email.body || ''}`;
      const result = await callAssistant(userInputText, token);
      if (result.assistant_text) {
        setSummary(result.assistant_text);
      }
      if (result.actions) {
        handleAssistantActions(result.actions);
      }
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
      const userInputText = `Redactar respuesta para: ${selectedEmail.email.subject || ''
        }\nInstrucciones: ${draftInstructions}`;
      const result = await callAssistant(userInputText, token);
      if (result.assistant_text) {
        setDrafts([result.assistant_text]);
      }
      if (result.actions) {
        handleAssistantActions(result.actions);
      }
    } catch (error) {
      console.error('Draft error:', error);
    } finally {
      setDraftsLoading(false);
    }
  };

  return <Layout>...EL RESTO DEL JSX PERMANECE EXACTAMENTE IGUAL...</Layout>;
}
