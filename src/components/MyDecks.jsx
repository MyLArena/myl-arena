import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { app } from '../services/firebase';

const auth = getAuth(app);
const db = getFirestore(app);

export default function MyDecks({ onNavegar, onEditarMazo }) {
    const [mazos, setMazos] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [mazoSeleccionado, setMazoSeleccionado] = useState(null);
    const [user, setUser] = useState(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            
            if (currentUser) {
                // SOLO lee de Firestore si el usuario está logueado
                try {
                    const querySnapshot = await getDocs(collection(db, `usuarios/${currentUser.uid}/mazos`));
                    const mazosNube = [];
                    querySnapshot.forEach((docSnap) => {
                        mazosNube.push(docSnap.data());
                    });
                    setMazos(mazosNube);
                } catch (error) {
                    console.error("Error al cargar mazos de Firestore:", error);
                    setMazos([]);
                }
            } else {
                // Si no hay usuario, vaciamos los mazos (no usamos localStorage)
                setMazos([]);
            }
            setCargando(false);
        });
        return () => unsubscribe();
    }, []);

    const handleDelete = async (id) => {
        const filtrados = mazos.filter(m => m.id !== id);
        setMazos(filtrados);

        if (user) {
            try {
                await deleteDoc(doc(db, `usuarios/${user.uid}/mazos`, id.toString()));
            } catch (error) {
                console.error("Error al eliminar de Firestore:", error);
            }
        }

        if (mazoSeleccionado && mazoSeleccionado.id === id) {
            setMazoSeleccionado(null);
        }
    };

    const mazosFiltrados = mazos.filter(m => 
        m.nombre && m.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );

    // Pantallas de bloqueo si no hay sesión
    if (cargando) {
        return <div style={{ backgroundColor: '#121212', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#c5a059', fontWeight: 'bold', fontSize: '1.2rem' }}>Cargando mazos...</div>;
    }

    if (!user) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#121212', color: '#e0e0e0', fontFamily: 'sans-serif', padding: '20px', textAlign: 'center' }}>
                <h2 style={{ color: '#ff6b6b', fontSize: '2rem', marginBottom: '15px' }}>Acceso Restringido</h2>
                <p style={{ color: '#888', fontSize: '1.1rem', maxWidth: '400px', lineHeight: '1.5' }}>Debes iniciar sesión con tu cuenta para poder ver y gestionar tus mazos.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#121212', color: '#e0e0e0', minHeight: '100vh', padding: '30px', fontFamily: 'sans-serif', boxSizing: 'border-box' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', gap: '20px', flexWrap: 'wrap' }}>
                <input 
                    type="text" 
                    placeholder="Buscar mazo por nombre..." 
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    style={{ width: '100%', maxWidth: '400px', padding: '10px 15px', borderRadius: '6px', backgroundColor: '#1e1e1e', border: '1px solid #333', color: '#fff', outline: 'none' }}
                />
                <button 
                    onClick={() => {
                        if (onNavegar) onNavegar('crear_mazos');
                    }}
                    style={{ backgroundColor: '#c5a059', color: '#121212', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                    + Crear Mazo
                </button>
            </div>

            {mazosFiltrados.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {mazosFiltrados.map(m => {
                        const totalMain = m.mazoPrincipal ? m.mazoPrincipal.reduce((acc, item) => acc + item.cantidad, 0) : 0;
                        const totalSide = m.sideDeck ? m.sideDeck.reduce((acc, item) => acc + item.cantidad, 0) : 0;

                        return (
                            <div 
                                key={m.id} 
                                onClick={() => setMazoSeleccionado(m)}
                                style={{ backgroundColor: '#181818', border: '1px solid #333', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '15px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#c5a059'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#333'}
                            >
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <h3 style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>{m.nombre}</h3>
                                        <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', backgroundColor: m.esJugable ? '#1e3a23' : '#3a1e1e', color: m.esJugable ? '#6bff84' : '#ff6b6b', fontWeight: 'bold' }}>
                                            {m.esJugable ? 'Jugable' : 'Borrador'}
                                        </span>
                                    </div>
                                    <span style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Formato: {m.formato} | Main: {totalMain} | Side: {totalSide}</span>
                                    <span style={{ color: '#666', fontSize: '0.75rem' }}>Creado: {m.fechaCreacion}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
                                    <button 
                                        onClick={() => {
                                            localStorage.setItem('mazo_a_editar', JSON.stringify(m));
                                            if (onEditarMazo) onEditarMazo(m);
                                            if (onNavegar) onNavegar('crear_mazos');
                                        }}
                                        style={{ flex: 1, backgroundColor: '#222', color: '#c5a059', border: '1px solid #444', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        Editar
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(m.id)}
                                        style={{ backgroundColor: '#3a1e1e', color: '#ff6b6b', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        Borrar
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div style={{ color: '#666', textAlign: 'center', marginTop: '80px', fontSize: '0.95rem' }}>
                    No tienes mazos guardados o ninguno coincide con tu búsqueda.
                </div>
            )}

            {mazoSeleccionado && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', boxSizing: 'border-box' }}>
                    <div style={{ backgroundColor: '#181818', border: '1px solid #444', borderRadius: '12px', width: '100%', maxWidth: '950px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 25px', borderBottom: '1px solid #333', backgroundColor: '#1f1f1f' }}>
                            <div>
                                <h2 style={{ color: '#fff', margin: '0 0 5px 0', fontSize: '1.4rem' }}>{mazoSeleccionado.nombre}</h2>
                                <span style={{ color: '#888', fontSize: '0.85rem' }}>Formato: {mazoSeleccionado.formato} | Creado: {mazoSeleccionado.fechaCreacion}</span>
                            </div>
                            <button 
                                onClick={() => setMazoSeleccionado(null)}
                                style={{ backgroundColor: 'transparent', border: 'none', color: '#aaa', fontSize: '1.5rem', cursor: 'pointer', fontWeight: 'bold', padding: '5px 10px', borderRadius: '4px' }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ padding: '25px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '25px' }}>
                            
                            {/* SECCIÓN: Mazo Principal */}
                            <div>
                                <h3 style={{ color: '#c5a059', margin: '0 0 15px 0', fontSize: '1.1rem', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
                                    Mazo Principal ({mazoSeleccionado.mazoPrincipal ? mazoSeleccionado.mazoPrincipal.reduce((acc, i) => acc + i.cantidad, 0) : 0})
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                                    {mazoSeleccionado.mazoPrincipal && mazoSeleccionado.mazoPrincipal.map((item, index) => {
                                        const cartaData = item.carta || item;
                                        const imgUrl = cartaData.i || cartaData.imagen;
                                        const nombreCarta = cartaData.n || cartaData.nombre;

                                        return (
                                            <div 
                                                key={index} 
                                                style={{ backgroundColor: '#222', border: '1px solid #333', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                                            >
                                                {imgUrl ? (
                                                    <img src={imgUrl} alt={nombreCarta} style={{ width: '85px', height: '115px', objectFit: 'cover', borderRadius: '4px' }} />
                                                ) : (
                                                    <div style={{ width: '85px', height: '115px', backgroundColor: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777', fontSize: '0.75rem', borderRadius: '4px', textAlign: 'center' }}>Sin imagen</div>
                                                )}
                                                <span style={{ color: '#fff', fontSize: '0.8rem', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{nombreCarta}</span>
                                                <span style={{ backgroundColor: '#333', color: '#c5a059', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>x{item.cantidad}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* SECCIÓN: Side Deck */}
                            <div>
                                <h3 style={{ color: '#c5a059', margin: '0 0 15px 0', fontSize: '1.1rem', borderBottom: '1px solid #333', paddingBottom: '8px' }}>
                                    Side Deck ({mazoSeleccionado.sideDeck ? mazoSeleccionado.sideDeck.reduce((acc, i) => acc + i.cantidad, 0) : 0})
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                                    {mazoSeleccionado.sideDeck && mazoSeleccionado.sideDeck.length > 0 ? (
                                        mazoSeleccionado.sideDeck.map((item, index) => {
                                            const cartaData = item.carta || item;
                                            const imgUrl = cartaData.i || cartaData.imagen;
                                            const nombreCarta = cartaData.n || cartaData.nombre;

                                            return (
                                                <div 
                                                    key={index} 
                                                    style={{ backgroundColor: '#222', border: '1px solid #333', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
                                                >
                                                    {imgUrl ? (
                                                        <img src={imgUrl} alt={nombreCarta} style={{ width: '85px', height: '115px', objectFit: 'cover', borderRadius: '4px' }} />
                                                    ) : (
                                                        <div style={{ width: '85px', height: '115px', backgroundColor: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777', fontSize: '0.75rem', borderRadius: '4px', textAlign: 'center' }}>Sin imagen</div>
                                                    )}
                                                    <span style={{ color: '#fff', fontSize: '0.8rem', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{nombreCarta}</span>
                                                    <span style={{ backgroundColor: '#333', color: '#c5a059', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>x{item.cantidad}</span>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div style={{ color: '#777', fontSize: '0.85rem', gridColumn: '1 / -1' }}>No hay cartas en el Side Deck.</div>
                                    )}
                                </div>
                            </div>

                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '15px 25px', borderTop: '1px solid #333', backgroundColor: '#1f1f1f' }}>
                            <button 
                                onClick={() => {
                                    localStorage.setItem('mazo_a_editar', JSON.stringify(mazoSeleccionado));
                                    const mazoAEditar = mazoSeleccionado;
                                    setMazoSeleccionado(null);
                                    if (onEditarMazo) onEditarMazo(mazoAEditar);
                                    if (onNavegar) onNavegar('crear_mazos');
                                }}
                                style={{ backgroundColor: '#c5a059', color: '#121212', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                Editar Mazo
                            </button>
                            <button 
                                onClick={() => setMazoSeleccionado(null)}
                                style={{ backgroundColor: '#333', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}