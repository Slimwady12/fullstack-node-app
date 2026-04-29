import { useState, useCallback, useMemo, useEffect, useRef, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useAuth } from '../../hooks/useAuth';
import axios from 'axios';
import {
  Send,
  Paperclip,
  Loader2,
  MessageSquare,
  Clock,
  History,
  Trash2,
  Play,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Eye,
  ExternalLink,
  Star,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  FileImage,
  File,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: string;
  attachments?: string[];
}

interface AttachmentPreview {
  filename: string;
  url: string;
  type: string;
}

interface WizardState {
  templateId: string;
  templateName: string;
  extracted: Record<string, string>;
  remaining: string[];
  currentField: string | null;
  progress: number;
  sessionId: string | null;
  suggestedLawyers: Array<{ id: string; name: string; rating: number; score: number; specializations: string[]; price: number }>;
  action: 'continue' | 'retry' | 'complete' | 'START_AUTOMATION';
  triggerSignal?: string;
}

interface AutomationSession {
  id: string;
  templateId: string;
  templateName: string;
  status: string;
  progress: number;
  updatedAt: string;
  sessionState: {
    extracted: Record<string, unknown>;
    remaining: string[];
    currentField: string | null;
    progress: number;
  };
}

// Simple Markdown renderer with streaming animation
function MarkdownRenderer({ content }: { content: string }): JSX.Element {
  if (!content) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">AI is thinking...</span>
      </div>
    );
  }

  // Parse markdown into HTML elements
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let inList = false;
  let listItems: JSX.Element[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeBlockKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2 ml-2">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushCode = () => {
    if (codeLines.length > 0) {
      elements.push(
        <pre key={`code-${codeBlockKey++}`} className="bg-navy-950 border border-navy-700 rounded-lg p-3 my-2 overflow-x-auto">
          <code className="text-sm text-emerald-400 font-mono">{codeLines.join('\n')}</code>
        </pre>
      );
      codeLines = [];
      inCodeBlock = false;
    }
  };

  const renderInline = (text: string, key: string): JSX.Element => {
    const parts: JSX.Element[] = [];
    const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
    let lastIndex = 0;
    let match;
    let idx = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`${key}-${idx++}`}>{text.slice(lastIndex, match.index)}</span>);
      }
      if (match[2]) {
        parts.push(<strong key={`${key}-${idx++}`} className="font-bold text-white">{match[2]}</strong>);
      } else if (match[4]) {
        parts.push(<em key={`${key}-${idx++}`} className="italic">{match[4]}</em>);
      } else if (match[6]) {
        parts.push(<code key={`${key}-${idx++}`} className="bg-navy-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono text-xs">{match[6]}</code>);
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={`${key}-${idx++}`}>{text.slice(lastIndex)}</span>);
    }

    return <span key={key}>{parts.length === 1 ? parts[0] : parts}</span>;
  };

  lines.forEach((line, i) => {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushCode();
      } else {
        flushList();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    if (line.match(/^\d+\.\s/)) {
      flushList();
      const text = line.replace(/^\d+\.\s/, '');
      elements.push(
        <div key={`olist-${i}`} className="flex gap-2 my-1 ml-2">
          <span className="text-emerald-500 font-bold min-w-[1.5rem]">{line.match(/^(\d+)\./)?.[1]}.</span>
          <span className="text-slate-200">{renderInline(text, `olist-${i}`)}</span>
        </div>
      );
      return;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) inList = true;
      const text = line.slice(2);
      listItems.push(
        <li key={`li-${i}`}>{renderInline(text, `li-${i}`)}</li>
      );
      return;
    }

    flushList();

    if (line.startsWith('### ')) {
      elements.push(<h3 key={`h3-${i}`} className="text-base font-bold text-white mt-3 mb-1">{renderInline(line.slice(4), `h3-${i}`)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={`h2-${i}`} className="text-lg font-bold text-white mt-3 mb-1">{renderInline(line.slice(3), `h2-${i}`)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={`h1-${i}`} className="text-xl font-bold text-white mt-3 mb-2">{renderInline(line.slice(2), `h1-${i}`)}</h1>);
    } else if (line.startsWith('---')) {
      elements.push(<hr key={`hr-${i}`} className="border-navy-700 my-3" />);
    } else if (line.trim() === '') {
      elements.push(<div key={`br-${i}`} className="h-2" />);
    } else {
      elements.push(<p key={`p-${i}`} className="my-1 leading-relaxed">{renderInline(line, `p-${i}`)}</p>);
    }
  });

  flushList();
  flushCode();

  // Check if still streaming (content doesn't end with sentence-ending punctuation or newline)
  const isStreaming = content.length > 0 && !content.match(/[.!?]\s*$/);

  return (
    <div className="space-y-0.5 animate-fadeIn">
      {elements}
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-emerald-400 ml-0.5 animate-blink vertical-align-middle" />
      )}
    </div>
  );
}

type ChatMode = 'general' | 'wizard';
type ActiveTab = 'chat' | 'sessions' | 'history';

const TABS: { key: ActiveTab; labelKey: string; icon: React.ReactElement }[] = [
  { key: 'chat', labelKey: 'common.navigation.chat', icon: <MessageSquare className="w-4 h-4" /> },
  { key: 'sessions', labelKey: 'chat.sessions.newSession', icon: <Clock className="w-4 h-4" /> },
  { key: 'history', labelKey: 'chat.history.title', icon: <History className="w-4 h-4" /> },
];

export default function ChatPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading: syncLoading, error: syncError, refresh } = useRealtimeSync();

  // Debug: Check AI config status
  const hasApiKeyInDb = !!data?.systemConfig?.ai?.openaiApiKey;
  const configuredModel = data?.systemConfig?.ai?.defaultModel || 'gpt-5.4-mini';

  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [mode, setMode] = useState<ChatMode>('general');
  const [chatId, setChatId] = useState<string | null>(null);
  const [wizardState, setWizardState] = useState<WizardState | null>(null);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(true);
  const [debugOpen, setDebugOpen] = useState<boolean>(false);
  const [lastResponse, setLastResponse] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (activeTab === 'chat' && messages.length === 0 && mode === 'general') {
      setInput('');
      setAttachments([]);
      setWizardState(null);
      setError(null);
    }
  }, [activeTab, mode]);

  const templates = useMemo(() => data?.templates || [], [data]);
  const aiChats = useMemo(() => {
    if (!data?.aiChats || !user) return [];
    return data.aiChats.filter(c => c.userId === user.userId).sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [data, user]);

  const sessions = useMemo((): AutomationSession[] => {
    if (!data?.automations || !data?.templates || !user) return [];
    return data.automations
      .filter(a => a.userId === user.userId)
      .map(a => {
        const template = data.templates.find(t => t.id === a.templateId);
        return {
          id: a.id,
          templateId: a.templateId,
          templateName: template?.name || a.templateId.slice(0, 16),
          status: a.status,
          progress: a.sessionState?.progress || 0,
          updatedAt: a.updatedAt,
          sessionState: a.sessionState,
        };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [data, user]);

  const detectTrigger = useCallback((message: string): { templateId: string; templateName: string } | null => {
    const lowerMsg = message.toLowerCase();
    for (const template of templates) {
      if (template.status !== 'ACTIVE') continue;
      for (const keyword of template.aiConfig?.triggerKeywords || []) {
        if (lowerMsg.includes(keyword.toLowerCase())) {
          return { templateId: template.id, templateName: template.name };
        }
      }
    }
    return null;
  }, [templates]);

  const parseSignal = useCallback((content: string): string | null => {
    const match = content.match(/AUTOMATION:[\w-]+/);
    if (match) {
      const parts = match[0].split(':');
      if (parts.length >= 2) {
        const templateId = parts.slice(1).join(':');
        const template = templates.find(t => t.id === templateId);
        if (template) {
          return templateId;
        }
      }
    }
    return null;
  }, [templates]);

  const handleFileUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (response.data.success) {
          setAttachments(prev => [...prev, {
            filename: response.data.data.filename,
            url: `/uploads/${response.data.data.filename}`,
            type: response.data.data.mimetype,
          }]);
        }
      }
    } catch {
      setError(t('errors.uploadFailed' as any));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [t]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSendGeneral = useCallback(async () => {
    if (!input.trim() || !user) return;

    setSending(true);
    setError(null);

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      attachments: attachments.map(a => a.filename),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input.trim();
    const currentAttachments = [...attachments];
    setInput('');
    setAttachments([]);

    // Create placeholder AI message for streaming
    const aiMessageId = `${Date.now()}-ai`;
    setMessages(prev => [...prev, {
      id: aiMessageId,
      role: 'ai',
      content: '',
      timestamp: new Date().toISOString(),
      attachments: [],
    }]);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userId,
          chatId,
          message: currentInput,
          attachments: currentAttachments.map(a => a.filename),
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Streaming not supported');

      const decoder = new TextDecoder();
      let buffer = '';
      let eventType = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:') && eventType) {
            const dataStr = line.slice(5).trim();
            try {
              const data = JSON.parse(dataStr);
              if (eventType === 'session') {
                // Session started
              } else if (eventType === 'token') {
                const token = data.token || '';
                setMessages(prev => prev.map(m =>
                  m.id === aiMessageId ? { ...m, content: m.content + token } : m
                ));
              } else if (eventType === 'done') {
                setChatId(data.sessionId);
                setLastResponse({ sessionId: data.sessionId, message: data.message });
              } else if (eventType === 'error') {
                setError(data.error);
              }
            } catch {
              // Skip invalid JSON
            }
          } else if (line.trim() === '') {
            eventType = '';
          }
        }
      }
    } catch {
      setError(t('errors.sendFailed' as any));
    } finally {
      setSending(false);
    }
  }, [input, chatId, user, t, attachments]);

  const handleSendWizard = useCallback(async () => {
    if (!input.trim() || !user || !wizardState) return;

    setSending(true);
    setError(null);

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      attachments: [],
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput('');

    try {
      const response = await axios.post('/api/middleman/chat', {
        userId: user.userId,
        templateId: wizardState.templateId,
        message: currentInput,
        sessionId: wizardState.sessionId,
      });

      if (response.data.success) {
        const data = response.data.data;

        const aiMessage: ChatMessage = {
          id: `${Date.now()}-ai`,
          role: 'ai',
          content: data.message,
          timestamp: new Date().toISOString(),
          attachments: [],
        };

        setMessages(prev => [...prev, aiMessage]);
        setLastResponse(data);

        setWizardState(prev => prev ? {
          ...prev,
          extracted: data.state?.extracted || prev.extracted,
          remaining: data.state?.remaining || prev.remaining,
          currentField: data.state?.currentField || null,
          progress: data.state?.progress || 0,
          sessionId: data.sessionId || prev.sessionId,
          suggestedLawyers: data.suggestedLawyers || [],
          action: data.action || 'continue',
        } : null);

        setShowSuggestions(true);
      }
    } catch {
      setError(t('errors.sendFailed' as any));
    } finally {
      setSending(false);
    }
  }, [input, user, wizardState, t]);

  const handleSend = useCallback(() => {
    if (mode === 'wizard') {
      handleSendWizard();
    } else {
      handleSendGeneral();
    }
  }, [mode, handleSendWizard, handleSendGeneral]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sending && input.trim()) {
        handleSend();
      }
    }
  }, [handleSend, sending, input]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, []);

  const resumeSession = useCallback((session: AutomationSession) => {
    setMode('wizard');
    setWizardState({
      templateId: session.templateId,
      templateName: session.templateName,
      extracted: session.sessionState?.extracted as Record<string, string> || {},
      remaining: session.sessionState?.remaining || [],
      currentField: session.sessionState?.currentField || null,
      progress: session.progress,
      sessionId: session.id,
      suggestedLawyers: [],
      action: 'continue',
    });
    setMessages([]);
    setChatId(null);
    setActiveTab('chat');
    setError(null);
  }, []);

  const resumeChat = useCallback((chat: { id: string; title: string }) => {
    setMode('general');
    setChatId(chat.id);
    setWizardState(null);
    setMessages([]);
    setActiveTab('chat');
    setError(null);
    refresh();
  }, [refresh]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await axios.post('/api/db/write', {
        data: {
          ...data,
          automations: data?.automations?.filter(a => a.id !== sessionId) || [],
        },
        lastModified: new Date().toISOString(),
      });
      refresh();
    } catch {
      setError(t('errors.deleteFailed' as any));
    }
  }, [data, refresh, t]);

  const deleteChat = useCallback(async (chatId: string) => {
    try {
      await axios.post('/api/db/write', {
        data: {
          ...data,
          aiChats: data?.aiChats?.filter(c => c.id !== chatId) || [],
        },
        lastModified: new Date().toISOString(),
      });
      if (chatId === chatId) {
        setChatId(null);
        setMessages([]);
      }
      refresh();
    } catch {
      setError(t('errors.deleteFailed' as any));
    }
  }, [data, refresh, t]);

  const exitWizard = useCallback(() => {
    setMode('general');
    setWizardState(null);
    setMessages([]);
    setChatId(null);
  }, []);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <FileImage className="w-3 h-3" />;
    if (type === 'application/pdf') return <File className="w-3 h-3" />;
    return <FileText className="w-3 h-3" />;
  };

  const currentFieldQuestion = useMemo(() => {
    if (!wizardState || !data?.templates) return null;
    const template = data.templates.find(t => t.id === wizardState.templateId);
    if (!template?.aiConfig?.fieldQuestions) return null;
    return template.aiConfig.fieldQuestions.find(fq => fq.fieldKey === wizardState.currentField);
  }, [wizardState, data]);

  if (syncLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full md:h-auto">
      {/* Tab Bar */}
      <div className="flex items-center border-b border-navy-800 bg-navy-900 flex-shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 min-h-[48px] text-base font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 relative ${
              activeTab === tab.key ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`
            }
            aria-label={t(tab.labelKey as any)}

            aria-selected={activeTab === tab.key}
            role="tab"
          >
            {tab.icon}
            <span className="hidden sm:inline">{t(tab.labelKey as any)}</span>
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-emerald-400 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* CHAT TAB */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Wizard Header */}
            {mode === 'wizard' && wizardState && (
              <div className="bg-navy-800/80 border-b border-navy-700 p-3 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={exitWizard}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-700 flex-shrink-0 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      aria-label="Exit wizard"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{wizardState.templateName}</p>
                      <p className="text-xs text-slate-500">
                        {wizardState.remaining.length > 0
                          ? `${wizardState.remaining.length} fields remaining`
                          : 'All fields collected'
                        }
                      </p>
                    </div>
                  </div>
                  {wizardState.action === 'complete' && (
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-medium flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      Complete
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-navy-900 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${wizardState.progress}%` }}
                  />
                </div>

                {/* Extracted Fields */}
                {Object.keys(wizardState.extracted).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(wizardState.extracted).map(([key, value]) => (
                      <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md text-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="truncate max-w-32">{key}: {String(value).slice(0, 20)}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Current Field Hint */}
                {currentFieldQuestion && wizardState.currentField && (
                  <div className="mt-2 p-2 bg-navy-900 rounded-lg border border-navy-700">
                    <p className="text-xs text-slate-400">
                      <span className="text-emerald-400 font-medium">Current:</span> {currentFieldQuestion.aiQuestion}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && mode === 'general' && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  {/* AI Status Badge */}
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono mb-4 ${
                    hasApiKeyInDb
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      : 'bg-red-500/10 border border-red-500/30 text-red-400'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      hasApiKeyInDb ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                    }`} />
                    <span>
                      {hasApiKeyInDb
                        ? `LIVE API | ${configuredModel}`
                        : 'NO API KEY IN DB'}
                    </span>
                  </div>

                  <Sparkles className="w-16 h-16 text-slate-700 mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">{t('user.chat.title' as any)}</h3>
                  <p className="text-slate-500 text-sm max-w-sm">{t('chat.wizard.welcomeSubtitle' as any)}</p>

                  {/* Quick Suggestions */}
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                    {[
                      { key: 'chat.suggestions.contract', msg: t('chat.suggestions.contract' as any) },
                      { key: 'chat.suggestions.dispute', msg: t('chat.suggestions.dispute' as any) },
                      { key: 'chat.suggestions.property', msg: t('chat.suggestions.property' as any) },
                      { key: 'chat.suggestions.business', msg: t('chat.suggestions.business' as any) },
                    ].map(suggestion => (
                      <button
                        key={suggestion.key}
                        type="button"
                        onClick={() => { setInput(suggestion.msg); inputRef.current?.focus(); }}
                        className="px-4 py-3 bg-navy-800 hover:bg-navy-700 border border-navy-700 hover:border-emerald-500/30 rounded-xl text-sm text-slate-300 hover:text-white transition-all min-h-[48px] text-left focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {suggestion.msg}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.length === 0 && mode === 'wizard' && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <FileText className="w-16 h-16 text-slate-700 mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">Document Assistant</h3>
                  <p className="text-slate-500 text-sm">
                    {wizardState ? `Filling out: ${wizardState.templateName}` : 'Select a session to continue'}
                  </p>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}
                >
                  {msg.role === 'system' ? (
                    <div className="max-w-md px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm text-center">
                      {msg.content}
                    </div>
                  ) : (
                    <div className={`max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                      <div
                        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-emerald-600 text-white rounded-br-md'
                            : 'bg-navy-800 text-slate-200 rounded-bl-md border border-navy-700'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">
                          {msg.role === 'ai' ? (
                            <MarkdownRenderer content={msg.content} />
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          )}
                        </div>

                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {msg.attachments.map((filename, i) => (
                              <a
                                key={i}
                                href={`/uploads/${filename}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/20 rounded-lg text-xs hover:bg-black/30 transition-colors min-h-[36px]"
                              >
                                <FileText className="w-3 h-3" />
                                <span className="truncate max-w-32">{filename}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className={`text-xs text-slate-600 mt-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing Indicator */}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-navy-800 border border-navy-700 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span className="text-sm text-slate-400">{t('chat.input.typing' as any)}</span>
                  </div>
                </div>
              )}

              {/* Lawyer Suggestions */}
              {wizardState?.suggestedLawyers && wizardState.suggestedLawyers.length > 0 && showSuggestions && (
                <div className="bg-navy-800/50 border border-navy-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-white">{t('chat.suggestions.title' as any)}</h4>
                    <button
                      type="button"
                      onClick={() => setShowSuggestions(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-700 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      aria-label="Dismiss suggestions"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
                    {wizardState.suggestedLawyers.map(lawyer => (
                      <div key={lawyer.id} className="flex-shrink-0 w-56 snap-start bg-navy-900 rounded-lg p-3 border border-navy-700">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center text-emerald-400 font-bold text-sm flex-shrink-0">
                            {lawyer.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate">{lawyer.name}</p>
                            <div className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                              <span className="text-xs text-white">{lawyer.rating.toFixed(1)}</span>
                              <span className="text-xs text-slate-500">• {Math.round(lawyer.score * 100)}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {lawyer.specializations.slice(0, 2).map(spec => (
                            <span key={spec} className="px-1.5 py-0.5 bg-navy-800 text-slate-400 text-[10px] rounded truncate max-w-24">{spec}</span>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/user/lawyers/${lawyer.id}`)}
                          className="w-full flex items-center justify-center gap-1 px-2 py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-xs min-h-[36px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>{t('user.lawyers.viewProfile' as any)}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Wizard Completion Actions */}
              {wizardState?.action === 'complete' && (
                <div className="flex justify-center">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/user/documents/new')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <FileText className="w-4 h-4" />
                      <span>{t('user.dashboard.createDocument' as any)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setWizardState(null); setMode('general'); setMessages([]); }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-navy-800 hover:bg-navy-700 text-slate-300 rounded-xl text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{t('chat.sessions.continueSession' as any)}</span>
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="w-8 h-8 flex items-center justify-center rounded text-red-400 hover:text-white min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Input Area */}
            <div className="border-t border-navy-800 bg-navy-900 p-3 flex-shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
              {/* Attachment Previews */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-navy-800 rounded-lg border border-navy-700">
                      {getFileIcon(att.type)}
                      <span className="text-xs text-slate-300 truncate max-w-32">{att.filename}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-red-400 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                        aria-label={`Remove ${att.filename}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                {/* Attach Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || uploading}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-navy-800 hover:bg-navy-700 disabled:opacity-50 text-slate-400 hover:text-emerald-400 transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label={t('chat.input.attachFile' as any)}
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  aria-hidden="true"
                />

                {/* Text Input */}
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      mode === 'wizard'
                        ? (currentFieldQuestion?.aiQuestion || t('chat.input.placeholder' as any))
                        : t('chat.input.placeholder' as any)
                    }
                    disabled={sending}
                    rows={1}
                    className="w-full px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none max-h-[120px] min-h-[44px] disabled:opacity-50"
                    aria-label={t('chat.input.placeholder' as any)}
                  />
                </div>

                {/* Send Button */}
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-800 disabled:text-slate-600 text-white transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label={t('chat.input.send' as any)}
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>

              {/* Disclaimer */}
              <p className="text-center text-xs text-slate-600 mt-2">
                AI may produce inaccurate information. Verify important details.
              </p>
            </div>

            {/* Debug Panel */}
            <div className="border-t border-navy-800 bg-navy-900 flex-shrink-0">
              <button
                type="button"
                onClick={() => setDebugOpen(!debugOpen)}
                className="w-full flex items-center justify-between px-4 py-2 min-h-[40px] text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                aria-expanded={debugOpen}
              >
                <span className="text-xs font-mono">Debug</span>
                {debugOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {debugOpen && (
                <div className="px-4 py-3 bg-navy-800 border-t border-navy-700 overflow-x-auto">
                  {/* AI Config Status */}
                  <div className="mb-3 p-2 rounded bg-navy-900 border border-navy-700">
                    <pre className="text-xs text-slate-400 font-mono">
                      {JSON.stringify({
                        configuredModel: configuredModel,
                        hasApiKeyInDb: hasApiKeyInDb,
                        usesEnvKey: 'Server reads OPENAI_API_KEY from .env file',
                      }, null, 2)}
                    </pre>
                  </div>
                  {lastResponse && (
                    <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap">
                      {JSON.stringify({
                        response: {
                          tokens: lastResponse.tokens,
                          latency: lastResponse.latency,
                          model: lastResponse.model,
                          action: lastResponse.action,
                          progress: (lastResponse.state as any)?.progress,
                        },
                      }, null, 2)}
                    </pre>
                  )}
                  {!lastResponse && <p className="text-xs text-slate-600">Send a message to see response debug info</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SESSIONS TAB */}
        {activeTab === 'sessions' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {sessions.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-400 font-medium">{t('common.misc.noData' as any)}</p>
                <p className="text-slate-500 text-sm mt-1">{t('chat.history.noHistory' as any)}</p>
              </div>
            ) : (
              sessions.map(session => (
                <div key={session.id} className="bg-navy-900 border border-navy-800 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-white truncate">{session.templateName}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(session.updatedAt)}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${
                      session.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                      session.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-slate-500/10 text-slate-400'
                    }`}>
                      {session.status}
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="w-full h-1.5 bg-navy-800 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${session.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{session.progress}% complete</p>

                  <div className="flex gap-2">
                    {session.status !== 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => resumeSession(session)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <Play className="w-4 h-4" />
                        <span>{t('chat.sessions.continueSession' as any)}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteSession(session.id)}
                      className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label="Delete session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {aiChats.length === 0 ? (
              <div className="text-center py-16">
                <History className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <p className="text-slate-400 font-medium">{t('common.misc.noData' as any)}</p>
                <p className="text-slate-500 text-sm mt-1">{t('chat.history.noHistory' as any)}</p>
              </div>
            ) : (
              aiChats.map(chat => {
                const lastMsg = chat.messages[chat.messages.length - 1];
                return (
                  <div key={chat.id} className="bg-navy-900 border border-navy-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-white truncate">{chat.title}</h3>
                        {lastMsg && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {lastMsg.role === 'user' ? 'You: ' : 'AI: '}{lastMsg.content}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-slate-600 flex-shrink-0">{formatDate(chat.updatedAt)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{chat.messages.length} messages</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => resumeChat(chat)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-lg text-sm min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>{t('chat.sessions.continueSession' as any)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteChat(chat.id)}
                        className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-red-500"
                        aria-label="Delete chat"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}
