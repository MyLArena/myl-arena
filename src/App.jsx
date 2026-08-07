import React, { useState } from 'react';
import Home from './components/Home';
import CardCollection from './components/CardCollection';
import DeckBuilder from './components/DeckBuilder';
import MyDecks from './components/MyDecks';
import SolitaryBoard from './components/SolitaryBoard';
import MultiplayerBoard from './components/MultiplayerBoard';
import UserProfile from './components/UserProfile';

function App() {
  const [vistaActiva, setVistaActiva] = useState('inicio');
  const [mazoActivo, setMazoActivo] = useState(null);
  const [codigoSala, setCodigoSala] = useState('SALA-TEST');
  const [accionSala, setAccionSala] = useState('join');

  const renderizarVista = () => {
    switch (vistaActiva) {
      case 'coleccion':
        return <CardCollection />;
      case 'crear_mazos':
        return <DeckBuilder />;
      case 'mis_mazos':
        return <MyDecks onNavegar={setVistaActiva} />;
      case 'perfil':
        return <UserProfile />; 
      case 'solitario':
        return <SolitaryBoard mazo={mazoActivo} onSalir={() => { setMazoActivo(null); setVistaActiva('inicio'); }} />;
      case 'multijugador':
        return (
          <MultiplayerBoard 
            mazo={mazoActivo} 
            roomCode={codigoSala} 
            action={accionSala} 
            onSalir={() => { setMazoActivo(null); setVistaActiva('inicio'); }} 
          />
        );
      case 'inicio':
      default:
        return (
          <Home 
            onNavegar={setVistaActiva} 
            onIniciarSolitario={(mazoSeleccionado) => {
              setMazoActivo(mazoSeleccionado);
              setVistaActiva('solitario');
            }}
            onIniciarMultijugador={(mazoSeleccionado, codigo, accion) => {
              setMazoActivo(mazoSeleccionado);
              setCodigoSala(codigo);
              setAccionSala(accion);
              setVistaActiva('multijugador');
            }}
          />
        );
    }
  };

  const esVistaDeJuego = vistaActiva === 'solitario' || vistaActiva === 'multijugador';

  return (
    <div style={{ backgroundColor: '#121212', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {!esVistaDeJuego && (
        <nav style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#1a1a1a',
          padding: '10px 30px',
          borderBottom: '2px solid #c5a059',
          position: 'sticky',
          top: 0,
          zIndex: 2000
        }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img 
              src="/imagen_logo.png" 
              alt="Logo MyL Arena" 
              style={{ height: '45px', width: '45px', borderRadius: '50%', border: '1px solid #c5a059', objectFit: 'cover' }} 
            />
            <span style={{ color: '#c5a059', fontWeight: '900', fontSize: '1.2rem', letterSpacing: '1px' }}>MYL ARENA</span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setVistaActiva('inicio')} style={estiloBoton(vistaActiva === 'inicio')}>Inicio</button>
            <button onClick={() => setVistaActiva('coleccion')} style={estiloBoton(vistaActiva === 'coleccion')}>Colección</button>
            <button onClick={() => setVistaActiva('crear_mazos')} style={estiloBoton(vistaActiva === 'crear_mazos')}>Crear Mazos</button>
            <button onClick={() => setVistaActiva('mis_mazos')} style={estiloBoton(vistaActiva === 'mis_mazos')}>Mis Mazos</button>
            <button onClick={() => setVistaActiva('perfil')} style={estiloBoton(vistaActiva === 'perfil')}>Perfil</button>
          </div>
        </nav>
      )}

      <main>
        {renderizarVista()}
      </main>
      
    </div>
  );
}

const estiloBoton = (activo) => ({
  backgroundColor: activo ? '#2a2a2a' : 'transparent',
  color: activo ? '#c5a059' : '#e0e0e0',
  border: 'none',
  borderBottom: activo ? '3px solid #c5a059' : '3px solid transparent',
  padding: '12px 20px',
  fontSize: '1rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  borderRadius: '4px 4px 0 0'
});

export default App;