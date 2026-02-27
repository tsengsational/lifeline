import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Play, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Message() {
    const { id } = useParams<{ id: string }>();
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchMessage() {
            if (!id) return;

            const { data, error } = await supabase
                .from('messages')
                .select('audio_url, status')
                .eq('id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    setError("Message not found. It may have been deleted or rejected.");
                } else {
                    console.error("Error fetching message:", error);
                    setError("An error occurred while fetching this message.");
                }
            } else {
                // If they have the link, they can listen to it.
                setAudioUrl(data.audio_url);
            }

            setLoading(false);
        }

        fetchMessage();
    }, [id]);

    return (
        <>
            <div className="grain shared-message__grain"></div>
            <main className="plastic-body shared-message__shell w-[90%] max-w-[400px] p-8 flex flex-col items-center gap-6 border-2 border-[#b3a79a]" data-purpose="shared-message-shell">

                <section className="w-full flex justify-between items-start mb-4 shared-message__header" data-purpose="device-header">
                    <div className="bg-black p-3 rounded-lg border-4 border-[#8e857b] shadow-inner shared-message__display" data-purpose="status-display">
                        <div className="digital-font text-red-600 text-3xl leading-none tracking-widest uppercase shared-message__status">
                            {loading ? 'WAIT' : audioUrl ? 'PLAY' : 'ERR'}
                        </div>
                        <div className="text-[10px] text-red-900 font-bold uppercase mt-1 shared-message__status-label">Status</div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 p-2 bg-[#c0b5a8] rounded-full border border-[#a1978b] shared-message__speaker" data-purpose="voicemail-speaker">
                        {Array.from({ length: 16 }).map((_, i) => (
                            <div key={i} className="speaker-hole shared-message__speaker-hole"></div>
                        ))}
                    </div>
                </section>

                <div className="w-full text-left px-2 shared-message__brand">
                    <span className="font-serif italic font-black text-[#8e857b] text-xl opacity-60 shared-message__brand-text">SHARED MEMO</span>
                </div>

                <section className="w-full mt-4 flex flex-col gap-4 shared-message__controls" data-purpose="control-panel">
                    {loading ? (
                        <div className="text-[#1a1a1a] text-center font-bold digital-font text-2xl animate-pulse shared-message__loading">
                            RETRIEVING TAPE...
                        </div>
                    ) : error ? (
                        <div className="bg-[#cc3333] text-white p-4 rounded-xl shadow-inner border-2 border-black flex flex-col items-center gap-2 text-center shared-message__error">
                            <AlertCircle className="shared-message__error-icon" />
                            <p className="text-xs font-bold uppercase tracking-tighter shared-message__error-text">{error}</p>
                        </div>
                    ) : audioUrl ? (
                        <button
                            onClick={() => {
                                const audio = new Audio(audioUrl);
                                audio.play();
                            }}
                            className="tactile-button w-full bg-[#338833] text-white py-6 rounded-xl flex flex-col items-center justify-center gap-2 border-b-4 border-black shared-message__play-button"
                        >
                            <Play className="w-8 h-8 shared-message__play-icon" />
                            <span className="text-sm font-bold uppercase tracking-tighter shared-message__play-label">Play Message</span>
                        </button>
                    ) : null}

                    <Link to="/" className="tactile-button w-full bg-[#6b7280] text-white mt-4 py-4 rounded-xl flex items-center justify-center gap-2 border-b-4 border-black shared-message__back-link">
                        <ArrowLeft className="w-5 h-5 shared-message__back-icon" />
                        <span className="text-xs font-bold uppercase tracking-tighter shared-message__back-label">Record Your Own</span>
                    </Link>
                </section>

            </main>
        </>
    );
}
