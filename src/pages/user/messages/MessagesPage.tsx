import { useState, useCallback, useMemo, useEffect, useRef, ChangeEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../../i18n/LanguageProvider';
import { useRealtimeSync } from '../../../hooks/useRealtimeSync';
import { useAuth } from '../../../hooks/useAuth';
import {
  ArrowLeft,
  Send,
  Paperclip,
  Loader2,
  MessageSquare,
  Search,
  UserCircle,
  X,
  FileText,
  FileImage,
  File,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface ConversationMessage {
  id: string;
  sender: 'user' | 'lawyer';
  content: string;
  timestamp: string;
  read: boolean;
  attachments: string[];
}

interface Conversation {
  id: string;
  userId: string;
  lawyerId: string;
  lawyerName?: string;
  messages: ConversationMessage[];
  unreadCount: { userId: number; lawyerId: number };
  createdAt: string;
  updatedAt: string;
}

interface AttachmentPreview {
  filename: string;
  url: string;
  type: string;
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function formatFullDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function MessagesPage(): JSX.Element {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { id: conversationId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const newLawyerId = searchParams.get('lawyerId');
  const { user } = useAuth();
  const { data, loading, refresh } = useRealtimeSync();

  const [search, setSearch] = useState<string>('');
  const [input, setInput] = useState<string>('');
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [creating, setCreating] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const conversations = useMemo((): Conversation[] => {
    if (!data?.conversations || !data?.lawyers || !user) return [];
    return data.conversations
      .filter(c => c.userId === user.userId || c.lawyerId === user.userId)
      .map(c => {
        const lawyer = data.lawyers.find(l => l.id === c.lawyerId);
        return {
          id: c.id,
          userId: c.userId,
          lawyerId: c.lawyerId,
          lawyerName: lawyer?.name || c.lawyerId.slice(0, 12),
          messages: c.messages,
          unreadCount: c.unreadCount,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [data, user]);

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase().trim();
    return conversations.filter(c =>
      c.lawyerName?.toLowerCase().includes(q) ||
      c.messages.some(m => m.content.toLowerCase().includes(q))
    );
  }, [conversations, search]);

  const activeConversation = useMemo(() => {
    if (!conversationId) return null;
    return conversations.find(c => c.id === conversationId) || null;
  }, [conversations, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  useEffect(() => {
    if (newLawyerId && user && !conversationId) {
      const existing = conversations.find(c => c.lawyerId === newLawyerId && c.userId === user.userId);
      if (existing) {
        navigate(`/user/messages/${existing.id}`, { replace: true });
      }
    }
  }, [newLawyerId, user, conversationId, conversations, navigate]);

  useEffect(() => {
    if (activeConversation && user) {
      const myUnread = activeConversation.userId === user.userId
        ? activeConversation.unreadCount.userId
        : activeConversation.unreadCount.lawyerId;

      if (myUnread > 0) {
        apiClient.post(`/api/conversations/${activeConversation.id}/read`, { userId: user.userId })
          .then(() => refresh())
          .catch(() => {});
      }
    }
  }, [activeConversation?.id, user]);

  const handleFileUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) continue;
        const formData = new FormData();
        formData.append('file', file);
        const response = await apiClient.post('/api/upload', formData, {
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
      setSendError(t('errors.uploadFailed' as any));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [t]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const getFileIcon = (type: string) => {
    if (type?.startsWith('image/')) return <FileImage className="w-3 h-3" />;
    if (type === 'application/pdf') return <File className="w-3 h-3" />;
    return <FileText className="w-3 h-3" />;
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || !user) return;
    if (creating) return;

    setSendError(null);
    const content = input.trim();
    const currentAttachments = [...attachments];

    if (activeConversation) {
      setSending(true);
      setInput('');
      setAttachments([]);

      try {
        await apiClient.post(`/api/conversations/${activeConversation.id}/message`, {
          userId: user.userId,
          content,
          attachments: currentAttachments.map(a => a.filename),
        });
        refresh();
      } catch {
        setSendError(t('errors.sendFailed' as any));
        setInput(content);
        setAttachments(currentAttachments);
      } finally {
        setSending(false);
      }
    } else if (newLawyerId) {
      setCreating(true);
      setInput('');
      setAttachments([]);

      try {
        const response = await apiClient.post('/api/conversations', {
          userId: user.userId,
          lawyerId: newLawyerId,
          context: null,
          content,
          attachments: currentAttachments.map(a => a.filename),
        });

        if (response.data.success) {
          navigate(`/user/messages/${response.data.data.conversationId}`, { replace: true });
          refresh();
        }
      } catch {
        setSendError(t('errors.sendFailed' as any));
        setInput(content);
        setAttachments(currentAttachments);
      } finally {
        setCreating(false);
      }
    }
  }, [input, attachments, user, activeConversation, newLawyerId, creating, t, navigate, refresh]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sending && !creating && input.trim()) {
        handleSend();
      }
    }
  }, [handleSend, sending, creating, input]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, []);

  // Chat View
  if (conversationId || newLawyerId) {
    const lawyer = data?.lawyers?.find(l => l.id === (activeConversation?.lawyerId || newLawyerId));
    const lawyerName = lawyer?.name || activeConversation?.lawyerName || 'Lawyer';
    const lawyerOnline = lawyer?.online || false;

    return (
      <div className="flex flex-col h-[calc(100vh-4rem-3rem)] md:h-[calc(100vh-4rem-5rem)]">
        {/* Chat Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-navy-900 border-b border-navy-800 flex-shrink-0">
          <button
            type="button"
            onClick={() => navigate('/user/messages')}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-navy-800 transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label={t('common.actions.back' as any)}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center flex-shrink-0">
            <UserCircle className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{lawyerName}</p>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${lawyerOnline ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <span className="text-xs text-slate-500">
                {lawyerOnline ? t('common.status.online' as any) : t('common.status.offline' as any)}
              </span>
            </div>
          </div>
          {lawyer && (
            <button
              type="button"
              onClick={() => navigate(`/user/lawyers/${lawyer.id}`)}
              className="w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-navy-800 transition-colors min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label={t('user.lawyers.viewProfile' as any)}
            >
              <ExternalLink className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeConversation?.messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[70%]`}>
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-md'
                      : 'bg-navy-800 text-slate-200 rounded-bl-md border border-navy-700'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
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
                <p className={`text-xs text-slate-600 mt-1 flex items-center gap-1 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                  {formatFullDate(msg.timestamp)}
                  {msg.sender === 'user' && msg.read && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                </p>
              </div>
            </div>
          ))}
          {(sending || creating) && (
            <div className="flex justify-start">
              <div className="bg-navy-800 border border-navy-700 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span className="text-sm text-slate-400">{t('chat.input.typing' as any)}</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Send Error */}
        {sendError && (
          <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <X className="w-4 h-4 flex-shrink-0" />
              <span>{sendError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSendError(null)}
              className="w-8 h-8 flex items-center justify-center rounded text-red-400 hover:text-white min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-navy-800 bg-navy-900 p-3 flex-shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-navy-800 rounded-lg border border-navy-700">
                  {getFileIcon(att.type)}
                  <span className="text-xs text-slate-300 truncate max-w-32">{att.filename}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-red-400 min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label={`Remove ${att.filename}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || creating || uploading}
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

            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={t('messages.chat.typeMessage' as any)}
              disabled={sending || creating}
              rows={1}
              className="flex-1 px-4 py-3 bg-navy-800 border border-navy-700 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none max-h-[120px] min-h-[44px] disabled:opacity-50"
              aria-label={t('messages.chat.typeMessage' as any)}
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={sending || creating || !input.trim()}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-navy-800 disabled:text-slate-600 text-white transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label={t('messages.chat.send' as any)}
            >
              {sending || creating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Conversation List View
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('user.messages.searchPlaceholder' as any)}
          className="w-full pl-12 pr-4 py-3 bg-navy-900 border border-navy-800 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[48px]"
          aria-label={t('user.messages.searchPlaceholder' as any)}
        />
      </div>

      {/* Conversations */}
      {filteredConversations.length === 0 ? (
        <div className="text-center py-16 bg-navy-900 border border-navy-800 rounded-xl">
          <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 font-medium">{t('user.messages.noConversations' as any)}</p>
          <p className="text-slate-500 text-sm mt-1">{t('user.messages.noConversationsSubtitle' as any)}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredConversations.map(conv => {
            const lastMsg = conv.messages[conv.messages.length - 1];
            const myUnread = conv.userId === user?.userId ? conv.unreadCount.userId : conv.unreadCount.lawyerId;

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => navigate(`/user/messages/${conv.id}`)}
                className="w-full text-left bg-navy-900 border border-navy-800 hover:border-navy-700 rounded-xl p-4 transition-all min-h-[72px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-600/20 flex items-center justify-center flex-shrink-0">
                    <UserCircle className="w-7 h-7 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-sm font-medium text-white truncate">{conv.lawyerName}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {myUnread > 0 && (
                          <span className="w-5 h-5 bg-emerald-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                            {myUnread > 9 ? '9+' : myUnread}
                          </span>
                        )}
                        <span className="text-xs text-slate-500">{formatDate(conv.updatedAt)}</span>
                      </div>
                    </div>
                    {lastMsg && (
                      <p className="text-xs text-slate-400 truncate">
                        {lastMsg.sender === 'user' ? 'You: ' : ''}{lastMsg.content}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
