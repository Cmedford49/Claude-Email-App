import { useState, useEffect, useCallback } from 'react';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

export function useGoogleAuth() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tokenClient, setTokenClient] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('mhg_token');
    const expiry = localStorage.getItem('mhg_token_expiry');
    const storedUser = localStorage.getItem('mhg_user');
    if (stored && expiry && Date.now() < parseInt(expiry)) {
      setAccessToken(stored);
      setIsSignedIn(true);
      if (storedUser) setUserInfo(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'your_google_client_id_here') return;
    const init = () => {
      if (!window.google) return;
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: async (response) => {
          if (response.access_token) {
            const expiry = Date.now() + response.expires_in * 1000;
            setAccessToken(response.access_token);
            setIsSignedIn(true);
            localStorage.setItem('mhg_token', response.access_token);
            localStorage.setItem('mhg_token_expiry', expiry.toString());
            try {
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${response.access_token}` },
              });
              const info = await res.json();
              setUserInfo(info);
              localStorage.setItem('mhg_user', JSON.stringify(info));
            } catch (e) { console.error(e); }
          }
        },
      });
      setTokenClient(client);
    };
    if (window.google) { init(); }
    else {
      const t = setInterval(() => { if (window.google) { init(); clearInterval(t); } }, 200);
      return () => clearInterval(t);
    }
  }, []);

  const signIn = useCallback(() => { if (tokenClient) tokenClient.requestAccessToken(); }, [tokenClient]);
  const signOut = useCallback(() => {
    if (accessToken && window.google) window.google.accounts.oauth2.revoke(accessToken);
    setAccessToken(null); setIsSignedIn(false); setUserInfo(null);
    ['mhg_token','mhg_token_expiry','mhg_user'].forEach(k => localStorage.removeItem(k));
  }, [accessToken]);

  return { isSignedIn, accessToken, userInfo, loading, signIn, signOut };
}
