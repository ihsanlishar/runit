
import { createClient } from '@supabase/supabase-js';
import './style.css';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      detectSessionInUrl: true,
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const form = document.getElementById('password-form');
const section = document.getElementById('reset-form');
const message = document.getElementById('message');

async function initialize() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error_description');

  if (error) {
    message.textContent = decodeURIComponent(error);
    return;
  }

  if (code) {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      message.textContent = exchangeError.message;
      return;
    }
  }

  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    message.textContent =
      'Invalid or expired recovery link. Request a new email from RunIt.';
    return;
  }

  section.hidden = false;
  message.textContent = '';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const password = document.getElementById('password').value;
  const confirm = document.getElementById('confirm').value;

  if (password !== confirm) {
    message.textContent = 'Passwords do not match.';
    return;
  }

  if (password.length < 8) {
    message.textContent = 'Use at least 8 characters.';
    return;
  }

  const button = form.querySelector('button');
  button.disabled = true;
  message.textContent = 'Updating password...';

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    message.textContent = error.message;
    button.disabled = false;
    return;
  }

  await supabase.auth.signOut();

  section.hidden = true;
  message.textContent =
    'Password updated successfully! Return to RunIt and sign in.';
});

initialize();
