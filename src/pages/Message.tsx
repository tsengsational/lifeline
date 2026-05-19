import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { playBeep } from '../lib/audioProcessing';

// ── Speaker Grille ─────────────────────────────────────────────────────────────
function SpeakerGrille() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 6px)', gap: '4px', padding: '4px' }}>
      {Array.from({ length: 25 }).map((_, i) => (
        <div key={i} style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #1a1a1a, #0a0a0a)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8), 0 0 0 0.5px rgba(255,255,255,0.04)',
        }} />
      ))}
    </div>
  );
}

// ── LCD Display ────────────────────────────────────────────────────────────────
function LCDStatus({ status }: { status: 'loading' | 'ready' | 'playing' | 'error' }) {
  const glow = 'rgba(0, 255, 100, 0.8)';
  const label = { loading: 'WAIT', ready: 'READY', playing: 'PLAY', error: 'ERR' }[status];
  const color = status === 'error' ? '#ff4040' : '#00ff64';
  const shadow = status === 'error' ? '0 0 12px rgba(255,64,64,0.8)' : `0 0 16px ${glow}, 0 0 30px rgba(0,255,100,0.3)`;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      background: '#060e07',
      borderRadius: '6px',
      padding: '16px 18px 14px',
      border: '2px solid #0a0a0a',
      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.9), inset 0 0 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
      overflow: 'hidden',
      fontFamily: "'Share Tech Mono', monospace",
    }}>
      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, height: '30%',
        background: 'linear-gradient(0deg, transparent, rgba(0,255,100,0.03) 50%, transparent)',
        animation: 'scanline 3s linear infinite',
        pointerEvents: 'none', zIndex: 9,
      }} />

      <div style={{ position: 'relative', zIndex: 12 }}>
        <span style={{ color, fontSize: '36px', letterSpacing: '0.08em', textShadow: shadow }}>
          {label}
        </span>
      </div>
      <div style={{ color: '#00aa44', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', textShadow: '0 0 6px rgba(0,200,80,0.5)', position: 'relative', zIndex: 12, marginTop: '4px' }}>
        {status === 'loading' ? 'RETRIEVING...' : status === 'error' ? 'NOT FOUND' : 'CALLBACK ARCHIVE'}
      </div>
    </div>
  );
}

// ── Hardware Button ────────────────────────────────────────────────────────────
type ButtonColor = 'default' | 'play' | 'gold';

const buttonColors = {
  default: { bg: '#2a2a2a', top: '#3a3a3a', border: '#1a1a1a', text: '#c8c8c8', glow: 'none' },
  play:    { bg: '#0a1410', top: '#102a18', border: '#050a08', text: '#00ff64', glow: '0 0 12px rgba(0,255,100,0.2)' },
  gold:    { bg: '#b8920a', top: '#f0c020', border: '#8a6a00', text: '#1a1000', glow: '0 0 16px rgba(240,192,0,0.4)' },
};

function HardwareButton({ label, icon, onClick, color = 'default' as ButtonColor, disabled = false, wide = false }: {
  label: string; icon: string; onClick?: () => void; color?: ButtonColor; disabled?: boolean; wide?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const c = buttonColors[color];

  return (
    <button
      style={{
        position: 'relative',
        width: '100%',
        padding: wide ? '16px 10px' : '14px 10px',
        background: pressed
          ? `linear-gradient(180deg, ${c.bg} 0%, ${c.top} 100%)`
          : `linear-gradient(180deg, ${c.top} 0%, ${c.bg} 100%)`,
        border: `1px solid ${c.border}`,
        borderRadius: '8px',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.06s ease',
        boxShadow: pressed
          ? `inset 0 2px 4px rgba(0,0,0,0.7), ${c.glow}`
          : `0 4px 0 ${c.border}, 0 5px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06), ${c.glow}`,
        transform: pressed ? 'translateY(3px)' : 'translateY(0)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px',
        userSelect: 'none',
      }}
      onPointerDown={() => { if (!disabled) setPressed(true); }}
      onPointerUp={() => { if (!disabled) { setPressed(false); onClick?.(); } }}
      onPointerLeave={() => setPressed(false)}
      disabled={disabled}
    >
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '7px',
        background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.012) 2px, rgba(255,255,255,0.012) 4px)',
        pointerEvents: 'none',
      }} />
      <span style={{ fontSize: '18px', color: c.text, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '0.14em', color: c.text, textTransform: 'uppercase', lineHeight: 1 }}>{label}</span>
    </button>
  );
}

// ── Message Page ───────────────────────────────────────────────────────────────
export function Message() {
  const { id } = useParams<{ id: string }>();
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleShare = () => {
    const text = `Listen to this message I found on Callback! ${window.location.href}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setAudioPlayer(null);

    async function fetchMessage() {
      if (!id) return;
      const { data, error } = await supabase
        .from('messages').select('audio_url, status').eq('id', id).single();
      if (error) {
        setError(error.code === 'PGRST116'
          ? 'Message not found. It may have been deleted or rejected.'
          : 'An error occurred while fetching this message.');
      } else {
        setAudioUrl(data.audio_url);
      }
      setLoading(false);
    }

    fetchMessage();
    return () => { audioPlayer?.pause(); };
  }, [id]);

  const handlePlay = () => {
    if (!audioUrl) return;
    if (isPlaying && audioPlayer) {
      audioPlayer.pause();
      setIsPlaying(false);
      return;
    }
    let player = audioPlayer;
    if (!player) {
      player = new Audio(audioUrl);
      player.crossOrigin = 'anonymous';
      player.onended = () => { setIsPlaying(false); playBeep(); };
      player.onerror = () => setIsPlaying(false);
      setAudioPlayer(player);
    } else if (player.src !== audioUrl) {
      player.src = audioUrl;
    }
    player.play().catch(() => setIsPlaying(false));
    setIsPlaying(true);
  };

  const handleNext = async () => {
    if (isFetchingNext) return;
    setIsFetchingNext(true);
    try {
      const { data, error } = await supabase.from('messages').select('id').eq('status', 'approved');
      if (error) throw error;
      
      let history = JSON.parse(sessionStorage.getItem('played_messages') || '[]');
      if (!history.includes(id)) {
        history.push(id);
      }

      let unplayed = (data || []).filter(m => !history.includes(m.id));

      if (unplayed.length === 0) {
        history = [id];
        unplayed = (data || []).filter(m => m.id !== id);
      }
      
      if (unplayed.length === 0) return;

      const nextMsg = unplayed[Math.floor(Math.random() * unplayed.length)];

      history.push(nextMsg.id);
      sessionStorage.setItem('played_messages', JSON.stringify(history));

      audioPlayer?.pause();
      setIsPlaying(false);
      navigate(`/message/${nextMsg.id}`);
    } catch (err) {
      console.error('Error fetching next message:', err);
    } finally {
      setIsFetchingNext(false);
    }
  };

  const lcdStatus = loading ? 'loading' : error ? 'error' : isPlaying ? 'playing' : 'ready';

  return (
    <>
      <div className="grain" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '40px 20px' }}>
        <div style={{
          position: 'relative',
          width: '300px',
          background: 'linear-gradient(160deg, #2e2e2e 0%, #1c1c1c 40%, #141414 70%, #1e1e1e 100%)',
          borderRadius: '36px',
          padding: '30px 28px 32px',
          boxShadow: `
            0 60px 100px rgba(0,0,0,0.9),
            0 30px 50px rgba(0,0,0,0.65),
            0 10px 20px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(255,255,255,0.1),
            inset 0 -2px 0 rgba(0,0,0,0.6),
            inset 2px 0 0 rgba(255,255,255,0.05),
            inset -2px 0 0 rgba(0,0,0,0.4)
          `,
          animation: 'fadeIn 0.5s ease',
        }}>
          {/* Left edge highlight */}
          <div style={{
            position: 'absolute', top: '20px', bottom: '20px', left: '1px', width: '3px',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 50%, transparent 100%)',
            borderRadius: '2px',
          }} />

          {/* Brand strip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: '22px', letterSpacing: '0.12em',
                color: 'transparent', backgroundClip: 'text', WebkitBackgroundClip: 'text',
                backgroundImage: 'linear-gradient(180deg, #c8c8c8 0%, #888 100%)', lineHeight: 1,
              }}>CALLBACK</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '8px', color: '#555', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '1px' }}>
                Leave a Mess at the Beep
              </div>
            </div>
            <SpeakerGrille />
          </div>

          {/* LCD bezel */}
          <div style={{
            background: '#0a0a0a', borderRadius: '10px', padding: '6px',
            boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.9), inset 0 1px 3px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.05)',
            marginBottom: '4px',
          }}>
            <LCDStatus status={lcdStatus} />
          </div>

          {/* Error text */}
          {error && (
            <div style={{ textAlign: 'center', fontFamily: "'DM Sans', sans-serif", fontSize: '9px', color: '#ff4040', letterSpacing: '0.08em', margin: '8px 0 0', lineHeight: 1.4 }}>
              {error}
            </div>
          )}

          {/* Divider */}
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #333, transparent)', margin: '14px 0 16px' }} />

          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {!error && (
              <HardwareButton
                label={isPlaying ? 'Pause' : (loading ? 'Loading…' : 'Play Message')}
                icon={isPlaying ? '■' : '▶'}
                color="play"
                onClick={handlePlay}
                disabled={loading || !audioUrl}
              />
            )}

            <HardwareButton
              label={isFetchingNext ? 'Searching…' : 'Next Message'}
              icon="⏭"
              color="gold"
              onClick={handleNext}
              disabled={isFetchingNext}
              wide
            />

            {!error && (
              <HardwareButton
                label={copied ? 'Copied!' : 'Share Message'}
                icon="🔗"
                color="default"
                onClick={handleShare}
                disabled={loading || !audioUrl}
              />
            )}

            <Link to="/" style={{ textDecoration: 'none' }}>
              <HardwareButton
                label="Record Your Own"
                icon="←"
                color="default"
              />
            </Link>
          </div>

          {/* Bottom divider */}
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #2a2a2a, transparent)', margin: '20px 0 0' }} />

          {/* Bottom nub */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
            <div style={{
              width: '40px', height: '8px', borderRadius: '4px',
              background: 'linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.04)',
            }} />
          </div>
        </div>
      </div>
    </>
  );
}
