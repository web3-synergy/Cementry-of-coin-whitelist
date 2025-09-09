import React, { useEffect, useState, useRef } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { db, addDoc, collection } from './firebase';
import './App.css';
import logo from './assets/logo.svg';
import phantom from './assets/phantom.svg';
import Feedback from './assets/Feedback.svg';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

// ---- Helper: Generate and store key pair ----
function generateAndStoreKeyPair() {
  const kp = nacl.box.keyPair();
  sessionStorage.setItem('phantom_dapp_secret_key', bs58.encode(kp.secretKey));
  return kp;
}

// ---- Helper: Decrypt Phantom callback payload ----
function decryptPayload(data, nonce, phantomPublicKey) {
  try {
    const secretKey = bs58.decode(sessionStorage.getItem('phantom_dapp_secret_key'));
    const sharedSecret = nacl.box.before(bs58.decode(phantomPublicKey), secretKey);
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

// ---- Callback screen ----
function Callback() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const phantomPubKey = params.get('phantom_encryption_public_key');
    const nonce = params.get('nonce');
    const data = params.get('data');

    if (phantomPubKey && nonce && data) {
      const decryptedData = decryptPayload(data, nonce, phantomPubKey);
      if (decryptedData?.public_key) {
        navigate('/', { state: { walletAddress: decryptedData.public_key } });
      } else {
        alert('Failed to read wallet address from Phantom.');
        navigate('/');
      }
    } else {
      alert('Invalid Phantom callback.');
      navigate('/');
    }
  }, [location.search, navigate]);

  return <div>Connecting your wallet...</div>;
}

// ---- Main App ----
function App() {
  const location = useLocation();
  const state = location.state || {};
  const connectedWallet = state.walletAddress || null;

  const [walletAddress, setWalletAddress] = useState(connectedWallet);
  const [name, setName] = useState('');
  const [xUsername, setXUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whitelistSuccess, setWhitelistSuccess] = useState(false);

  // Grab wallet from query param (desktop quick connect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addr = params.get('walletAddress');
    if (addr) {
      setWalletAddress(addr);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // For when callback returned a wallet
  useEffect(() => {
    if (connectedWallet) {
      setWalletAddress(connectedWallet);
    }
  }, [connectedWallet]);

  // ---- Connect Wallet (handles desktop + mobile) ----
  const connectWallet = () => {
    const isPhantomInjected = window.solana && window.solana.isPhantom;

    if (isPhantomInjected) {
      // Desktop extension
      window.solana.connect()
        .then((res) => {
          const pubKey = res.publicKey.toString();
          console.log('✅ Connected via Phantom extension:', pubKey);
          setWalletAddress(pubKey);
        })
        .catch((err) => {
          console.error('Phantom extension connection failed:', err);
          alert('Failed to connect Phantom extension.');
        });
      return;
    }

    // Mobile: deep link
    const appUrl = encodeURIComponent(window.location.origin);
    const redirectLink = encodeURIComponent(`${window.location.origin}/callback`);
    const keyPair = generateAndStoreKeyPair();
    const dappPublicKey = bs58.encode(keyPair.publicKey);

    const url =
      `https://phantom.app/ul/v1/connect?app_url=${appUrl}` +
      `&redirect_link=${redirectLink}` +
      `&dapp_encryption_public_key=${encodeURIComponent(dappPublicKey)}` +
      `&cluster=mainnet-beta`;

    window.location.href = url;
  };

  const formatWalletAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 4)}…${addr.slice(-5)}`;
  };

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
    } catch (error) {
      console.error(error);
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
                      <img src={phantom} alt="Phantom" className="phantom-logo" />
                      <span className="wallet-address">{formatWalletAddress(walletAddress)}</span>
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
                      <img src={phantom} alt="Phantom" className="phantom-logo" />
                      Connect with Phantom
                    </button>
                  ) : (
                    <div>
                      <div className="wallet-info">
                        <div className="wallet-address-group">
                          <img src={phantom} alt="Phantom" className="phantom-logo" />
                          <span className="wallet-address">{formatWalletAddress(walletAddress)}</span>
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