import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Check, X, RefreshCw, LogIn, Loader2 } from 'lucide-react';

export function Admin() {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'pending' | 'managed'>('pending');
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
    }, [activeTab]); // Refetch when tab changes

    const fetchMessages = async () => {
        let query = supabase
            .from('messages')
            .select('id, audio_url, transcription, status, created_at')
            .order('created_at', { ascending: false });

        if (activeTab === 'pending') {
            query = query.eq('status', 'pending');
        } else {
            query = query.in('status', ['approved', 'inactive']);
        }

        const { data, error } = await query;

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

    const handleToggleActive = async (id: string, currentStatus: string) => {
        const newStatus = currentStatus === 'approved' ? 'inactive' : 'approved';
        const { error } = await supabase
            .from('messages')
            .update({ status: newStatus })
            .eq('id', id);
        if (!error) fetchMessages();
    };

    const handleReject = async (id: string, audioUrl: string) => {
        try {
            const urlParts = audioUrl.split('/');
            const fileName = urlParts[urlParts.length - 1];

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
            <div className="min-h-screen w-full flex items-center justify-center p-4 admin-terminal admin-terminal--login">
                <form onSubmit={handleLogin} className="bg-[#2c341b] p-8 rounded-xl border-4 border-[#1a1f10] shadow-2xl flex flex-col gap-4 text-white font-mono w-full max-w-sm admin-terminal__login-form">
                    <h2 className="text-2xl mb-4 font-bold flex items-center gap-2 admin-terminal__login-title"><LogIn /> SYSTEM LOGIN</h2>
                    {authError && <div className="bg-red-900/50 p-2 text-red-200 border border-red-500 rounded admin-terminal__login-error">{authError}</div>}
                    <input
                        type="email"
                        placeholder="ACCESS CODE (EMAIL)"
                        className="p-3 bg-black/50 border border-[#556b2f] rounded admin-terminal__login-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="PASSWORD"
                        className="p-3 bg-black/50 border border-[#556b2f] rounded admin-terminal__login-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button type="submit" className="bg-[#556b2f] hover:bg-[#6b8e23] p-3 text-xl font-bold rounded mt-2 cursor-pointer transition-colors admin-terminal__login-button">
                        AUTHENTICATE
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full p-8 text-white font-mono max-w-4xl mx-auto admin-terminal">
            <div className="flex flex-col gap-6 mb-8 border-b border-[#556b2f] bg-[#2c341b]/80 p-6 rounded-lg shadow-lg admin-terminal__header">
                <div className="flex justify-between items-center admin-terminal__header-top">
                    <h1 className="text-3xl font-bold tracking-widest uppercase admin-terminal__title">Memo-Tone Terminal</h1>
                    <button
                        onClick={fetchMessages}
                        className="flex items-center gap-2 bg-[#556b2f] hover:bg-[#6b8e23] px-4 py-2 rounded shadow-md transition-colors admin-terminal__refresh-button"
                    >
                        <RefreshCw className="w-4 h-4" /> REFRESH
                    </button>
                </div>

                <div className="flex gap-4 border-b border-[#556b2f]/30 admin-terminal__tabs">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`pb-2 px-4 font-bold border-b-2 transition-all admin-terminal__tab ${activeTab === 'pending' ? 'border-[#6b8e23] text-[#6b8e23] admin-terminal__tab--active' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        PENDING APPROVAL
                    </button>
                    <button
                        onClick={() => setActiveTab('managed')}
                        className={`pb-2 px-4 font-bold border-b-2 transition-all admin-terminal__tab ${activeTab === 'managed' ? 'border-[#6b8e23] text-[#6b8e23] admin-terminal__tab--active' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        MANAGED RECORDINGS
                    </button>
                </div>
            </div>

            {messages.length === 0 ? (
                <div className="text-center p-12 bg-black/30 rounded border border-[#556b2f] flex flex-col items-center justify-center gap-4 admin-terminal__empty-state">
                    <span className="text-4xl admin-terminal__empty-icon">📭</span>
                    <p className="text-xl admin-terminal__empty-text">NO {activeTab.toUpperCase()} MESSAGES DETECTED.</p>
                </div>
            ) : (
                <div className="space-y-4 admin-terminal__list">
                    {messages.map((msg) => (
                        <div key={msg.id} className="bg-[#2c341b] border-2 border-[#556b2f] p-4 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4 admin-terminal__item">

                            <div className="flex flex-col grow min-w-0 break-all w-full admin-terminal__item-content">
                                <div className="flex justify-between items-center mb-2 admin-terminal__item-header">
                                    <span className="text-xs text-[#b3a79a] font-sans admin-terminal__timestamp">{new Date(msg.created_at).toLocaleString()}</span>
                                    {activeTab === 'managed' && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-sans font-bold uppercase admin-terminal__status-badge ${msg.status === 'approved' ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-500'}`}>
                                            {msg.status === 'approved' ? 'Active' : 'Inactive'}
                                        </span>
                                    )}
                                </div>
                                {/* Standard HTML Audio Player */}
                                <audio controls src={msg.audio_url} className="w-full grayscale invert hue-rotate-[180deg] contrast-125 admin-terminal__audio" />

                                {/* Transcription Display */}
                                {msg.transcription ? (
                                    <div className="mt-4 p-3 bg-black/40 border border-[#556b2f] rounded text-green-400 text-sm whitespace-pre-wrap font-mono admin-terminal__transcription">
                                        <div className="text-[10px] text-[#556b2f] mb-1 uppercase tracking-widest border-b border-[#556b2f]/30 pb-1 font-sans admin-terminal__transcription-title">User Transcription</div>
                                        <div className="admin-terminal__transcription-text">"{msg.transcription}"</div>
                                    </div>
                                ) : (
                                    <div className="mt-4 p-3 bg-black/20 border border-dashed border-[#556b2f]/30 rounded text-[#556b2f] text-[10px] uppercase text-center tracking-widest font-sans admin-terminal__transcription-empty">
                                        No transcription captured
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 w-full md:w-auto shrink-0 mt-4 md:mt-0 admin-terminal__actions">
                                {activeTab === 'pending' ? (
                                    <>
                                        <button
                                            onClick={() => handleApprove(msg.id)}
                                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 px-6 py-4 rounded font-bold shadow-inner admin-terminal__button admin-terminal__button--approve"
                                        >
                                            <Check /> APPROVE
                                        </button>
                                        <button
                                            onClick={() => handleReject(msg.id, msg.audio_url)}
                                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 px-6 py-4 rounded font-bold shadow-inner admin-terminal__button admin-terminal__button--reject"
                                        >
                                            <X /> REJECT
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleToggleActive(msg.id, msg.status)}
                                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-4 rounded font-bold shadow-inner transition-colors admin-terminal__button ${msg.status === 'approved' ? 'bg-yellow-700 hover:bg-yellow-600 admin-terminal__button--deactivate' : 'bg-[#6b8e23] hover:bg-[#556b2f] admin-terminal__button--reactivate'}`}
                                        >
                                            {msg.status === 'approved' ? <><X className="w-4 h-4" /> DEACTIVATE</> : <><Check className="w-4 h-4" /> REACTIVATE</>}
                                        </button>
                                        <button
                                            onClick={() => handleReject(msg.id, msg.audio_url)}
                                            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-900/50 hover:bg-red-800 px-4 py-4 rounded font-bold border border-red-700/50 transition-colors admin-terminal__button admin-terminal__button--delete"
                                            title="Permanently Delete"
                                        >
                                            <X />
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
