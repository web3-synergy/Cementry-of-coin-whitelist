import React, { useEffect, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { db, addDoc, collection } from './firebase';
import { query, where, getDocs } from "firebase/firestore"; // 👈 import directly from SDK
import './App.css';

import phantomLogo from './assets/phantom.svg';
import Feedback from './assets/Feedback.svg';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import logo from './assets/logo.svg';

// ----- Helper: generate or retrieve stable keypair -----
function getOrCreateKeyPair() {
  const existingSecret = localStorage.getItem('phantom_secret_key');
  if (existingSecret) {
    const secretKey = bs58.decode(existingSecret);
    return nacl.box.keyPair.fromSecretKey(secretKey);
  }
  const kp = nacl.box.keyPair();
  localStorage.setItem('phantom_secret_key', bs58.encode(kp.secretKey));
  return kp;
}

// ----- Helper: decrypt Phantom payload -----
function decryptPayload(data, nonce, phantomPublicKey) {
  try {
    const secretKey = bs58.decode(localStorage.getItem('phantom_secret_key'));
    const sharedSecret = nacl.box.before(bs58.decode(phantomPublicKey), secretKey);
    const decrypted = nacl.box.open.after(
      bs58.decode(data),
      bs58.decode(nonce),
      sharedSecret
    );
    if (!decrypted) throw new Error('Failed to decrypt');
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (e) {
    console.error('❌ Decryption error:', e);
    return null;
  }
}

// ----- Callback screen -----
function Callback() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const phantomPubKey = params.get('phantom_encryption_public_key');
    const nonce = params.get('nonce');
    const data = params.get('data');

    if (phantomPubKey && nonce && data) {
      console.log('🔹 Phantom callback params:', { phantomPubKey, nonce, data });

      const decryptedData = decryptPayload(data, nonce, phantomPubKey);
      console.log('🔹 Decrypted payload:', decryptedData);

      if (decryptedData?.public_key) {
        navigate('/', { state: { walletAddress: decryptedData.public_key } });
      } else {
        alert('Failed to read wallet address. Check console logs.');
        navigate('/');
      }
    } else {
      alert('Invalid Phantom callback.');
      navigate('/');
    }
  }, [location.search, navigate]);

  return <div>Connecting your wallet...</div>;
}

// ----- Main App -----
function App() {
  const location = useLocation();
  const state = location.state || {};
  const connectedWallet = state.walletAddress || null;

  const [walletAddress, setWalletAddress] = useState(connectedWallet);
  const [xUsername, setXUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whitelistSuccess, setWhitelistSuccess] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  useEffect(() => {
    if (connectedWallet) {
      setWalletAddress(connectedWallet);
    }
  }, [connectedWallet]);

  // ---- Connect Wallet ----
  const connectWallet = () => {
    const isPhantomInjected = window.solana && window.solana.isPhantom;

    if (isPhantomInjected) {
      window.solana.connect()
        .then((res) => {
          const pubKey = res.publicKey.toString();
          setWalletAddress(pubKey);
        })
        .catch(() => {
          alert('Failed to connect Phantom extension.');
        });
      return;
    }

    const appUrl = encodeURIComponent(window.location.origin);
    const redirectLink = encodeURIComponent(`${window.location.origin}/callback`);
    const keyPair = getOrCreateKeyPair();
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
    if (!walletAddress || !xUsername.trim()) {
      setUsernameError('Please enter a username');
      return;
    }
    setIsSubmitting(true);
    setUsernameError('');

    try {
      // 🔎 Check if username exists
      const q = query(
        collection(db, 'whitelist_users'),
        where('xUsername', '==', xUsername.trim())
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setUsernameError('Username Taken');
        setIsSubmitting(false);
        return;
      }

      // ✅ Add to Firestore
      await addDoc(collection(db, 'whitelist_users'), {
        walletAddress,
        xUsername: xUsername.trim(),
        timestamp: new Date().toISOString(),
      });

      setWhitelistSuccess(true);
      setXUsername('');
    } catch (error) {
      console.error(error);
      setUsernameError('Submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isButtonDisabled = isSubmitting || !xUsername.trim();

  return (
    <Routes>
      <Route path="/callback" element={<Callback />} />
      <Route
        path="/"
        element={
          <div className="container">
            <div className="card">
              <div className='circle'>
                <img src={logo} alt="Logo" className="whitelist-logo" />
                
              </div>
              <p className="list">Whitelist</p>

              {whitelistSuccess ? (
                <div className="success-screen">
                  <div className="wallet-info">
                    <div className="wallet-address-group">
                      <img src={phantomLogo} alt="Phantom" className="phantom-logo" />
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
                      <img src={phantomLogo} alt="Phantom" className="phantom-logo" />
                      Connect with Phantom
                    </button>
                  ) : (
                    <div>
                      <div className="wallet-info">
                        <div className="wallet-address-group">
                          <img src={phantomLogo} alt="Phantom" className="phantom-logo" />
                          <span className="wallet-address">{formatWalletAddress(walletAddress)}</span>
                        </div>
                        <span className="connect">Connected</span>
                      </div>

                      <div className="input-group">
  <input
    value={xUsername}
    onChange={(e) => setXUsername(e.target.value)}
    placeholder="Spooky username"
    className="input"
  />
  {usernameError && (
    <p className="error-text">{usernameError}</p>
  )}
</div>

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