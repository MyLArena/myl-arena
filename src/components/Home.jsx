import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { app } from '../services/firebase';

const Inicio = ({ onNavegar, onIniciarSolitario, onIniciarMultijugador }) => {
  const [roomCode, setRoomCode] = useState('');
  const [mostrarModalMazos, setMostrarModalMazos] = useState(false);
  const [mazosGuardados, setMazosGuardados] = useState([]);
  const [accionPendiente, setAccionPendiente] = useState(null);
  const [codigoGeneradoPendiente, setCodigoGeneradoPendiente] = useState('');

  // Función para obtener los mazos estrictamente desde Firebase
  const cargarMazosDesdeNube = async () => {
    const auth = getAuth(app);
    const user = auth.currentUser;

    if (!user) {
      // Si no hay sesión, nos aseguramos de vaciar la lista
      setMazosGuardados([]);
      return false; // Retornamos falso para bloquear la apertura del modal
    }

    const db = getFirestore(app);
    try {
      const querySnapshot = await getDocs(collection(db, `usuarios/${user.uid}/mazos`));
      const mazosNube = [];
      querySnapshot.forEach((docSnap) => {
        mazosNube.push(docSnap.data());
      });
      
      setMazosGuardados(mazosNube);
      return true; // Éxito
    } catch (error) {
      console.error("Error al cargar mazos de Firestore en Inicio:", error);
      setMazosGuardados([]);
      return false;
    }
  };

  const handleJuegoSolitario = async () => {
    const sesionActiva = await cargarMazosDesdeNube();
    if (!sesionActiva) {
      alert("Debes iniciar sesión con tu cuenta para poder jugar.");
      return;
    }
    setAccionPendiente('solitario');
    setMostrarModalMazos(true);
  };

  const handleCrearPartida = async () => {
    const sesionActiva = await cargarMazosDesdeNube();
    if (!sesionActiva) {
      alert("Debes iniciar sesión con tu cuenta para crear una partida.");
      return;
    }
    const nuevoCodigo = 'ML-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    setCodigoGeneradoPendiente(nuevoCodigo);
    setAccionPendiente('crear');
    setMostrarModalMazos(true);
  };

  // Validación previa con el servidor para evitar falsos ingresos
  const handleUnirsePartida = async () => {
    const codigoLimpio = roomCode.trim().toUpperCase();
    if (!codigoLimpio) return;

    const sesionActiva = await cargarMazosDesdeNube();
    if (!sesionActiva) {
      alert("Debes iniciar sesión con tu cuenta para unirte a una partida.");
      return;
    }

    try {
      const response = await fetch(`/api/check-room/${codigoLimpio}`);
      const data = await response.json();
      
      if (!data.exists) {
        alert("La sala introducida no existe o ha expirado.");
        return;
      }
    } catch (error) {
      console.error("Error al verificar la sala:", error);
      alert("No se pudo conectar con el servidor para verificar la sala.");
      return;
    }

    setAccionPendiente('unirse');
    setMostrarModalMazos(true);
  };

  const seleccionarMazoParaJugar = (mazo) => {
    if (!mazo.esJugable) {
      alert("Este mazo no es jugable. Debe cumplir con los requisitos (ej. mazo principal completo).");
      return;
    }
    setMostrarModalMazos(false);

    if (accionPendiente === 'solitario') {
      if (onIniciarSolitario) {
        onIniciarSolitario(mazo);
      }
    } else if (accionPendiente === 'crear') {
      if (onIniciarMultijugador) {
        onIniciarMultijugador(mazo, codigoGeneradoPendiente, 'create');
      }
    } else if (accionPendiente === 'unirse') {
      if (onIniciarMultijugador) {
        onIniciarMultijugador(mazo, roomCode.trim().toUpperCase(), 'join');
      }
    }
  };

  return (
    <div style={{ padding: '40px 20px', color: '#e0e0e0', textAlign: 'center', maxWidth: '1200px', margin: '0 auto' }}>
      
      <h1 style={{ color: '#c5a059', fontSize: '2.5rem', marginBottom: '10px' }}>
        Bienvenido a MyL Arena
      </h1>
      <p style={{ fontSize: '1.1rem', color: '#888', marginBottom: '40px' }}>
        Selecciona un modo de juego para comenzar tu aventura o entrenar tus estrategias.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px', textAlign: 'left' }}>
        
        <div style={estiloTarjeta}>
          <h2 style={{ color: '#c5a059', fontSize: '1.5rem', marginBottom: '15px' }}>Modo Solitario</h2>
          <p style={{ color: '#aaa', fontSize: '0.95rem', marginBottom: '25px', lineHeight: '1.5' }}>
            Entrena de manera individual. Pon a prueba tus mazos guardados, practica aperturas y revisa mecánicas sin necesidad de un rival.
          </p>
          <button onClick={handleJuegoSolitario} style={estiloBotonPrincipal}>
            Iniciar Práctica
          </button>
        </div>

        <div style={estiloTarjeta}>
          <h2 style={{ color: '#c5a059', fontSize: '1.5rem', marginBottom: '15px' }}>Crear Partida</h2>
          <p style={{ color: '#aaa', fontSize: '0.95rem', marginBottom: '25px', lineHeight: '1.5' }}>
            Genera una sala privada instantánea. Obtén un código alfanumérico único para compartirlo con tu oponente y comenzar el duelo.
          </p>
          <button onClick={handleCrearPartida} style={estiloBotonSecundario}>
            Generar Código de Sala
          </button>
        </div>

        <div style={estiloTarjeta}>
          <h2 style={{ color: '#c5a059', fontSize: '1.5rem', marginBottom: '15px' }}>Unirse a Partida</h2>
          <p style={{ color: '#aaa', fontSize: '0.95rem', marginBottom: '15px', lineHeight: '1.5' }}>
            ¿Tienes un código de sala? Ingrésalo aquí abajo para conectarte de inmediato a la partida de tu contrincante.
          </p>
          <input
            type="text"
            placeholder="Ej: ML-9X28A"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            style={estiloInput}
          />
          <button 
            onClick={handleUnirsePartida}
            disabled={!roomCode.trim()}
            style={{
              ...estiloBotonPrincipal,
              opacity: roomCode.trim() ? '1' : '0.5',
              cursor: roomCode.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            Conectar a Sala
          </button>
        </div>

      </div>

      {mostrarModalMazos && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, padding: '20px', boxSizing: 'border-box' }}>
          <div style={{ backgroundColor: '#181818', border: '1px solid #444', borderRadius: '12px', width: '100%', maxWidth: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 25px', borderBottom: '1px solid #333', backgroundColor: '#1f1f1f' }}>
              <h2 style={{ color: '#fff', margin: 0, fontSize: '1.3rem' }}>
                Selecciona un mazo jugable {accionPendiente === 'crear' && `(Código: ${codigoGeneradoPendiente})`}
              </h2>
              <button onClick={() => setMostrarModalMazos(false)} style={{ backgroundColor: 'transparent', border: 'none', color: '#aaa', fontSize: '1.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
                ✕
              </button>
            </div>

            <div style={{ padding: '25px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {mazosGuardados.length > 0 ? (
                mazosGuardados.map(m => {
                  const totalMain = m.mazoPrincipal ? m.mazoPrincipal.reduce((acc, item) => acc + item.cantidad, 0) : 0;
                  const esJugable = m.esJugable;

                  return (
                    <div 
                      key={m.id}
                      onClick={() => seleccionarMazoParaJugar(m)}
                      style={{
                        backgroundColor: '#222',
                        border: `1px solid ${esJugable ? '#c5a059' : '#444'}`,
                        borderRadius: '8px',
                        padding: '15px 20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: esJugable ? 'pointer' : 'not-allowed',
                        opacity: esJugable ? '1' : '0.5',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                          <h3 style={{ color: '#fff', margin: 0, fontSize: '1.1rem' }}>{m.nombre}</h3>
                          <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: esJugable ? '#1e3a23' : '#3a1e1e', color: esJugable ? '#6bff84' : '#ff6b6b', fontWeight: 'bold' }}>
                            {esJugable ? 'Jugable' : 'Borrador / Inválido'}
                          </span>
                        </div>
                        <span style={{ color: '#888', fontSize: '0.85rem' }}>Formato: {m.formato} | Cartas Main: {totalMain}</span>
                      </div>
                      <div>
                        <button
                          disabled={!esJugable}
                          style={{
                            backgroundColor: esJugable ? '#c5a059' : '#333',
                            color: esJugable ? '#121212' : '#777',
                            border: 'none',
                            padding: '8px 15px',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            cursor: esJugable ? 'pointer' : 'not-allowed'
                          }}
                        >
                          {esJugable ? 'Jugar' : 'No disponible'}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: '#888', textAlign: 'center', padding: '40px 0' }}>
                  No tienes mazos creados o aún no cargan desde la nube. Ve a "Crear Mazos" para armar uno.
                </div>
              )}
            </div>

            <div style={{ padding: '15px 25px', borderTop: '1px solid #333', backgroundColor: '#1f1f1f', textAlign: 'right' }}>
              <button onClick={() => setMostrarModalMazos(false)} style={{ backgroundColor: '#333', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

const estiloTarjeta = { backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' };
const estiloBotonPrincipal = { backgroundColor: '#c5a059', color: '#121212', border: 'none', padding: '12px 20px', borderRadius: '4px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', width: '100%', transition: 'background 0.2s' };
const estiloBotonSecundario = { backgroundColor: 'transparent', color: '#c5a059', border: '2px solid #c5a059', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', width: '100%', transition: 'all 0.2s' };
const estiloInput = { width: '100%', padding: '12px', marginBottom: '15px', backgroundColor: '#121212', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '1rem', textAlign: 'center', letterSpacing: '1px', textTransform: 'uppercase', outline: 'none' };

export default Inicio;