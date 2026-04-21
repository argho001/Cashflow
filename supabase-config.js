/**
 * Supabase Configuration
 * Shared across auth and app pages.
 */
const SUPABASE_URL = 'https://bjgudajxiadtmvqabywz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZ3VkYWp4aWFkdG12cWFieXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODYyODcsImV4cCI6MjA4NjU2MjI4N30.rYOIl8vnFtY2eQON5Dcag1cP05O3d_sGw4mNnnAlMnM';

// Create and expose client globally
window._supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
