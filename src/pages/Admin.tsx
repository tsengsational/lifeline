import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Check, X, RefreshCw, LogIn, Loader2, Download } from 'lucide-react';

const mono: React.CSSProperties = { fontFamily: "'Share Tech Mono', monospace" };
const sans: React.CSSProperties = { fontFamily: "'DM Sans', sans-serif" };

export function Admin() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'managed'>('pending');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [downloadingIds, setDownloadingIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchMessages();
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchMessages();
    });
    return () => subscription.unsubscribe();
  }, [activeTab]);

  const fetchMessages = async () => {
    let query = supabase.from('messages')
      .select('id, audio_url, transcription, status, created_at')
      .order('created_at', { ascending: false });
    if (activeTab === 'pending') {
      query = query.eq('status', 'pending');
    } else {
      query = query.in('status', ['approved', 'inactive']);
    }
    const { data, error } = await query;
    if (!error) setMessages(data || []);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    const { error } = await supabase.from('messages').update({ status: 'approved' }).eq('id', id);
    if (!error) fetchMessages();
  };

  const handleToggleActive = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'approved' ? 'inactive' : 'approved';
    const { error } = await supabase.from('messages').update({ status: newStatus }).eq('id', id);
    if (!error) fetchMessages();
  };

  const handleReject = async (id: string, audioUrl: string) => {
    try {
      const fileName = audioUrl.split('/').pop();
      if (fileName) await supabase.storage.from('voicemails').remove([fileName]);
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (!error) fetchMessages();
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const handleDownload = async (id: string, audioUrl: string, createdAt: string) => {
    setDownloadingIds(prev => ({ ...prev, [id]: true }));
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = audioUrl.split('?')[0].split('.').pop() || 'wav';
      const dateStr = new Date(createdAt).toISOString().split('T')[0];
      a.download = `voicemail_${dateStr}_${id.slice(0, 6)}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading:', err);
      window.open(audioUrl, '_blank');
    } finally {
      setDownloadingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 style={{ color: '#00ff64', width: 32, height: 32, animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <form onSubmit={handleLogin} style={{
          background: 'linear-gradient(160deg, #181818 0%, #101010 100%)',
          border: '1px solid #2a2a2a',
          borderRadius: '16px',
          padding: '36px 32px',
          width: '100%',
          maxWidth: '340px',
          boxShadow: '0 40px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <LogIn style={{ color: '#00ff64', width: 20, height: 20 }} />
            <span style={{ ...mono, color: '#00ff64', fontSize: '18px', letterSpacing: '0.15em' }}>SYSTEM LOGIN</span>
          </div>

          {authError && (
            <div style={{ ...sans, background: 'rgba(255,64,64,0.1)', border: '1px solid rgba(255,64,64,0.3)', borderRadius: '6px', padding: '10px 12px', color: '#ff6060', fontSize: '12px' }}>
              {authError}
            </div>
          )}

          <input
            type="email"
            placeholder="ACCESS CODE (EMAIL)"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              ...mono, background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '6px',
              padding: '12px 14px', color: '#00ff64', fontSize: '12px', letterSpacing: '0.05em',
              outline: 'none',
            }}
          />
          <input
            type="password"
            placeholder="PASSWORD"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              ...mono, background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '6px',
              padding: '12px 14px', color: '#00ff64', fontSize: '12px', letterSpacing: '0.05em',
              outline: 'none',
            }}
          />
          <button type="submit" style={{
            ...mono, background: 'linear-gradient(180deg, #102a18 0%, #0a1410 100%)',
            border: '1px solid #050a08', borderRadius: '8px',
            padding: '14px', color: '#00ff64', fontSize: '13px', letterSpacing: '0.2em',
            cursor: 'pointer', marginTop: '4px',
            boxShadow: '0 4px 0 #050a08, 0 5px 8px rgba(0,0,0,0.6)',
          }}>
            AUTHENTICATE
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(160deg, #181818 0%, #101010 100%)',
        border: '1px solid #2a2a2a',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ ...{ fontFamily: "'Bebas Neue', sans-serif" }, fontSize: '28px', letterSpacing: '0.15em', color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text', backgroundImage: 'linear-gradient(180deg, #c8c8c8 0%, #888 100%)' }}>
              CALLBACK TERMINAL
            </div>
            <div style={{ ...sans, fontSize: '9px', color: '#444', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '2px' }}>Admin Message Management</div>
          </div>
          <button
            onClick={fetchMessages}
            style={{
              ...sans, display: 'flex', alignItems: 'center', gap: '6px',
              background: 'linear-gradient(180deg, #102a18 0%, #0a1410 100%)',
              border: '1px solid #050a08', borderRadius: '8px',
              padding: '8px 14px', color: '#00ff64', fontSize: '10px', fontWeight: 500,
              letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
              boxShadow: '0 3px 0 #050a08, 0 4px 6px rgba(0,0,0,0.5)',
            }}
          >
            <RefreshCw style={{ width: 12, height: 12 }} /> REFRESH
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', borderTop: '1px solid #1a1a1a', paddingTop: '16px' }}>
          {(['pending', 'managed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...mono, padding: '6px 16px', fontSize: '11px', letterSpacing: '0.1em',
                background: activeTab === tab ? 'rgba(0,255,100,0.08)' : 'transparent',
                border: 'none', borderBottom: `2px solid ${activeTab === tab ? '#00ff64' : 'transparent'}`,
                color: activeTab === tab ? '#00ff64' : '#555',
                cursor: 'pointer', transition: 'all 0.15s', textTransform: 'uppercase',
              }}
            >
              {tab === 'pending' ? 'PENDING APPROVAL' : 'MANAGED RECORDINGS'}
            </button>
          ))}
        </div>
      </div>

      {/* Message list */}
      {messages.length === 0 ? (
        <div style={{
          ...mono, textAlign: 'center', padding: '48px',
          background: 'rgba(0,0,0,0.3)', borderRadius: '10px',
          border: '1px solid #1a1a1a', color: '#333', fontSize: '16px', letterSpacing: '0.1em',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
          NO {activeTab.toUpperCase()} MESSAGES DETECTED.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.map(msg => (
            <div key={msg.id} style={{
              background: 'linear-gradient(160deg, #181818 0%, #101010 100%)',
              border: '1px solid #2a2a2a',
              borderRadius: '10px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column' as const,
              gap: '12px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ ...sans, fontSize: '10px', color: '#444', letterSpacing: '0.06em' }}>
                  {new Date(msg.created_at).toLocaleString()}
                </span>
                {activeTab === 'managed' && (
                  <span style={{
                    ...sans, fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em',
                    textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px',
                    background: msg.status === 'approved' ? 'rgba(0,255,100,0.1)' : 'rgba(255,200,0,0.1)',
                    color: msg.status === 'approved' ? '#00ff64' : '#ffcc00',
                    border: `1px solid ${msg.status === 'approved' ? 'rgba(0,255,100,0.2)' : 'rgba(255,200,0,0.2)'}`,
                  }}>
                    {msg.status === 'approved' ? 'Active' : 'Inactive'}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                <audio controls src={msg.audio_url} style={{ flex: 1, filter: 'invert(1) hue-rotate(180deg) contrast(0.8)' }} />
                <button
                  onClick={() => handleDownload(msg.id, msg.audio_url, msg.created_at)}
                  disabled={downloadingIds[msg.id]}
                  title="Download Audio"
                  className="hover:bg-[rgba(0,255,100,0.12)] active:scale-95 transition-all duration-200"
                  style={{
                    ...sans, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,255,100,0.06)', border: '1px solid rgba(0,255,100,0.15)',
                    borderRadius: '8px', padding: '12px', color: '#00ff64',
                    cursor: 'pointer', opacity: downloadingIds[msg.id] ? 0.6 : 1,
                    height: '40px', width: '40px', flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    outline: 'none',
                  }}
                >
                  {downloadingIds[msg.id] ? (
                    <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Download style={{ width: 16, height: 16 }} />
                  )}
                </button>
              </div>

              {msg.transcription ? (
                <div style={{
                  background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '6px',
                  padding: '10px 14px',
                }}>
                  <div style={{ ...sans, fontSize: '9px', color: '#333', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>Transcription</div>
                  <div style={{ ...mono, fontSize: '12px', color: '#00aa44', lineHeight: 1.6 }}>"{msg.transcription}"</div>
                </div>
              ) : (
                <div style={{ ...sans, fontSize: '9px', color: '#2a2a2a', textAlign: 'center', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px', border: '1px dashed #1a1a1a', borderRadius: '6px' }}>
                  No transcription captured
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                {activeTab === 'pending' ? (
                  <>
                    <button
                      onClick={() => handleApprove(msg.id)}
                      style={{
                        ...sans, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        background: 'linear-gradient(180deg, #102a18 0%, #0a1410 100%)',
                        border: '1px solid #050a08', borderRadius: '8px',
                        padding: '12px', color: '#00ff64', fontSize: '11px', fontWeight: 600,
                        letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
                        boxShadow: '0 3px 0 #050a08',
                      }}
                    >
                      <Check style={{ width: 14, height: 14 }} /> APPROVE
                    </button>
                    <button
                      onClick={() => handleReject(msg.id, msg.audio_url)}
                      style={{
                        ...sans, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        background: 'linear-gradient(180deg, #2a0808 0%, #1a0505 100%)',
                        border: '1px solid #0a0505', borderRadius: '8px',
                        padding: '12px', color: '#ff6060', fontSize: '11px', fontWeight: 600,
                        letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
                        boxShadow: '0 3px 0 #0a0505',
                      }}
                    >
                      <X style={{ width: 14, height: 14 }} /> REJECT
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleToggleActive(msg.id, msg.status)}
                      style={{
                        ...sans, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        background: msg.status === 'approved'
                          ? 'linear-gradient(180deg, #2a1a00 0%, #1a1000 100%)'
                          : 'linear-gradient(180deg, #102a18 0%, #0a1410 100%)',
                        border: `1px solid ${msg.status === 'approved' ? '#0a0800' : '#050a08'}`,
                        borderRadius: '8px', padding: '12px',
                        color: msg.status === 'approved' ? '#ffcc00' : '#00ff64',
                        fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em',
                        textTransform: 'uppercase', cursor: 'pointer',
                        boxShadow: `0 3px 0 ${msg.status === 'approved' ? '#0a0800' : '#050a08'}`,
                      }}
                    >
                      {msg.status === 'approved'
                        ? <><X style={{ width: 14, height: 14 }} /> DEACTIVATE</>
                        : <><Check style={{ width: 14, height: 14 }} /> REACTIVATE</>}
                    </button>
                    <button
                      onClick={() => handleReject(msg.id, msg.audio_url)}
                      title="Permanently Delete"
                      style={{
                        ...sans, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,64,64,0.06)', border: '1px solid rgba(255,64,64,0.15)',
                        borderRadius: '8px', padding: '12px 16px', color: '#ff4040',
                        cursor: 'pointer',
                      }}
                    >
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
