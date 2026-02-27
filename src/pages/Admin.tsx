import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Check, X, RefreshCw, LogIn, Loader2 } from 'lucide-react';

export function Admin() {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<any[]>([]);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) fetchMessages();
            setLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) fetchMessages();
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchMessages = async () => {
        const { data, error } = await supabase
            .from('messages')
            .select('id, audio_url, transcription, status, created_at')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching messages:', error);
        } else {
            setMessages(data || []);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) setAuthError(error.message);
        setLoading(false);
    };

    const handleApprove = async (id: string) => {
        const { error } = await supabase
            .from('messages')
            .update({ status: 'approved' })
            .eq('id', id);
        if (!error) fetchMessages();
    };

    const handleReject = async (id: string, audioUrl: string) => {
        // We should also delete the file from storage
        // audio_url is typically a full URL, we need to extract the path
        try {
            const urlParts = audioUrl.split('/');
            const fileName = urlParts[urlParts.length - 1]; // highly dependent on URL structure

            if (fileName) {
                await supabase.storage.from('voicemails').remove([fileName]);
            }

            const { error } = await supabase
                .from('messages')
                .delete()
                .eq('id', id);

            if (!error) fetchMessages();
        } catch (err) {
            console.error('Error deleting file: ', err);
        }
    };

    if (loading) {
        return <div className="min-h-screen grow flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;
    }

    if (!session) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-4">
                <form onSubmit={handleLogin} className="bg-[#2c341b] p-8 rounded-xl border-4 border-[#1a1f10] shadow-2xl flex flex-col gap-4 text-white font-mono w-full max-w-sm">
                    <h2 className="text-2xl mb-4 font-bold flex items-center gap-2"><LogIn /> SYSTEM LOGIN</h2>
                    {authError && <div className="bg-red-900/50 p-2 text-red-200 border border-red-500 rounded">{authError}</div>}
                    <input
                        type="email"
                        placeholder="ACCESS CODE (EMAIL)"
                        className="p-3 bg-black/50 border border-[#556b2f] rounded"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="PASSWORD"
                        className="p-3 bg-black/50 border border-[#556b2f] rounded"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button type="submit" className="bg-[#556b2f] hover:bg-[#6b8e23] p-3 text-xl font-bold rounded mt-2 cursor-pointer transition-colors">
                        AUTHENTICATE
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full p-8 text-white font-mono max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-[#556b2f] bg-[#2c341b]/80 p-6 rounded-lg shadow-lg">
                <h1 className="text-3xl font-bold tracking-widest">MEMO-TONE ADMIN TERMINAL</h1>
                <button
                    onClick={fetchMessages}
                    className="flex items-center gap-2 bg-[#556b2f] hover:bg-[#6b8e23] px-4 py-2 rounded shadow-md transition-colors"
                >
                    <RefreshCw className="w-4 h-4" /> REFRESH PENDING
                </button>
            </div>

            {messages.length === 0 ? (
                <div className="text-center p-12 bg-black/30 rounded border border-[#556b2f] flex flex-col items-center justify-center gap-4">
                    <span className="text-4xl">📭</span>
                    <p className="text-xl">NO PENDING MESSAGES DETECTED.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className="bg-[#2c341b] border-2 border-[#556b2f] p-4 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4">

                            <div className="flex flex-col grow min-w-0 break-all w-full">
                                <span className="text-xs text-[#b3a79a] mb-2 font-sans">{new Date(msg.created_at).toLocaleString()}</span>
                                {/* Standard HTML Audio Player */}
                                <audio controls src={msg.audio_url} className="w-full grayscale invert hue-rotate-[180deg] contrast-125" />

                                {/* Transcription Display */}
                                {msg.transcription ? (
                                    <div className="mt-4 p-3 bg-black/40 border border-[#556b2f] rounded text-green-400 text-sm whitespace-pre-wrap font-mono">
                                        <div className="text-[10px] text-[#556b2f] mb-1 uppercase tracking-widest border-b border-[#556b2f]/30 pb-1 font-sans">User Transcription</div>
                                        "{msg.transcription}"
                                    </div>
                                ) : (
                                    <div className="mt-4 p-3 bg-black/20 border border-dashed border-[#556b2f]/30 rounded text-[#556b2f] text-[10px] uppercase text-center tracking-widest font-sans">
                                        No transcription captured
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 w-full md:w-auto shrink-0 mt-4 md:mt-0">
                                <button
                                    onClick={() => handleApprove(msg.id)}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 px-6 py-4 rounded font-bold shadow-inner"
                                >
                                    <Check /> APPROVE
                                </button>
                                <button
                                    onClick={() => handleReject(msg.id, msg.audio_url)}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 px-6 py-4 rounded font-bold shadow-inner"
                                >
                                    <X /> REJECT
                                </button>
                            </div>

                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
