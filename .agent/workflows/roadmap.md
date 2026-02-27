---
description: 
---

# Implementation Plan Artifact: The Voicemail Project

## Context & Objectives
Build a web-based interactive audio platform to serve as a marketing campaign for a theater production premiering in June. The app allows users to record messages of support, listen to random approved messages, and share links to specific recordings. The UI should be responsive (PWA) and handle audio capture natively. 

## Tech Stack
* **Frontend:** [Insert Vue or React] configured as a PWA
* **Backend & Database:** Supabase (PostgreSQL, Storage, Auth)
* **Hosting & Serverless:** Netlify
* **Telephony:** Twilio Programmable Voice
* **Client-Side Audio:** Web Audio API (`MediaRecorder`, `BiquadFilterNode`, `WaveShaperNode`)

## Execution Phases & Acceptance Criteria

### Phase 1: Project Scaffolding & Database Foundation
**Goal:** Establish the repository, backend connection, and data models.
1.  Initialize a new frontend project using Vite.
2.  Install the Supabase JS client.
3.  Draft the SQL to create a `messages` table in Supabase with the following schema: `id` (UUID), `audio_url` (text), `status` (enum: 'pending', 'approved', 'rejected', defaulting to 'pending'), `created_at` (timestamp).
4.  Configure a Supabase Storage bucket named `voicemails`.
5.  Set up initial Row Level Security (RLS) policies allowing public inserts and authenticated-only updates.

**Acceptance Criteria:**
* Project runs locally.
* Supabase connection is successfully established in the environment variables.
* The `messages` table and `voicemails` storage bucket exist in the database.

### Phase 2: Core UI & Audio Capture
**Goal:** Build the landing page and implement native microphone recording.
1.  Create the main landing page components: Header, "Leave a Message" button, and "Listen to a Random Message" button.
2.  Implement a recording interface using the browser's `MediaRecorder` API.
3.  Include UI controls to Request Microphone Permissions, Start, Stop, Preview (playback), and Clear the recording.
4.  Ensure the generated audio blob is accessible in the application state.

## Stitch Instructions

Get the images and code for the following Stitch project's screens:

## Project

ID: 5712199377091206354

## Screens:
1. Generated Screen
    ID: 9b364c76d97f46e7aa67beafbbe59d90

Use a utility like `curl -L` to download the hosted URLs.

**Acceptance Criteria:**
* User can grant microphone access.
* User can record audio and immediately play it back in the browser.

### Phase 3: The Lo-Fi Telephone Filter & Upload
**Goal:** Degrade the audio to sound like a vintage landline and save it to the database.
1.  Implement a Web Audio API pipeline to process the raw audio blob before upload.
2.  Apply a `BiquadFilterNode` (bandpass filter restricting frequencies to roughly 300Hz–3400Hz).
3.  Apply a `WaveShaperNode` to introduce slight clipping/distortion.
4.  Write the upload function: Save the processed audio blob to the Supabase `voicemails` bucket.
5.  On successful upload, insert a new row into the `messages` table with the generated file URL and a `pending` status.
6.  Generate and display a shareable URL containing the database row `id`.

**Acceptance Criteria:**
* Audio played back sounds noticeably filtered (lo-fi/telephone effect).
* Processed audio successfully uploads to Supabase Storage.
* A new `pending` row appears in the Supabase database.

### Phase 4: Admin Dashboard & Moderation
**Goal:** Build a protected route to screen inbound messages.
1.  Implement Supabase Authentication (Email/Password).
2.  Create a protected `/admin` route.
3.  Build a dashboard that fetches and displays all rows from `messages` where `status === 'pending'`.
4.  Include an inline HTML audio player for each row.
5.  Add an "Approve" button that updates the database status to `approved`.
6.  Add a "Reject" button that deletes the audio file from Storage and removes the row from the database.

**Acceptance Criteria:**
* Only authenticated users can access `/admin`.
* Admin can play pending audio.
* Status updates and deletions reflect immediately in the UI and database.

### Phase 5: Telephony Integration (Twilio to Webhook)
**Goal:** Allow users to call a real phone number to leave a message.
1.  Scaffold a Netlify Serverless Function designed to receive a Twilio webhook (`/api/twilio-inbound`).
2.  Write the function logic to parse the Twilio request, extract the Twilio Recording URL, and download the audio.
3.  (Optional/Stretch) Implement a server-side FFmpeg process within the function to apply the lo-fi filter to the Twilio audio.
4.  Upload the final audio to Supabase Storage and insert a `pending` row into the database.

**Acceptance Criteria:**
* Netlify function successfully receives payload from a Twilio test call.
* Call audio is saved to Supabase and appears in the Admin Dashboard.