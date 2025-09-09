import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { db, addDoc, collection } from './firebase';
import './App.css';
import logo from './assets/logo.svg';
import phantomLogo from './assets/phantom.svg';
import Feedback from './assets/Feedback.svg';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

// --- Helper: Generate a key pair (for Phantom payload encryption) ---
function generateAndStoreKeyPair() {
  const kp = nacl.box.keyPair();
  sessionStorage.setItem('phantom_secret_key', bs58.encode(kp.secretKey));
  return kp;
}

// --- Helper: Decrypt Phantom payload ---
function decryptPayload(data, nonce, phantomPubKey) {
  try {
    const secretKey = bs58.decode(sessionStorage.getItem('phantom_secret_key'));
    const sharedSecret = nacl.box.before(bs58.decode(phantomPubKey), secretKey);
    const decrypted = nacl.box.open.after(
      bs58.decode(data),
      bs58.decode(nonce),
      sharedSecret
    );
    if (!decrypted) throw new Error('Failed to decrypt Phantom payload');
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (e) {
    console.error('Decryption error:', e);
    return null;
  }
}

// --- Callback Page ---
function Callback() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const phantomPubKey = params.get('phantom_encryption_public_key');
    const nonce = params.get('nonce');
    const data = params.get('data');

    if (phantomPubKey && nonce && data) {
      const decrypted = decryptPayload(data, nonce, phantomPubKey);
      if (decrypted?.public_key) {
        navigate('/', { state: { walletAddress: decrypted.public_key } });
      } else {
        alert('Failed to read wallet address.');
        navigate('/');
      }
    } else {
      alert('Invalid Phantom callback.');
      navigate('/');
    }
  }, [location.search, navigate]);

  return <div>Connecting wallet...</div>;
}

// --- Main App ---
function App() {
  const location = useLocation();
  const state = location.state || {};
  const [walletAddress, setWalletAddress] = useState(state.walletAddress || null);
  const [name, setName] = useState('');
  const [xUsername, setXUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whitelistSuccess, setWhitelistSuccess] = useState(false);

  // --- Connect Wallet ---
  const connectWallet = async () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const phantomInjected = window.solana && window.solana.isPhantom;

    if (!isMobile && phantomInjected) {
      // Desktop Phantom extension
      try {
        const res = await window.solana.connect();
        setWalletAddress(res.publicKey.toString());
      } catch (err) {
        console.error(err);
        alert('Failed to connect Phantom extension.');
      }
    } else {
      // Mobile → use Phantom Universal Link
      const appUrl = encodeURIComponent(window.location.origin);
      const redirectLink = encodeURIComponent(`${window.location.origin}/callback`);
      const kp = generateAndStoreKeyPair();
      const dappPubKey = bs58.encode(kp.publicKey);

      const link =
        `https://phantom.app/ul/v1/connect?` +
        `app_url=${appUrl}` +
        `&dapp_encryption_public_key=${encodeURIComponent(dappPubKey)}` +
        `&redirect_link=${redirectLink}` +
        `&cluster=mainnet-beta`;

      window.location.href = link;
    }
  };

  const formatWalletAddress = (addr) =>
    addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : '';

  const submitToWhitelist = async () => {
    if (!walletAddress || !xUsername.trim() || !name.trim()) {
      alert('Please connect wallet and fill both fields.');
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'whitelist_users'), {
        walletAddress,
        xUsername: xUsername.trim(),
        name: name.trim(),
        timestamp: new Date().toISOString(),
      });
      setWhitelistSuccess(true);
      setName('');
      setXUsername('');
    } catch (err) {
      console.error(err);
      alert('Submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isButtonDisabled = isSubmitting || !name.trim() || !xUsername.trim();

  return (
    <Routes>
      <Route path="/callback" element={<Callback />} />
      <Route
        path="/"
        element={
          <div className="container">
            <div className="card">
              <img src={logo} alt="Logo" className="whitelist-logo" />
              <p className="list">Waiting List</p>

              {whitelistSuccess ? (
                <div className="success-screen">
                  <div className="wallet-info">
                    <div className="wallet-address-group">
                      <img src={phantomLogo} alt="Phantom" className="phantom-logo" />
                      <span className="wallet-address">
                        {formatWalletAddress(walletAddress)}
                      </span>
                    </div>
                    <span className="connect">Connected</span>
                  </div>
                  <img src={Feedback} alt="Success" className="feedback" />
                  <p>You entered the waiting list successfully</p>
                  <button className="button button-green" onClick={() => window.location.reload()}>
                    Back to Website
                  </button>
                </div>
              ) : (
                <>
                  {!walletAddress ? (
                    <button className="button-purple" onClick={connectWallet}>
                      <img src={phantomLogo} alt="Phantom" className="phantom-logo" />
                      Connect with Phantom
                    </button>
                  ) : (
                    <div>
                      <div className="wallet-info">
                        <div className="wallet-address-group">
                          <img src={phantomLogo} alt="Phantom" className="phantom-logo" />
                          <span className="wallet-address">
                            {formatWalletAddress(walletAddress)}
                          </span>
                        </div>
                        <span className="connect">Connected</span>
                      </div>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Full Name"
                        className="input"
                      />
                      <input
                        value={xUsername}
                        onChange={(e) => setXUsername(e.target.value)}
                        placeholder="X @username"
                        className="input"
                      />
                      <button
                        onClick={submitToWhitelist}
                        disabled={isButtonDisabled}
                        className={`button ${isButtonDisabled ? 'button-disabled' : 'button-green'}`}
                      >
                        {isSubmitting ? 'Submitting...' : 'Join Whitelist'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        }
      />
    </Routes>
  );
}

export default App;
