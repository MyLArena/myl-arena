// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // <-- 1. Importar getFirestore

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDCd6rIN3rJrZBmWu_eAslbhoxUSv7Jye8",
  authDomain: "myl-arena.firebaseapp.com",
  projectId: "myl-arena",
  storageBucket: "myl-arena.firebasestorage.app",
  messagingSenderId: "344581692512",
  appId: "1:344581692512:web:6e175a48df247ffcf8b705"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // <-- 2. Inicializar Firestore

// Exportar app, auth y db para usarlas en los componentes
export { app, auth, db }; // <-- 3. Exportar db junto con los demás