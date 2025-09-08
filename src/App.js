import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Routes, Route } from 'react-router-dom';
import { db, addDoc, collection } from './firebase';
import './App.css';
import logo from './assets/logo.svg'; // Whitelist logo
import phantom from './assets/phantom.svg'; // Phantom logo (adjust path or use URL)
import Feedback from './assets/Feedback.svg';

function App() {
  const { publicKey, connect, connected } = useWallet();
  const [name, setName] = useState('');
  const [xUsername, setXUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [whitelistSuccess, setWhitelistSuccess] = useState(false); // <-- NEW

  useEffect(() => {
    if (publicKey || window.solana?.publicKey) {
      const address = publicKey || window.solana.publicKey;
      setIsWalletConnected(true);
      setWalletAddress(address);
      console.log('Wallet address set:', address.toString());
    }
    console.log('Wallet state:', {
      connected,
      publicKey: publicKey?.toString(),
      windowSolanaPublicKey: window.solana?.publicKey?.toString(),
      isWalletConnected,
    });
  }, [connected, publicKey]);

  const connectWallet = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!window.solana || !window.solana.isPhantom) {
        throw new Error('Phantom wallet not detected. Please install or unlock Phantom.');
      }
      if (!connected && !publicKey) {
        try {
          await connect();
        } catch (adapterError) {
          console.warn('Adapter connection failed, trying direct connection:', adapterError);
          await window.solana.connect();
        }
      }
      let attempts = 0;
      const maxAttempts = 1;
      while (!publicKey && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
        console.log(`Attempt ${attempts}: publicKey =`, publicKey?.toString());
      }
      if (!publicKey && window.solana?.publicKey) {
        console.log('Using window.solana.publicKey:', window.solana.publicKey.toString());
        setIsWalletConnected(true);
        setWalletAddress(window.solana.publicKey);
        return;
      }
      if (!publicKey) {
        throw new Error('No public key available after connection. Please ensure Phantom is unlocked and approved.');
      }
      setIsWalletConnected(true);
      setWalletAddress(publicKey);
    } catch (error) {
      console.error('Wallet connection failed:', error.message, error);
      alert(`Failed to connect wallet: ${error.message}`);
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

      // Show success screen
      setWhitelistSuccess(true);

      // Reset form (optional)
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
              <p className='list'>Waiting List</p>

              {whitelistSuccess ? (
                // SUCCESS SCREEN
                <div className="success-screen">
                  <div className="wallet-info">
                    <div className='wallet-address-group'>
                      <img src={phantom} alt="Phantom Logo" className="phantom-logo" />
                      <span className="wallet-address">{formatWalletAddress(walletAddress)}</span>
                    </div>
                    <span className="connect">Connected</span>
                  </div>
                  <img src={Feedback} alt='success' className='feedback' />
                  <p>You enter Waiting list successfully</p>
                  <button
                    className="button button-green"
                    onClick={() => window.location.href = '/'}
                  >
                    Back Website
                  </button>
                </div>
              ) : (
                // ORIGINAL FORM
                <>
                  {!isWalletConnected ? (
                    <button className="button-purple" onClick={connectWallet}>
                      <img src={phantom} alt="Phantom Logo" className="phantom-logo" />
                      Connect with Phantom
                    </button>
                  ) : (
                    <div>
                      <div className="wallet-info">
                        <div className='wallet-address-group'>
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
