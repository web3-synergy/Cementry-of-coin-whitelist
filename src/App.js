import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { db, addDoc, collection } from './firebase';
import './App.css';
import logo from './assets/logo.svg';
import phantomLogo from './assets/phantom.svg';
import Feedback from './assets/Feedback.svg';

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [name, setName] = useState('');
  const [xUsername, setXUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [whitelistSuccess, setWhitelistSuccess] = useState(false);

  // 🔹 Auto-connect if opened inside Phantom browser with ?autoconnect=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auto = params.get('autoconnect');
    const provider = window?.solana;

    if (provider?.isPhantom && auto) {
      provider.connect()
        .then((res) => {
          setWalletAddress(res.publicKey.toString());
        })
        .catch((err) => {
          console.log('User did not approve connect:', err);
        });
    }
  }, []);

  // 🔹 Connect Wallet (handles desktop + mobile)
  const connectWallet = async () => {
    const provider = window?.solana;

    if (provider?.isPhantom) {
      // Desktop extension or already in Phantom browser
      try {
        const res = await provider.connect();
        setWalletAddress(res.publicKey.toString());
      } catch (err) {
        console.error('Connection failed:', err);
        alert('Failed to connect to Phantom.');
      }
    } else {
      // Not in Phantom → redirect into Phantom browser
      const url = `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}?autoconnect=true`;
      window.location.href = url;
    }
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
                      <span className="wallet-address">{formatWalletAddress(walletAddress)}</span>
                    </div>
                    <span className="connect">Connected</span>
                  </div>
                  <img src={Feedback} alt="Success" className="feedback" />
                  <p>You entered the waiting list successfully</p>
                  <button
                    className="button button-green"
                    onClick={() => window.location.reload()}
                  >
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
