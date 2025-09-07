import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBsYZeb9XTwZuvPnK0bv635vcyY_GV8ph0",
  authDomain: "whitelist-b271c.firebaseapp.com",
  projectId: "whitelist-b271c",
  storageBucket: "whitelist-b271c.firebasestorage.app",
  messagingSenderId: "776359623156",
  appId: "1:776359623156:web:e5e57f042ee310b16621a1",
  measurementId: "G-QM2Y921WZ2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, addDoc };