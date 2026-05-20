import { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { applyLoFiFilter, playBeep } from '../lib/audioProcessing';
import { supabase } from '../lib/supabase';

// ── Utility ───────────────────────────────────────────────────────────────────
function formatTime(secs: number) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(Math.floor(secs % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

// ── LCD Display ───────────────────────────────────────────────────────────────
interface LCDDisplayProps {
  messageCount: number;
  recordingTime: number;
  isRecording: boolean;
  isPlaying: boolean;
  playTime: number;
  hasRecording: boolean;
  statusMsg: string;
}

function LCDDisplay({ messageCount, recordingTime, isRecording, isPlaying, playTime, hasRecording, statusMsg }: LCDDisplayProps) {
  const [clockTime, setClockTime] = useState('');
  const [colonOn, setColonOn] = useState(true);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setClockTime(`${h} ${m}`);
      setColonOn(now.getSeconds() % 2 === 0);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);

  const glow = 'rgba(0, 255, 100, 0.8)';

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
      {/* Scanline overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)',
      }} />
      {/* Moving scanline */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: '30%',
        background: 'linear-gradient(0deg, transparent, rgba(0,255,100,0.03) 50%, transparent)',
        animation: 'scanline 3s linear infinite',
        pointerEvents: 'none', zIndex: 9,
      }} />
      {/* Reflection */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
        pointerEvents: 'none', zIndex: 11, borderRadius: '4px',
      }} />

      {/* Time / status line */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px', position: 'relative', zIndex: 12 }}>
        {isRecording ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
            <span style={{ color: '#ff4040', fontSize: '11px', letterSpacing: '0.1em', textShadow: '0 0 8px #ff4040', animation: 'record-pulse 0.8s ease-in-out infinite' }}>● REC</span>
            <span style={{ color: '#00ff64', fontSize: '28px', letterSpacing: '0.08em', textShadow: `0 0 12px ${glow}` }}>{formatTime(recordingTime)}</span>
          </div>
        ) : isPlaying ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
            <span style={{ color: '#00ff64', fontSize: '11px', letterSpacing: '0.1em', textShadow: `0 0 8px ${glow}` }}>▶ PLAY</span>
            <span style={{ color: '#00ff64', fontSize: '28px', letterSpacing: '0.08em', textShadow: `0 0 12px ${glow}` }}>{formatTime(playTime)}</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <span style={{ color: '#00ff64', fontSize: '36px', letterSpacing: '0.05em', textShadow: `0 0 16px ${glow}, 0 0 30px rgba(0,255,100,0.3)` }}>
              {clockTime.split(' ')[0]}
            </span>
            <span style={{
              color: colonOn ? '#00ff64' : '#001808',
              fontSize: '32px', width: '14px', textAlign: 'center', lineHeight: 1,
              textShadow: colonOn ? `0 0 18px ${glow}, 0 0 8px ${glow}` : 'none',
              transition: 'color 0.05s, text-shadow 0.05s',
              display: 'inline-block', marginBottom: '2px', flexShrink: 0,
            }}>:</span>
            <span style={{ color: '#00ff64', fontSize: '36px', letterSpacing: '0.05em', textShadow: `0 0 16px ${glow}, 0 0 30px rgba(0,255,100,0.3)` }}>
              {clockTime.split(' ')[1]}
            </span>
          </div>
        )}
      </div>

      {/* Bottom info row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 12 }}>
        <span style={{ color: '#00aa44', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', textShadow: '0 0 6px rgba(0,200,80,0.5)' }}>
          MESSAGES: {String(messageCount).padStart(2, '0')}
        </span>
        {statusMsg && (
          <span style={{ color: '#00aa44', fontSize: '10px', letterSpacing: '0.08em', textShadow: '0 0 6px rgba(0,200,80,0.5)' }}>
            {statusMsg}
          </span>
        )}
        {hasRecording && !statusMsg && (
          <span style={{ color: '#ff8040', fontSize: '10px', letterSpacing: '0.08em', textShadow: '0 0 6px rgba(255,128,0,0.5)' }}>
            READY
          </span>
        )}
      </div>

      {/* Waveform when recording or playing */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginTop: '6px', height: '16px', position: 'relative', zIndex: 12, visibility: (isRecording || isPlaying) ? 'visible' : 'hidden' }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{
            width: '3px',
            background: '#00ff64',
            borderRadius: '1px',
            boxShadow: '0 0 4px rgba(0,255,100,0.6)',
            animationName: 'waveform',
            animationDuration: `${0.3 + (i * 0.037 % 0.5)}s`,
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDelay: `${i * 0.04}s`,
            height: '100%',
            transformOrigin: 'bottom',
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Hardware Button ────────────────────────────────────────────────────────────
type ButtonColor = 'default' | 'record' | 'play' | 'save';

interface HardwareButtonProps {
  label: string;
  icon: string;
  onClick?: () => void;
  color?: ButtonColor;
  disabled?: boolean;
}

const buttonColors: Record<ButtonColor, { bg: string; top: string; border: string; text: string; glow: string }> = {
  default: { bg: '#2a2a2a', top: '#3a3a3a', border: '#1a1a1a', text: '#c8c8c8', glow: 'none' },
  record: { bg: '#1a0a0a', top: '#3a1010', border: '#0a0505', text: '#ff6060', glow: '0 0 12px rgba(255,60,60,0.3)' },
  play: { bg: '#0a1410', top: '#102a18', border: '#050a08', text: '#00ff64', glow: '0 0 12px rgba(0,255,100,0.2)' },
  save: { bg: '#0a0e1a', top: '#101830', border: '#050810', text: '#6080ff', glow: '0 0 12px rgba(80,120,255,0.2)' },
};

function HardwareButton({ label, icon, onClick, color = 'default', disabled = false }: HardwareButtonProps) {
  const [pressed, setPressed] = useState(false);
  const c = buttonColors[color];

  return (
    <button
      style={{
        position: 'relative',
        width: '100%',
        padding: '14px 10px',
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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
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

// ── Sticky Note ────────────────────────────────────────────────────────────────
function StickyNote({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        top: '-18px',
        right: '-22px',
        width: '88px',
        background: 'linear-gradient(145deg, #f5e97a, #e8d555)',
        borderRadius: '2px',
        padding: '10px 10px 14px',
        transform: 'rotate(4deg)',
        cursor: 'pointer',
        zIndex: 20,
        boxShadow: '2px 4px 12px rgba(0,0,0,0.45), inset 0 -2px 4px rgba(0,0,0,0.08)',
        animation: 'stickyDrop 0.5s ease-out 0.3s both',
        userSelect: 'none',
      }}
    >
      <div style={{
        position: 'absolute', top: '-6px', left: '50%', transform: 'translateX(-50%)',
        width: '30px', height: '12px',
        background: 'rgba(200,220,255,0.45)',
        borderRadius: '2px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', fontWeight: 700, color: '#2a1a00', marginBottom: '3px', letterSpacing: '0.02em' }}>Read Me!</div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '8px', fontWeight: 400, color: '#4a3000', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.4 }}>Instructions</div>
    </div>
  );
}

// ── Instructions Modal ─────────────────────────────────────────────────────────
function InstructionsModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background: 'linear-gradient(160deg, #f5e97a 0%, #e8d555 100%)',
        borderRadius: '4px',
        padding: '32px 36px',
        maxWidth: '340px',
        width: '90%',
        boxShadow: '4px 8px 40px rgba(0,0,0,0.6)',
        transform: 'rotate(-1deg)',
        position: 'relative',
        animation: 'fadeIn 0.25s ease',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', width: '60px', height: '18px', background: 'rgba(200,220,255,0.45)', borderRadius: '2px', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
        <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '22px', fontWeight: 700, color: '#1a0e00', marginBottom: '16px' }}>Instructions</h2>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#2a1a00', lineHeight: 1.8 }}>
          <p style={{ marginBottom: '10px' }}>
            Have you ever wanted to say something to someone, but never got the chance? This is a collective voicemail box for the things we wish we said.
          </p>
          <p style={{ marginBottom: '10px' }}><strong>● RECORD</strong> — Press to capture a new voicemail. Press again to stop.</p>
          <p style={{ marginBottom: '10px' }}><strong>▶ PLAY</strong> — Preview your recording, or play a random message from the archive.</p>
          <p style={{ marginBottom: '10px' }}><strong>↑ SAVE</strong> — Upload your message to the archive.</p>
          <p style={{ marginBottom: '10px' }}><strong>✕ CLEAR</strong> — Discard your current recording.</p>
          <p style={{ marginBottom: '10px' }}><strong>BUY TICKETS</strong> — Purchase tickets to the live performance.</p>
          <p style={{ color: '#4a3000', fontSize: '11px', marginTop: '14px' }}>* Your browser will ask for microphone permission when you first record.</p>
        </div>
        <button onClick={onClose} style={{
          marginTop: '20px',
          background: '#1a0e00',
          color: '#f5e97a',
          border: 'none',
          borderRadius: '4px',
          padding: '8px 20px',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}>Got it</button>
      </div>
    </div>
  );
}

// ── Ticket Button ──────────────────────────────────────────────────────────────
function TicketButton() {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      role="button"
      style={{
        width: '100%',
        background: pressed
          ? 'linear-gradient(180deg, #c09000 0%, #d4a010 100%)'
          : 'linear-gradient(180deg, #f5c828 0%, #e0aa10 60%, #c89000 100%)',
        border: '1px solid #7a6000',
        borderRadius: '10px',
        cursor: 'pointer',
        boxShadow: pressed
          ? 'inset 0 3px 8px rgba(0,0,0,0.4), 0 2px 0 #5a4400'
          : 'inset 0 1px 0 rgba(255,255,255,0.35), 0 5px 0 #7a6000, 0 7px 10px rgba(0,0,0,0.5)',
        transform: pressed ? 'translateY(4px)' : 'translateY(0)',
        transition: 'transform 0.06s, box-shadow 0.06s',
        padding: '14px 16px',
        userSelect: 'none',
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => { setPressed(false); window.open('https://www.fluxtheatre.org/productions/fear-wonder', '_blank'); }}
      onPointerLeave={() => setPressed(false)}
    >
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', letterSpacing: '0.2em', color: '#1a0e00', lineHeight: '1.1', textAlign: 'center' }}>
        GET TICKETS
      </div>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '9px', fontWeight: 500, letterSpacing: '0.14em', color: '#3a2400', textTransform: 'uppercase', lineHeight: '1.2', textAlign: 'center', marginTop: '4px' }}>
        For Fear & Wonder
      </div>
    </div>
  );
}

// ── Share URL Banner ───────────────────────────────────────────────────────────
function ShareBanner({ url, onDismiss }: { url: string; onDismiss: () => void }) {
  return (
    <div style={{
      background: 'linear-gradient(160deg, #f5e97a 0%, #e8d555 100%)',
      borderRadius: '6px',
      padding: '10px 14px',
      marginBottom: '10px',
      fontFamily: "'DM Sans', sans-serif",
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      position: 'relative',
    }}>
      <button onClick={onDismiss} style={{ position: 'absolute', top: '6px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#4a3000', fontSize: '14px', fontWeight: 700 }}>×</button>
      <div style={{ fontSize: '10px', fontWeight: 700, color: '#2a1a00', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Message submitted!</div>
      <a href={url} style={{ fontSize: '10px', color: '#4a3000', wordBreak: 'break-all', textDecoration: 'underline' }}>{url}</a>
      <div style={{ fontSize: '10px', color: '#4a3000', marginTop: '6px', lineHeight: 1.4 }}>
        Your recording has been submitted and will be added to the app pending review.
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export function Home() {
  const { isRecording, audioUrl, audioBlob, error, startRecording, stopRecording, clearRecording } = useAudioRecorder();

  const [isPlaying, setIsPlaying] = useState(false);
  const [playTime, setPlayTime] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [transcription, setTranscription] = useState('');
  const [recognition, setRecognition] = useState<any>(null);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showStatus = (msg: string, dur = 2500) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), dur);
  };

  // Fetch approved message count on mount
  useEffect(() => {
    supabase.from('messages').select('id', { count: 'exact', head: true }).eq('status', 'approved')
      .then(({ count }) => { if (count !== null) setMessageCount(count); });
  }, []);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      recordTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } else {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    }
    return () => { if (recordTimerRef.current) clearInterval(recordTimerRef.current); };
  }, [isRecording]);

  // Speech recognition
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e: any) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
      }
      if (final) setTranscription(p => p + ' ' + final);
    };
    setRecognition(rec);
  }, []);

  useEffect(() => {
    if (!recognition) return;
    if (isRecording) {
      setTranscription('');
      try { recognition.start(); } catch (_) { }
    } else {
      try { recognition.stop(); } catch (_) { }
    }
  }, [isRecording, recognition]);

  // Stop audio when recording starts or recording is cleared
  useEffect(() => {
    if (isRecording || !audioUrl) {
      audioPlayerRef.current?.pause();
      audioPlayerRef.current = null;
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      setIsPlaying(false);
      setPlayTime(0);
    }
  }, [isRecording, audioUrl]);

  const handleRecord = useCallback(() => {
    if (isRecording) {
      stopRecording();
      playBeep();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handlePlay = useCallback(async () => {
    // If we have a local recording, preview it
    if (audioUrl) {
      if (isPlaying) {
        audioPlayerRef.current?.pause();
        if (playTimerRef.current) clearInterval(playTimerRef.current);
        setIsPlaying(false);
        setPlayTime(0);
        return;
      }
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = new Audio(audioUrl);
        audioPlayerRef.current.crossOrigin = 'anonymous';
        audioPlayerRef.current.onended = () => {
          if (playTimerRef.current) clearInterval(playTimerRef.current);
          setIsPlaying(false);
          setPlayTime(0);
          playBeep();
        };
      }
      audioPlayerRef.current.play();
      setIsPlaying(true);
      setPlayTime(0);
      playTimerRef.current = setInterval(() => setPlayTime(t => t + 1), 1000);
      return;
    }

    // No local recording — play a random approved message
    setIsUploading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('messages').select('id').eq('status', 'approved');
      if (fetchError) throw fetchError;
      if (!data || data.length === 0) { showStatus('NO MESSAGES YET'); return; }
      let history = JSON.parse(sessionStorage.getItem('played_messages') || '[]');
      let unplayed = data.filter(m => !history.includes(m.id));

      if (unplayed.length === 0) {
        history = [];
        unplayed = data;
      }

      const randomMsg = unplayed[Math.floor(Math.random() * unplayed.length)];

      history.push(randomMsg.id);
      sessionStorage.setItem('played_messages', JSON.stringify(history));

      window.location.href = `/message/${randomMsg.id}`;
    } catch {
      showStatus('FETCH ERROR');
    } finally {
      setIsUploading(false);
    }
  }, [audioUrl, isPlaying]);

  const handleSave = useCallback(async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    try {
      const processed = await applyLoFiFilter(audioBlob);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.wav`;
      const { error: uploadError } = await supabase.storage
        .from('voicemails').upload(fileName, processed, { contentType: 'audio/wav' });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('voicemails').getPublicUrl(fileName);
      const messageId = crypto.randomUUID();
      const { error: insertError } = await supabase.from('messages').insert([{
        id: messageId,
        audio_url: urlData.publicUrl,
        transcription: transcription || null,
        status: 'pending',
      }]);
      if (insertError) throw insertError;

      setShareUrl(`${window.location.origin}/message/${messageId}`);
      clearRecording();
      setTranscription('');
      showStatus('SAVED!');
    } catch (err: any) {
      showStatus('SAVE FAILED');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  }, [audioBlob, transcription, clearRecording]);

  const handleClear = useCallback(() => {
    clearRecording();
    setTranscription('');
    setShareUrl(null);
    showStatus('CLEARED');
  }, [clearRecording]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (playTimerRef.current) clearInterval(playTimerRef.current);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    audioPlayerRef.current?.pause();
  }, []);

  const hasRecording = !!audioUrl;

  return (
    <>
      <div className="grain" />
      {showInstructions && <InstructionsModal onClose={() => setShowInstructions(false)} />}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '40px 20px',
      }}>
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

          <StickyNote onClick={() => setShowInstructions(true)} />

          {/* Brand strip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '26px',
                letterSpacing: '0.12em',
                color: 'transparent',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                backgroundImage: 'linear-gradient(180deg, #c8c8c8 0%, #888 100%)',
                lineHeight: 1,
              }}>CALLBACK</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '1rem', color: '#555', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '1px' }}>
                Leave a Mess at the Beep
              </div>
            </div>
            <SpeakerGrille />
          </div>

          {/* LCD bezel */}
          <div style={{
            background: '#0a0a0a',
            borderRadius: '10px',
            padding: '6px',
            boxShadow: 'inset 0 3px 8px rgba(0,0,0,0.9), inset 0 1px 3px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.05)',
            marginBottom: '4px',
          }}>
            <LCDDisplay
              messageCount={messageCount}
              recordingTime={recordingTime}
              isRecording={isRecording}
              isPlaying={isPlaying}
              playTime={playTime}
              hasRecording={hasRecording}
              statusMsg={statusMsg}
            />
          </div>

          {/* Error display */}
          {error && (
            <div style={{ textAlign: 'center', fontFamily: "'DM Sans', sans-serif", fontSize: '9px', color: '#ff4040', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '6px 0 0' }}>
              {error}
            </div>
          )}

          {/* Divider */}
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #333, transparent)', margin: '14px 0 16px' }} />

          {/* Share URL */}
          {shareUrl && <ShareBanner url={shareUrl} onDismiss={() => setShareUrl(null)} />}

          {/* Main buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <HardwareButton
              label={isRecording ? 'Stop' : 'Record'}
              icon={isRecording ? '■' : '●'}
              color="record"
              onClick={handleRecord}
              disabled={isUploading}
            />
            <HardwareButton
              label={isPlaying ? 'Stop' : (hasRecording ? 'Preview' : 'Play')}
              icon={isPlaying ? '■' : '▶'}
              color="play"
              onClick={handlePlay}
              disabled={isRecording || isUploading}
            />
          </div>

          {/* Secondary buttons — visible when a recording exists */}
          {hasRecording && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <HardwareButton
                label={isUploading ? 'Saving…' : 'Save'}
                icon="↑"
                color="save"
                onClick={handleSave}
                disabled={isUploading || isRecording}
              />
              <HardwareButton
                label="Clear"
                icon="✕"
                color="default"
                onClick={handleClear}
                disabled={isUploading || isRecording}
              />
            </div>
          )}

          {/* Bottom divider */}
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #2a2a2a, transparent)', margin: '4px 0 14px' }} />

          <TicketButton />

          {/* Bottom nub */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
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
