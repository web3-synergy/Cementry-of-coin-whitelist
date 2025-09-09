import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Routes, Route } from 'react-router-dom';
import { db, addDoc, collection } from './firebase';
import './App.css';
import logo from './assets/logo.svg';
import phantom from './assets/phantom.svg';
import Feedback from './assets/Feedback.svg';

function App() {
  const { publicKey, connect, connected } = useWallet();
  const [name, setName] = useState('');
  const [xUsername, setXUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [whitelistSuccess, setWhitelistSuccess] = useState(false);

  useEffect(() => {
    if (publicKey || window.solana?.publicKey) {
      const address = publicKey || window.solana.publicKey;
      setIsWalletConnected(true);
      setWalletAddress(address);
      console.log('Wallet address set:', address.toString());
    }
  }, [connected, publicKey]);

  // Clean connectWallet function
  const connectWallet = async () => {
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const hasPhantom = window.solana && window.solana.isPhantom;

      if (!hasPhantom) {
        if (isMobile) {
          alert(
            'Phantom wallet not detected. Please open this site from inside the Phantom wallet browser.'
          );
        } else {
          alert('Phantom wallet not detected. Please install Phantom from https://phantom.app');
        }
        return;
      }

      // Desktop Phantom or Phantom in-app browser
      if (!connected) {
        try {
          await connect();
        } catch (adapterError) {
          console.warn('Adapter connect failed, trying window.solana.connect():', adapterError);
          await window.solana.connect();
        }
      }

      const key = publicKey || window.solana.publicKey;
      if (!key) {
        throw new Error('No public key after connection. Please unlock Phantom and approve.');
      }

      setIsWalletConnected(true);
      setWalletAddress(key);
      console.log('Connected wallet address:', key.toString());
    } catch (err) {
      console.error('Wallet connection failed:', err);
      alert(`Failed to connect Phantom: ${err.message}`);
    }
  };

  const formatWalletAddress = (pubKey) => {
    if (!pubKey) return '';
    const address = pubKey.toString();
    return `${address.slice(0, 4)}…${address.slice(-5)}`;
  };

  const submitToWhitelist = async () => {
    if (!walletAddress || !xUsername || !name) {
      alert('Please connect wallet and enter both name and X username.');
      return;
    }
    if (!/^[A-Za-z0-9_]{1,15}$/.test(xUsername)) {
      alert('Invalid X username. Use 1-15 alphanumeric characters or underscores.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        walletAddress: walletAddress.toString(),
        xUsername: xUsername.trim(),
        name: name.trim(),
        timestamp: new Date().toISOString(),
      };
      console.log('Submitting to Firestore:', payload);
      const docRef = await addDoc(collection(db, 'whitelist_users'), payload);
      console.log('Document written with ID:', docRef.id);

      setWhitelistSuccess(true);
      setName('');
      setXUsername('');
    } catch (error) {
      console.error('Firestore error:', error.code, error.message, error);
      alert(`Failed to submit: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isButtonDisabled = isSubmitting || !name.trim() || !xUsername.trim();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="container">
            <div className="card">
              <img src={logo} alt="Whitelist Logo" className="whitelist-logo" />
              <p className="list">Waiting List</p>

              {whitelistSuccess ? (
                <div className="success-screen">
                  <div className="wallet-info">
                    <div className="wallet-address-group">
                      <img src={phantom} alt="Phantom Logo" className="phantom-logo" />
                      <span className="wallet-address">{formatWalletAddress(walletAddress)}</span>
                    </div>
                    <span className="connect">Connected</span>
                  </div>
                  <img src={Feedback} alt="success" className="feedback" />
                  <p>You entered the waiting list successfully</p>
                  <button
                    className="button button-green"
                    onClick={() => (window.location.href = '/')}
                  >
                    Back to Website
                  </button>
                </div>
              ) : (
                <>
                  {!isWalletConnected ? (
                    <button className="button-purple" onClick={connectWallet}>
                      <img src={phantom} alt="Phantom Logo" className="phantom-logo" />
                      Connect with Phantom
                    </button>
                  ) : (
                    <div>
                      <div className="wallet-info">
                        <div className="wallet-address-group">
                          <img src={phantom} alt="Phantom Logo" className="phantom-logo" />
                          <span className="wallet-address">{formatWalletAddress(walletAddress)}</span>
                        </div>
                        <span className="connect">Connected</span>
                      </div>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Full Name"
                        className="input"
                      />
                      <input
                        type="text"
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
      <Route path="/callback" element={<div className="container">Loading...</div>} />
    </Routes>
  );
}

export default App;
