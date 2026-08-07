import React, { useState, useEffect } from 'react';
import { fetchCards } from '../services/InfCard';

// Mapeo oficial de los códigos de raza a sus nombres legibles
const RAZAS_MAP = {
    0: 'Sin raza',
    1: 'Caballero',
    2: 'Bestia',
    3: 'Eterno',
    4: 'Guerrero',
    6: 'Fairy',
    8: 'Sombra',
    10: 'Sacerdote',
    11: 'Dragón',
    12: 'Héroe'
};

// Mapeo oficial de los códigos de frecuencia a sus nombres legibles
const FRECUENCIAS_MAP = {
    'AA': 'Arte Alternativo',
    'C': 'Cortesana',
    'IM': 'Inmortal',
    'JO': 'Juego Organizado',
    'MR': 'Mega Real',
    'O': 'Oro Promocional',
    'P': 'Promocional',
    'R': 'Real',
    'SP': 'Set Paralelo',
    'UR': 'Ultra Real',
    'V': 'Vasallo'
};

// Mapeo oficial de los códigos de tipo a sus nombres legibles
const TIPOS_MAP = {
    1: 'Aliado',
    2: 'Talismán',
    3: 'Arma',
    4: 'Tótem',
    5: 'Oro'
};

// Mapeo corregido y oficial con tus nuevos códigos de edición
const EDICIONES_MAP = {
    172: "AyD Vigilantes",
    171: "AyD Vigilantes: profecias",
    170: "Kit AyD Vigilantes: Serafin",
    169: "Kit AyD Vigilantes: Belial",
    168: "Imperio de Guerreros",
    167: "Imperio Eterno",
    166: "Imperio del Dragón",
    165: "JO Pecados Capitales",
    164: "Chile Oculto",
    163: "Toolkit 2025",
    162: "KVM Titanes",
    161: "Libertadores",
    160: "Onyria",
    159: "Aniversario 25",
    156: "Toolkit Cenizas de Fuego",
    155: "Toolkit Hielo Inmortal",
    150: "Lootbox 2024",
    149: "Secretos Arcanos",
    148: "Bestiarium",
    137: "Escuadron Mecha"
};

export default function CartCollection() {
    const [cartas, setCartas] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [cartaSeleccionada, setCartaSeleccionada] = useState(null);

    // Estados para los filtros
    const [filtroEdicion, setFiltroEdicion] = useState('Todas');
    const [filtroTipo, setFiltroTipo] = useState('Todas');
    const [filtroFrecuencia, setFiltroFrecuencia] = useState('Todas');
    const [filtroRaza, setFiltroRaza] = useState('Todas');
    const [filtroCoste, setFiltroCoste] = useState('Todas');
    const [filtroFuerza, setFiltroFuerza] = useState('Todas');

    // Cargar las cartas usando la función robusta fetchCards al montar el componente
    useEffect(() => {
        async function cargarDatos() {
            const resultado = await fetchCards();
            setCartas(resultado);
        }
        cargarDatos();
    }, []);

    // Extraer valores únicos dinámicamente y ordenarlos correctamente
    const obtenerOpciones = (key) => {
        const valoresRaw = cartas.map(c => c[key]);
        
        let valoresPlanos = [];
        valoresRaw.forEach(v => {
            if (v !== undefined && v !== null) {
                if (Array.isArray(v)) {
                    v.forEach(subItem => valoresPlanos.push(subItem));
                } else {
                    valoresPlanos.push(v);
                }
            }
        });

        const unicos = [...new Set(valoresPlanos)];

        unicos.sort((a, b) => {
            if (typeof a === 'number' && typeof b === 'number') {
                return a - b;
            }
            return String(a).localeCompare(String(b));
        });

        return ['Todas', ...unicos];
    };

    // Filtrado avanzado combinando buscador y selectores
    const cartasFiltradas = cartas.filter(carta => {
        const coincideBusqueda = carta.n.toLowerCase().includes(busqueda.toLowerCase()) || 
                                 (carta.h && carta.h.toLowerCase().includes(busqueda.toLowerCase()));
        
        // Lógica de edición blindada: compara por ID numérico y también por nombre textual mapeado
        const nombreEdicionMapeada = EDICIONES_MAP[filtroEdicion] ? EDICIONES_MAP[filtroEdicion].toLowerCase() : '';
        const coincideEdicion = filtroEdicion === 'Todas' || 
                               String(carta.e) === String(filtroEdicion) || 
                               String(carta.edicion) === String(filtroEdicion) ||
                               (carta.e && String(carta.e).toLowerCase() === nombreEdicionMapeada) ||
                               (carta.edicion && String(carta.edicion).toLowerCase() === nombreEdicionMapeada);
        
        const coincideTipo = filtroTipo === 'Todas' || String(carta.t) === String(filtroTipo);
        
        const coincideFrecuencia = filtroFrecuencia === 'Todas' || 
                                   carta.frecuencia === filtroFrecuencia || 
                                   carta.f === filtroFrecuencia;
        
        const coincideRaza = filtroRaza === 'Todas' || 
                             carta.raza === Number(filtroRaza) || 
                             carta.r === Number(filtroRaza) || 
                             (Array.isArray(carta.r) && carta.r.includes(Number(filtroRaza)));
        
        const coincideCoste = filtroCoste === 'Todas' || String(carta.c) === String(filtroCoste) || String(carta.coste) === String(filtroCoste);
        const coincideFuerza = filtroFuerza === 'Todas' || String(carta.z) === String(filtroFuerza) || String(carta.fuerza) === String(filtroFuerza);

        return coincideBusqueda && coincideEdicion && coincideTipo && coincideFrecuencia && coincideRaza && coincideCoste && coincideFuerza;
    });

    return (
        <div style={{ backgroundColor: '#121212', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'sans-serif', padding: '20px' }}>
            
            {/* Barra de Búsqueda y Filtros */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '30px', borderBottom: '1px solid #333', paddingBottom: '20px' }}>
                
                {/* Buscador */}
                <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                    <input 
                        type="text" 
                        placeholder="Buscar carta o habilidad..." 
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        style={{ width: '100%', padding: '10px 15px', borderRadius: '6px', backgroundColor: '#1e1e1e', border: '1px solid #333', color: '#fff', outline: 'none' }}
                    />
                </div>

                {/* Filtros dinámicos ordenados */}
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                    {[
                        { label: 'EDICIÓN', val: filtroEdicion, set: setFiltroEdicion, key: 'e' },
                        { label: 'TIPO', val: filtroTipo, set: setFiltroTipo, key: 't' },
                        { label: 'FRECUENCIA', val: filtroFrecuencia, set: setFiltroFrecuencia, key: 'f' },
                        { label: 'RAZA', val: filtroRaza, set: setFiltroRaza, key: 'r' },
                        { label: 'COSTE', val: filtroCoste, set: setFiltroCoste, key: 'c' },
                        { label: 'FUERZA', val: filtroFuerza, set: setFiltroFuerza, key: 'z' },
                    ].map((filtro, idx) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ color: '#888', fontWeight: 'bold', fontSize: '0.75rem' }}>{filtro.label}</span>
                            <select 
                                value={filtro.val} 
                                onChange={(e) => filtro.set(e.target.value)}
                                style={{ backgroundColor: '#1e1e1e', color: '#fff', border: '1px solid #333', padding: '6px 12px', borderRadius: '4px', outline: 'none', cursor: 'pointer' }}
                            >
                                {filtro.key === 'r' ? (
                                    <>
                                        <option value="Todas">Todas</option>
                                        {Object.entries(RAZAS_MAP).map(([num, nombre]) => (
                                            <option key={num} value={num}>{nombre}</option>
                                        ))}
                                    </>
                                ) : filtro.key === 'f' ? (
                                    <>
                                        <option value="Todas">Todas</option>
                                        {Object.entries(FRECUENCIAS_MAP).map(([codigo, nombre]) => (
                                            <option key={codigo} value={codigo}>{nombre}</option>
                                        ))}
                                    </>
                                ) : filtro.key === 't' ? (
                                    <>
                                        <option value="Todas">Todas</option>
                                        {Object.entries(TIPOS_MAP).map(([num, nombre]) => (
                                            <option key={num} value={num}>{nombre}</option>
                                        ))}
                                    </>
                                ) : filtro.key === 'e' ? (
                                    <>
                                        <option value="Todas">Todas</option>
                                        {Object.entries(EDICIONES_MAP)
                                            .sort((a, b) => Number(b[0]) - Number(a[0]))
                                            .map(([num, nombre]) => (
                                                <option key={num} value={num}>{nombre}</option>
                                            ))}
                                    </>
                                ) : (
                                    obtenerOpciones(filtro.key).map((opcion, i) => (
                                        <option key={i} value={opcion}>{opcion}</option>
                                    ))
                                )}
                            </select>
                        </div>
                    ))}
                </div>
            </div>

            {/* Grilla de Cartas Mejorada con Información Visible */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '15px' }}>
                {cartasFiltradas.map((carta) => (
                    <div 
                        key={carta.u} 
                        onClick={() => setCartaSeleccionada(carta)}
                        style={{ 
                            cursor: 'pointer', 
                            transition: 'transform 0.2s ease', 
                            borderRadius: '8px', 
                            overflow: 'hidden',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #333',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <img 
                            src={carta.i} 
                            alt={carta.n} 
                            loading="lazy" 
                            style={{ width: '100%', display: 'block', aspectRatio: '3/4', objectFit: 'cover' }} 
                        />
                        <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {carta.n}
                            </span>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#c5a059' }}>
                                <span>{TIPOS_MAP[carta.t] || 'Carta'}</span>
                                <span>{FRECUENCIAS_MAP[carta.f] || carta.f}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal / Panel de Inspección con Toda la Información */}
            {cartaSeleccionada && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000,
                    padding: '20px',
                    boxSizing: 'border-box'
                }}>
                    <div style={{
                        display: 'flex',
                        gap: '4px',
                        maxWidth: '1000px',
                        width: '100%',
                        alignItems: 'center',
                        position: 'relative'
                    }}>
                        {/* Botón cerrar general */}
                        <button 
                            onClick={() => setCartaSeleccionada(null)}
                            style={{
                                position: 'absolute',
                                top: '-40px',
                                right: '0',
                                background: 'none',
                                border: 'none',
                                color: '#fff',
                                fontSize: '2rem',
                                cursor: 'pointer'
                            }}
                        >
                            &times;
                        </button>

                        {/* Izquierda: Carta Grande */}
                        <div style={{ flex: '1', display: 'flex', justifyContent: 'center' }}>
                            <img 
                                src={cartaSeleccionada.i} 
                                alt={cartaSeleccionada.n} 
                                style={{ maxHeight: '80vh', maxWidth: '100%', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.9)' }} 
                            />
                        </div>

                        {/* Derecha: Panel de Información Completo */}
                        <div style={{ 
                            width: '400px', 
                            backgroundColor: '#181818', 
                            border: '1px solid #333', 
                            borderRadius: '12px', 
                            padding: '25px', 
                            boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                            maxHeight: '85vh',
                            overflowY: 'auto'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <span style={{ fontSize: '0.75rem', color: '#888', letterSpacing: '1px', fontWeight: 'bold' }}>CARTA DEL CÓDICE</span>
                            </div>

                            <h2 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px', textTransform: 'uppercase' }}>
                                {cartaSeleccionada.n}
                            </h2>

                            {/* Insignias con toda la información detallada */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                <span style={{ backgroundColor: '#222', border: '1px solid #444', padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem', color: '#c5a059' }}>
                                    Edición: {EDICIONES_MAP[cartaSeleccionada.e] || cartaSeleccionada.e}
                                </span>
                                <span style={{ backgroundColor: '#222', border: '1px solid #444', padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem', color: '#c5a059' }}>
                                    Tipo: {TIPOS_MAP[cartaSeleccionada.t] || cartaSeleccionada.t}
                                </span>
                                <span style={{ backgroundColor: '#222', border: '1px solid #444', padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem', color: '#c5a059' }}>
                                    Frecuencia: {FRECUENCIAS_MAP[cartaSeleccionada.f] || cartaSeleccionada.f}
                                </span>
                                {cartaSeleccionada.r && cartaSeleccionada.r.length > 0 && (
                                    <span style={{ backgroundColor: '#222', border: '1px solid #444', padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem', color: '#c5a059' }}>
                                        Raza: {cartaSeleccionada.r.map(rId => RAZAS_MAP[rId] || rId).join(', ')}
                                    </span>
                                )}
                                <span style={{ backgroundColor: '#222', border: '1px solid #444', padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                    ID: {cartaSeleccionada.u}
                                </span>
                                {cartaSeleccionada.c !== undefined && cartaSeleccionada.c !== null && (
                                    <span style={{ backgroundColor: '#222', border: '1px solid #444', padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                        Coste: {cartaSeleccionada.c}
                                    </span>
                                )}
                                {cartaSeleccionada.z !== undefined && cartaSeleccionada.z !== null && (
                                    <span style={{ backgroundColor: '#222', border: '1px solid #444', padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                        Fuerza: {cartaSeleccionada.z}
                                    </span>
                                )}
                            </div>

                            <div style={{ backgroundColor: '#121212', border: '1px solid #333', borderRadius: '8px', padding: '15px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', color: '#c5a059', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                    <span>Habilidad</span>
                                    <span>&#9650;</span>
                                </div>
                                <p style={{ fontSize: '0.9rem', lineHeight: '1.5', color: '#ccc', whiteSpace: 'pre-line', margin: 0 }}>
                                    {cartaSeleccionada.h || "Sin habilidad descrita."}
                                </p>
                            </div>

                            <button 
                                onClick={() => navigator.clipboard.writeText(cartaSeleccionada.h)}
                                style={{ width: '100%', backgroundColor: '#2a2a2a', color: '#fff', border: '1px solid #444', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '20px' }}
                            >
                                Copiar Habilidad
                            </button>

                            {/* Sección Otras Versiones */}
                            <div>
                                <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>OTRAS VERSIONES</span>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <div style={{ width: '60px', border: '2px solid #c5a059', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer' }}>
                                        <img src={cartaSeleccionada.i} alt="Versión" style={{ width: '100%', display: 'block' }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}