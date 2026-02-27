import { useState, useEffect } from 'react';
import { Play, UploadCloud, Square, RotateCcw } from 'lucide-react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { applyLoFiFilter } from '../lib/audioProcessing';
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
            <div className="grain"></div>
            {/* BEGIN: PhoneContainer */}
            <main className="plastic-body w-[90%] max-w-[400px] p-8 flex flex-col items-center gap-6 border-2 border-[#b3a79a]" data-purpose="answering-machine-shell">

                {/* BEGIN: TopSection - Display and Speaker */}
                <section className="w-full flex justify-between items-start mb-4" data-purpose="device-header">
                    {/* Digital Display Block */}
                    <div className="bg-black p-3 rounded-lg border-4 border-[#8e857b] shadow-inner" data-purpose="status-display">
                        <div className="digital-font text-red-600 text-5xl leading-none tracking-widest" id="clock-display">
                            {time.slice(0, 2)}
                            <span className={isBlinking ? 'opacity-100' : 'opacity-0'}>:</span>
                            {time.slice(3)}
                        </div>
                        <div className="text-[10px] text-red-900 font-bold uppercase mt-1">Messages: 03</div>
                    </div>

                    {/* Speaker Grill */}
                    <div className="grid grid-cols-4 gap-2 p-2 bg-[#c0b5a8] rounded-full border border-[#a1978b]" data-purpose="voicemail-speaker">
                        {Array.from({ length: 16 }).map((_, i) => (
                            <div key={i} className="speaker-hole"></div>
                        ))}
                    </div>
                </section>
                {/* END: TopSection */}

                {/* BEGIN: BrandLogo */}
                <div className="w-full text-left px-2">
                    <span className="font-serif italic font-black text-[#8e857b] text-xl opacity-60">MEMO-TONE 3000</span>
                </div>
                {/* END: BrandLogo */}

                {/* BEGIN: ButtonGrid */}
                <section className="grid grid-cols-2 gap-6 w-full mt-4" data-purpose="control-panel">
                    {error && <div className="col-span-2 text-red-600 text-xs text-center">{error}</div>}

                    {/* Record / Stop Button */}
                    {!audioUrl && (
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`tactile-button text-white py-4 rounded-xl flex flex-col items-center justify-center gap-1 border-b-4 border-black ${isRecording ? 'bg-red-800' : 'bg-[#444]'}`}
                            data-purpose="record-action"
                        >
                            {isRecording ? (
                                <>
                                    <Square className="w-5 h-5 text-red-500 animate-pulse" />
                                    <span className="text-xs font-bold uppercase tracking-tighter">Stop</span>
                                </>
                            ) : (
                                <>
                                    <div className="w-4 h-4 bg-red-600 rounded-full shadow-[0_0_5px_red]"></div>
                                    <span className="text-xs font-bold uppercase tracking-tighter">Record</span>
                                </>
                            )}
                        </button>
                    )}

                    {/* Preview and Clear Buttons */}
                    {audioUrl && (
                        <>
                            <button
                                onClick={() => {
                                    const audio = new Audio(audioUrl);
                                    audio.play();
                                }}
                                className="tactile-button bg-[#338833] text-white py-4 rounded-xl flex flex-col items-center justify-center gap-1 border-b-4 border-black"
                            >
                                <Play className="w-6 h-6" />
                                <span className="text-xs font-bold uppercase tracking-tighter">Preview</span>
                            </button>

                            <button
                                onClick={clearRecording}
                                className="tactile-button bg-[#cc3333] text-white py-4 rounded-xl flex flex-col items-center justify-center gap-1 border-b-4 border-black"
                            >
                                <RotateCcw className="w-6 h-6" />
                                <span className="text-xs font-bold uppercase tracking-tighter">Clear</span>
                            </button>
                        </>
                    )}

                    {/* Play Random Button */}
                    {!isRecording && !audioUrl && (
                        <button
                            onClick={handlePlayRandom}
                            disabled={isUploading}
                            className="tactile-button bg-[#6b7280] text-white py-4 rounded-xl flex flex-col items-center justify-center gap-1 border-b-4 border-black"
                            data-purpose="play-random-action"
                        >
                            <Play className="w-6 h-6" />
                            <span className="text-xs font-bold uppercase tracking-tighter">
                                {isUploading ? 'Loading...' : 'Play Random'}
                            </span>
                        </button>
                    )}

                    {/* Share Button (or Save conceptually for now) */}
                    {(audioUrl || !isRecording) && (
                        <button
                            onClick={audioUrl ? handleUpload : undefined}
                            disabled={isUploading}
                            className={`tactile-button text-white py-4 rounded-xl flex flex-col items-center justify-center gap-1 border-b-4 border-black ${isUploading ? 'bg-gray-600 opacity-50' : 'bg-[#6b7280]'}`}
                            data-purpose="share-action"
                        >
                            <UploadCloud className={`w-6 h-6 ${isUploading ? 'animate-bounce' : ''}`} />
                            <span className="text-xs font-bold uppercase tracking-tighter">
                                {isUploading ? 'Sending...' : (audioUrl ? 'Upload & Share' : 'Share Memo')}
                            </span>
                        </button>
                    )}

                    {/* Share URL Display */}
                    {shareUrl && (
                        <div className="col-span-2 text-center text-xs mt-2 p-2 bg-yellow-100 text-yellow-900 border-2 border-yellow-400 rounded">
                            <p>Success! Share this link:</p>
                            <a href={shareUrl} className="font-bold underline break-all">{shareUrl}</a>
                        </div>
                    )}

                </section>
                {/* END: ButtonGrid */}

                {/* BEGIN: FeaturedAction */}
                <section className="w-full mt-8" data-purpose="primary-call-to-action">
                    <button className="tactile-button w-full bg-[#ffcc00] hover:bg-[#ffdb4d] text-[#1a1a1a] py-6 rounded-2xl flex flex-col items-center justify-center border-b-8 border-[#b38f00] group" data-purpose="buy-tickets-button">
                        <span className="text-2xl font-black uppercase italic tracking-widest group-active:scale-95 transition-transform">Buy Tickets</span>
                        <span className="text-[10px] font-bold mt-1 text-[#665200]">FOR THE LIVE PLAY PERFORMANCE</span>
                    </button>
                </section>
                {/* END: FeaturedAction */}

                {/* BEGIN: DecorativeDetail */}
                <div className="mt-4 w-full h-1 bg-[#b3a79a] rounded shadow-inner" data-purpose="decorative-groove"></div>
                <div className="mt-1 w-full flex justify-center">
                    <div className="w-1/3 h-8 bg-[#c0b5a8] rounded-b-3xl border-x-2 border-b-2 border-[#b3a79a]"></div>
                </div>
                {/* END: DecorativeDetail */}
            </main>
        </>
    );
}
