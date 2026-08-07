import React, { useState, useEffect } from 'react';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword 
} from 'firebase/auth';
import { app } from '../services/firebase';

const auth = getAuth(app);

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage('¡Cuenta creada e iniciada con éxito!');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePasswordReset = async () => {
    if (!user && !email) {
      setError('Por favor ingresa tu correo electrónico arriba o inicia sesión para recuperar tu clave.');
      return;
    }
    try {
      const targetEmail = user ? user.email : email;
      await sendPasswordResetEmail(auth, targetEmail);
      setMessage(`Se ha enviado un correo de recuperación a: ${targetEmail}`);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await updatePassword(user, newPassword);
      setMessage('¡Contraseña actualizada con éxito!');
      setNewPassword('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: '2rem', color: '#fff', textAlign: 'center', maxWidth: '450px', margin: '0 auto', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #c5a059', marginTop: '2rem' }}>
      <h2 style={{ color: '#c5a059' }}>Perfil de Usuario</h2>

      {user ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p>¡Bienvenido, <strong>{user.email}</strong>!</p>
          <p>Estado: Conectado 🟢</p>

          {message && <p style={{ color: '#2ecc71', fontSize: '0.9rem' }}>{message}</p>}
          {error && <p style={{ color: '#ff6b6b', fontSize: '0.9rem' }}>{error}</p>}

          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem', borderTop: '1px solid #333', paddingTop: '1rem' }}>
            <h4>Cambiar Contraseña</h4>
            <input 
              type="password" 
              placeholder="Nueva contraseña" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              required
              style={{ padding: '10px', borderRadius: '5px', border: '1px solid #c5a059', background: '#121212', color: '#fff' }}
            />
            <button 
              type="submit" 
              style={{ padding: '8px', background: '#c5a059', color: '#121212', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Actualizar Clave
            </button>
          </form>

          <button 
            type="button"
            onClick={handlePasswordReset}
            style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }}
          >
            ¿Olvidaste tu contraseña? Enviar correo de recuperación
          </button>

          <button 
            onClick={handleLogout}
            style={{ padding: '10px 20px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', marginTop: '1rem' }}
          >
            Cerrar Sesión
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3>{isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}</h3>
          
          {message && <p style={{ color: '#2ecc71', fontSize: '0.9rem' }}>{message}</p>}
          {error && <p style={{ color: '#ff6b6b', fontSize: '0.9rem' }}>{error}</p>}

          <input 
            type="email" 
            placeholder="Correo electrónico" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required
            style={{ padding: '10px', borderRadius: '5px', border: '1px solid #c5a059', background: '#121212', color: '#fff' }}
          />
          
          <input 
            type="password" 
            placeholder="Contraseña" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required
            style={{ padding: '10px', borderRadius: '5px', border: '1px solid #c5a059', background: '#121212', color: '#fff' }}
          />

          <button 
            type="submit" 
            style={{ padding: '10px', background: '#c5a059', color: '#121212', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {isRegistering ? 'Registrarse' : 'Entrar'}
          </button>

          <button 
            type="button" 
            onClick={() => setIsRegistering(!isRegistering)}
            style={{ background: 'none', border: 'none', color: '#c5a059', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
          </button>

          <button 
            type="button" 
            onClick={handlePasswordReset}
            style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </form>
      )}
    </div>
  );
}