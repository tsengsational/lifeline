import { useState, useEffect, useRef } from 'react';
import { Play, UploadCloud, Square, RotateCcw, Pause } from 'lucide-react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { applyLoFiFilter, playBeep } from '../lib/audioProcessing';
import { supabase } from '../lib/supabase';

export function Home() {
    const [time, setTime] = useState('');
    const [isBlinking, setIsBlinking] = useState(true);

    const {
        isRecording,
        audioUrl,
        audioBlob,
        error,
        startRecording,
        stopRecording,
        clearRecording
    } = useAudioRecorder();

    const [isUploading, setIsUploading] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [transcription, setTranscription] = useState('');
    const [recognition, setRecognition] = useState<any>(null);
    const [showInstructions, setShowInstructions] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    const handleUpload = async () => {
        if (!audioBlob) return;
        setIsUploading(true);

        try {
            // 1. Apply lo-fi filter
            const processedBlob = await applyLoFiFilter(audioBlob);

            // 2. Upload to Supabase Storage
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.wav`;
            const { error: uploadError } = await supabase.storage
                .from('voicemails')
                .upload(fileName, processedBlob, { contentType: 'audio/wav' });

            if (uploadError) throw uploadError;

            // 3. Get public URL
            const { data: publicUrlData } = supabase.storage
                .from('voicemails')
                .getPublicUrl(fileName);

            // 4. Insert into database
            const messageId = crypto.randomUUID();
            const { error: insertError } = await supabase
                .from('messages')
                .insert([{
                    id: messageId,
                    audio_url: publicUrlData.publicUrl,
                    transcription: transcription || null,
                    status: 'pending'
                }]);

            if (insertError) throw insertError;

            setShareUrl(`${window.location.origin}/message/${messageId}`);

            // Success: Reset for next recording
            clearRecording();
            setTranscription('');
        } catch (err: any) {
            console.error('Upload failed:', err);
            alert('Upload failed: ' + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handlePlayRandom = async () => {
        setIsUploading(true); // Re-using state just for loading feedback
        try {
            // Fetch all approved messages
            const { data, error } = await supabase
                .from('messages')
                .select('id')
                .eq('status', 'approved');

            if (error) throw error;

            if (!data || data.length === 0) {
                alert("No approved messages available yet!");
                return;
            }

            // Pick a random message
            const randomMsg = data[Math.floor(Math.random() * data.length)];
            window.location.href = `/message/${randomMsg.id}`;
        } catch (err) {
            console.error("Error fetching random message:", err);
            alert("Failed to fetch a random message.");
        } finally {
            setIsUploading(false);
        }
    };

    // Initialize Speech Recognition
    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const rec = new SpeechRecognition();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = 'en-US';

            rec.onresult = (event: any) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }
                if (finalTranscript) {
                    setTranscription(prev => prev + ' ' + finalTranscript);
                }
            };

            rec.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
            };

            setRecognition(rec);
        }
    }, []);

    // Start/Stop Speech Recognition when recording state changes
    useEffect(() => {
        if (isRecording && recognition) {
            setTranscription('');
            try {
                recognition.start();
            } catch (e) {
                console.error("Recognition start error:", e);
            }
        } else if (!isRecording && recognition) {
            try {
                recognition.stop();
            } catch (e) {
                // Ignore if already stopped
            }
        }
    }, [isRecording, recognition]);


    // Handle Preview Audio Toggle
    const handleTogglePreview = () => {
        if (!audioUrl) return;

        if (isPlaying) {
            audioPlayerRef.current?.pause();
            setIsPlaying(false);
        } else {
            if (!audioPlayerRef.current) {
                audioPlayerRef.current = new Audio(audioUrl);
                audioPlayerRef.current.crossOrigin = "anonymous";
                audioPlayerRef.current.onended = () => {
                    setIsPlaying(false);
                    playBeep(); // Play beep when playback reaches the end
                };
            }
            audioPlayerRef.current.play();
            setIsPlaying(true);
        }
    };

    // Stop audio if recording starts or recording is cleared
    useEffect(() => {
        if (isRecording || !audioUrl) {
            if (audioPlayerRef.current) {
                audioPlayerRef.current.pause();
                audioPlayerRef.current = null;
                setIsPlaying(false);
            }
        }
    }, [isRecording, audioUrl]);

    // Simple logic to keep the 90s digital clock updated
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            setTime(`${hours}:${minutes}`);
            setIsBlinking(new Date().getSeconds() % 2 === 0);
        };

        const intervalId = setInterval(updateClock, 1000);
        updateClock();

        return () => clearInterval(intervalId);
    }, []);

    return (
        <>
            <div className="grain answering-machine__grain"></div>


            {/* Instructions Modal */}
            {showInstructions && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 answering-machine__modal">
                    <div className="bg-[#ffffbf] p-8 max-w-md w-full shadow-2xl rotate-1 border-l-8 border-[#e6e600] relative answering-machine__modal-content">
                        <button
                            onClick={() => setShowInstructions(false)}
                            className="absolute top-2 right-4 text-2xl font-bold text-[#1a1a1a] hover:scale-110 transition-transform answering-machine__modal-close"
                        >
                            ×
                        </button>
                        <h2 className="text-2xl font-bold mb-4 font-handwriting text-[#1a1a1a]">Read Me!</h2>
                        <p className="font-handwriting leading-relaxed text-[#1a1a1a] text-lg">
                            Have you ever wanted to say something to someone, but never got the chance?
                            This is a collective voicemail box for the things we wish we said.
                            Leave a message for yourself from when you were a kid, or for the one that got away,
                            or a person you lost on the way. You can listen to messages others have left here.
                            Maybe you can pass them along to where they need to go...
                        </p>
                    </div>
                </div>
            )}

            {/* BEGIN: PhoneContainer */}
            <main className="plastic-body answering-machine__shell w-[90%] max-w-[400px] p-8 flex flex-col items-center gap-6 border-2 border-[#b3a79a] relative" data-purpose="answering-machine-shell">

                {/* Post-it Note - Positioned relative to the shell */}
                <button
                    onClick={() => setShowInstructions(true)}
                    className="answering-machine__post-it absolute -top-4 -right-8 rotate-12 bg-[#ffffbf] p-3 shadow-md border-l-2 border-[#e6e600] cursor-pointer hover:scale-105 transition-transform font-handwriting text-[#1a1a1a] z-40"
                >
                    <div className="text-lg font-bold tracking-tight">Read Me!</div>
                    <div className="text-[10px] uppercase opacity-50">instructions</div>
                </button>

                {/* BEGIN: TopSection - Display and Speaker */}
                <section className="w-full flex justify-between items-start mb-4 answering-machine__header" data-purpose="device-header">
                    {/* Digital Display Block */}
                    <div className="bg-black p-3 rounded-lg border-4 border-[#8e857b] shadow-inner answering-machine__display" data-purpose="status-display">
                        <div className="digital-font text-red-600 text-5xl leading-none tracking-widest answering-machine__clock" id="clock-display">
                            {time.slice(0, 2)}
                            <span className={isBlinking ? 'opacity-100' : 'opacity-0'}>:</span>
                            {time.slice(3)}
                        </div>
                        <div className="text-[10px] text-red-900 font-bold uppercase mt-1 answering-machine__message-count">Messages: 03</div>
                    </div>

                    {/* Speaker Grill */}
                    <div className="grid grid-cols-4 gap-2 p-2 bg-[#c0b5a8] rounded-full border border-[#a1978b] answering-machine__speaker" data-purpose="voicemail-speaker">
                        {Array.from({ length: 16 }).map((_, i) => (
                            <div key={i} className="speaker-hole answering-machine__speaker-hole"></div>
                        ))}
                    </div>
                </section>
                {/* END: TopSection */}

                {/* BEGIN: BrandLogo */}
                <div className="w-full text-left px-2 answering-machine__brand">
                    <span className="font-serif italic font-black text-[#8e857b] text-xl opacity-60 answering-machine__brand-text">MEMO-TONE 3000</span>
                </div>
                {/* END: BrandLogo */}

                {/* BEGIN: ButtonGrid */}
                <section className="grid grid-cols-2 gap-6 w-full mt-4 answering-machine__controls" data-purpose="control-panel">
                    {error && <div className="col-span-2 text-red-600 text-xs text-center answering-machine__error">{error}</div>}

                    {/* Record / Stop Button */}
                    <button
                        onClick={isRecording ? () => { stopRecording(); playBeep(); } : startRecording}
                        disabled={!!audioUrl && !isRecording}
                        className={`tactile-button answering-machine__button answering-machine__button--record text-white py-4 rounded-xl flex flex-col items-center justify-center gap-1 border-b-4 border-black ${isRecording ? 'bg-red-800' : (audioUrl ? 'bg-gray-400 opacity-50' : 'bg-[#444]')}`}
                        data-purpose="record-action"
                    >
                        {isRecording ? (
                            <>
                                <Square className="w-5 h-5 text-red-500 animate-pulse answering-machine__button-icon answering-machine__button-icon--stop" />
                                <span className="text-xs font-bold uppercase tracking-tighter answering-machine__button-label">Stop</span>
                            </>
                        ) : (
                            <>
                                <div className="w-4 h-4 bg-red-600 rounded-full shadow-[0_0_5px_red] answering-machine__button-icon answering-machine__button-icon--record"></div>
                                <span className="text-xs font-bold uppercase tracking-tighter answering-machine__button-label">Record</span>
                            </>
                        )}
                    </button>

                    {/* Preview or Play Random */}
                    {audioUrl ? (
                        <button
                            onClick={handleTogglePreview}
                            className="tactile-button answering-machine__button answering-machine__button--preview bg-blue-600 text-white py-4 rounded-xl flex flex-col items-center justify-center gap-1 border-b-4 border-black"
                        >
                            {isPlaying ? (
                                <>
                                    <Pause className="w-6 h-6 answering-machine__button-icon" />
                                    <span className="text-xs font-bold uppercase tracking-tighter answering-machine__button-label">Pause</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-6 h-6 answering-machine__button-icon" />
                                    <span className="text-xs font-bold uppercase tracking-tighter answering-machine__button-label">Preview</span>
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={handlePlayRandom}
                            disabled={isUploading || isRecording}
                            className={`tactile-button answering-machine__button answering-machine__button--random text-white py-4 rounded-xl flex flex-col items-center justify-center gap-1 border-b-4 border-black ${isRecording ? 'bg-gray-400 opacity-50' : 'bg-[#6b7280]'}`}
                            data-purpose="play-random-action"
                        >
                            <Play className="w-6 h-6 answering-machine__button-icon" />
                            <span className="text-xs font-bold uppercase tracking-tighter answering-machine__button-label">
                                {isUploading ? 'Loading...' : 'Play Random'}
                            </span>
                        </button>
                    )}

                    {/* Clear Button - Persistent */}
                    <button
                        onClick={clearRecording}
                        disabled={!audioUrl || isRecording}
                        className={`tactile-button answering-machine__button answering-machine__button--clear text-white py-4 rounded-xl flex flex-col items-center justify-center gap-1 border-b-4 border-black ${(!audioUrl || isRecording) ? 'bg-gray-400 opacity-50' : 'bg-[#cc3333]'}`}
                    >
                        <RotateCcw className="w-6 h-6 answering-machine__button-icon" />
                        <span className="text-xs font-bold uppercase tracking-tighter answering-machine__button-label">Clear</span>
                    </button>

                    {/* Save Button (formerly Share) - Persistent */}
                    <button
                        onClick={audioUrl ? handleUpload : undefined}
                        disabled={!audioUrl || isUploading || isRecording}
                        className={`tactile-button answering-machine__button answering-machine__button--save text-white py-4 rounded-xl flex flex-col items-center justify-center gap-1 border-b-4 border-black 
                            ${isUploading ? 'bg-gray-600 opacity-50' : (audioUrl && !isRecording ? 'bg-[#338833]' : 'bg-gray-400 opacity-50')}`}
                        data-purpose="share-action"
                    >
                        <UploadCloud className={`w-6 h-6 answering-machine__button-icon ${isUploading ? 'animate-bounce' : ''}`} />
                        <span className="text-xs font-bold uppercase tracking-tighter answering-machine__button-label">
                            {isUploading ? 'Saving...' : 'Save'}
                        </span>
                    </button>

                    {/* Share URL Display */}
                    {shareUrl && (
                        <div className="col-span-2 text-center text-xs mt-2 p-2 bg-yellow-100 text-yellow-900 border-2 border-yellow-400 rounded answering-machine__share-url">
                            <p className="answering-machine__share-text">Success! Share this link:</p>
                            <a href={shareUrl} className="font-bold underline break-all answering-machine__link">{shareUrl}</a>
                        </div>
                    )}

                </section>
                {/* END: ButtonGrid */}

                {/* BEGIN: FeaturedAction */}
                <section className="w-full mt-8 answering-machine__cta" data-purpose="primary-call-to-action">
                    <button className="tactile-button w-full bg-[#ffcc00] hover:bg-[#ffdb4d] text-[#1a1a1a] py-6 rounded-2xl flex flex-col items-center justify-center border-b-8 border-[#b38f00] group answering-machine__cta-button" data-purpose="buy-tickets-button">
                        <span className="text-2xl font-black uppercase italic tracking-widest group-active:scale-95 transition-transform answering-machine__cta-primary">Buy Tickets</span>
                        <span className="text-[10px] font-bold mt-1 text-[#665200] answering-machine__cta-secondary">FOR THE LIVE PLAY PERFORMANCE</span>
                    </button>
                </section>
                {/* END: FeaturedAction */}

                {/* BEGIN: DecorativeDetail */}
                <div className="mt-4 w-full h-1 bg-[#b3a79a] rounded shadow-inner answering-machine__decorative-groove" data-purpose="decorative-groove"></div>
                <div className="mt-1 w-full flex justify-center answering-machine__decorative-foot-container">
                    <div className="w-1/3 h-8 bg-[#c0b5a8] rounded-b-3xl border-x-2 border-b-2 border-[#b3a79a] answering-machine__decorative-foot"></div>
                </div>
                {/* END: DecorativeDetail */}
            </main>
        </>
    );
}
