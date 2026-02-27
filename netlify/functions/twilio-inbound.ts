import { Config, Context } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; // Usually should use service_role for backend
const supabase = createClient(supabaseUrl, supabaseKey);

export default async (req: Request, context: Context) => {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        // Twilio webhooks are usually standard urlencoded form data
        const text = await req.text();
        const params = new URLSearchParams(text);
        const recordingUrl = params.get('RecordingUrl');
        const callSid = params.get('CallSid');

        if (!recordingUrl) {
            console.error('No RecordingUrl in Twilio payload:', text);
            return new Response('No RecordingUrl found', { status: 400 });
        }

        // 1. Download the audio from Twilio
        // Twilio stores them as WAV/MP3 depending on the extension appended
        const response = await fetch(`${recordingUrl}.wav`);
        if (!response.ok) {
            throw new Error(`Failed to fetch recording from Twilio: ${response.statusText}`);
        }
        const audioArrayBuffer = await response.arrayBuffer();

        // 2. Upload to Supabase Storage
        const fileName = `twilio-${callSid || Date.now()}.wav`;
        const { error: uploadError } = await supabase.storage
            .from('voicemails')
            .upload(fileName, audioArrayBuffer, { contentType: 'audio/wav' });

        if (uploadError) {
            throw uploadError;
        }

        // 3. Get Public URL
        const { data: publicUrlData } = supabase.storage
            .from('voicemails')
            .getPublicUrl(fileName);

        // 4. Insert into database with 'pending' status
        const { error: insertError } = await supabase
            .from('messages')
            .insert([{ audio_url: publicUrlData.publicUrl, status: 'pending' }]);

        if (insertError) {
            throw insertError;
        }

        // Respond to Twilio with TwiML (empty response is fine if no further action is needed)
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <!-- Optionally add a <Say> or <Hangup> if this isn't the end of the call loop -->
</Response>`;

        return new Response(twiml, {
            status: 200,
            headers: { 'Content-Type': 'text/xml' }
        });

    } catch (error: any) {
        console.error('Webhook error:', error);
        return new Response(`Error processing webhook: ${error.message}`, { status: 500 });
    }
};

export const config: Config = {
    path: '/api/twilio-inbound'
};
