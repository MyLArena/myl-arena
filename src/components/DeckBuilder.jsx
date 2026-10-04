import React, { useState, useEffect } from 'react';
import { fetchCards } from '../services/InfCard';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { app } from '../services/firebase'; 

const db = getFirestore(app);

const RAZAS_MAP = {
    0: 'Sin raza', 1: 'Caballero', 2: 'Bestia', 3: 'Eterno', 4: 'Guerrero',
    6: 'Fairy', 8: 'Sombra', 10: 'Sacerdote', 11: 'Dragón', 12: 'Héroe'
};
const FRECUENCIAS_MAP = {
    'AA': 'Arte Alternativo', 'C': 'Cortesana', 'IM': 'Inmortal', 'JO': 'Juego Organizado',
    'MR': 'Mega Real', 'O': 'Oro Promocional', 'P': 'Promocional', 'R': 'Real',
    'SP': 'Set Paralelo', 'UR': 'Ultra Real', 'V': 'Vasallo'
};
const TIPOS_MAP = { 1: 'Aliado', 2: 'Talismán', 3: 'Arma', 4: 'Tótem', 5: 'Oro' };
const EDICIONES_MAP = {
    173: "Drácula", 172: "AyD Vigilantes", 171: "AyD Vigilantes: profecias", 170: "Kit AyD Vigilantes: Serafin",
    169: "Kit AyD Vigilantes: Belial", 168: "Imperio de Guerreros", 167: "Imperio Eterno",
    166: "Imperio del Dragón", 165: "JO Pecados Capitales", 164: "Chile Oculto",
    163: "Toolkit 2025", 162: "KVM Titanes", 161: "Libertadores", 160: "Onyria",
    159: "Aniversario 25", 156: "Toolkit Cenizas de Fuego", 155: "Toolkit Hielo Inmortal",
    150: "Lootbox 2024", 149: "Secretos Arcanos", 148: "Bestiarium", 137: "Escuadron Mecha"
};

const ESTRUCTURA_TIPOS = [
    { id: 1, label: 'ALIADOS' },
    { id: 4, label: 'TÓTEMS' },
    { id: 3, label: 'ARMAS' },
    { id: 2, label: 'TALISMANES' },
    { id: 5, label: 'OROS' }
];

// Función para remover tildes y pasar a minúsculas
const normalizeString = (str) => {
    if (str === null || str === undefined) return '';
    return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

// Función para obtener el ID único seguro de una carta
const getIdUnico = (carta) => carta?.u ?? carta?.id ?? carta?._id;

// Función para obtener siempre el ID correcto numérico del tipo
const getTipoId = (carta) => {
    let val = carta?.t ?? carta?.tipo ?? carta?.type;
    if (val === undefined || val === null) return 99;
    
    const numVal = Number(val);
    if (!isNaN(numVal) && TIPOS_MAP[numVal]) return numVal;
    
    const strVal = String(val).toLowerCase();
    const found = Object.entries(TIPOS_MAP).find(([k, v]) => String(v).toLowerCase() === strVal);
    return found ? Number(found[0]) : 99;
};

export default function DeckBuilder() {
    const [cartas, setCartas] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [cartaSeleccionada, setCartaSeleccionada] = useState(null);

    const [filtroEdicion, setFiltroEdicion] = useState('Todas');
    const [filtroTipo, setFiltroTipo] = useState('Todas');
    const [filtroFrecuencia, setFiltroFrecuencia] = useState('Todas');
    const [filtroRaza, setFiltroRaza] = useState('Todas');
    const [filtroCoste, setFiltroCoste] = useState('Todas');
    const [filtroFuerza, setFiltroFuerza] = useState('Todas');

    const [nombreMazo, setNombreMazo] = useState('Nuevo Mazo');
    const [formato, setFormato] = useState('IMP');
    const [mazoPrincipal, setMazoPrincipal] = useState([]);
    const [sideDeck, setSideDeck] = useState([]);
    const [destinoSeleccionado, setDestinoSeleccionado] = useState('MAIN');
    const [idMazo, setIdMazo] = useState(null);

    const [mostrarModalDuplicado, setMostrarModalDuplicado] = useState(false);
    const [user, setUser] = useState(null); 
    const [cargandoAuth, setCargandoAuth] = useState(true);
    const [notificacion, setNotificacion] = useState(null);

    const mostrarMensaje = (texto, tipo = 'success') => {
        setNotificacion({ texto, tipo });
        setTimeout(() => {
            setNotificacion(null);
        }, 3500);
    };

    useEffect(() => {
        const auth = getAuth(app);
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setCargandoAuth(false);
        });

        async function cargarDatos() {
            try {
                const resultado = await fetchCards();
                // Prevención por si el JSON incluye el arreglo dentro de una llave "cards"
                const arrayCartas = Array.isArray(resultado) ? resultado : (resultado?.cards || []);
                setCartas(arrayCartas);
            } catch (error) {
                console.error("Error al cargar cartas:", error);
                setCartas([]);
            }
        }
        cargarDatos();

        const mazoAEditar = localStorage.getItem('mazo_a_editar');
        if (mazoAEditar) {
            try {
                const mazoObj = JSON.parse(mazoAEditar);
                if (mazoObj) {
                    setNombreMazo(mazoObj.nombre || 'Nuevo Mazo');
                    setFormato(mazoObj.formato || 'IMP');
                    setMazoPrincipal(mazoObj.mazoPrincipal || []);
                    setSideDeck(mazoObj.sideDeck || []);
                    setIdMazo(mazoObj.id || null);
                }
            } catch (error) {
                console.error("Error al cargar el mazo para editar:", error);
            }
            localStorage.removeItem('mazo_a_editar');
        }

        return () => unsubscribe();
    }, []);

    const agregarCarta = (carta) => {
        const cartaId = getIdUnico(carta);
        const setMazo = destinoSeleccionado === 'MAIN' ? setMazoPrincipal : setSideDeck;
        setMazo(prev => {
            let nuevoMazo;
            const existe = prev.find(item => getIdUnico(item.carta) === cartaId);
            
            if (existe) {
                nuevoMazo = prev.map(item => getIdUnico(item.carta) === cartaId ? { ...item, cantidad: item.cantidad + 1 } : item);
            } else {
                nuevoMazo = [...prev, { carta, cantidad: 1 }];
            }

            return nuevoMazo.sort((a, b) => {
                const ordenTipos = { 1: 1, 4: 2, 3: 3, 2: 4, 5: 5 };
                
                const tipoA = ordenTipos[getTipoId(a.carta)] || 99;
                const tipoB = ordenTipos[getTipoId(b.carta)] || 99;
                
                if (tipoA !== tipoB) return tipoA - tipoB;
                
                const costeA = (a.carta.c ?? a.carta.coste ?? a.carta.cost) !== undefined && (a.carta.c ?? a.carta.coste ?? a.carta.cost) !== null ? Number(a.carta.c ?? a.carta.coste ?? a.carta.cost) : 99;
                const costeB = (b.carta.c ?? b.carta.coste ?? b.carta.cost) !== undefined && (b.carta.c ?? b.carta.coste ?? b.carta.cost) !== null ? Number(b.carta.c ?? b.carta.coste ?? b.carta.cost) : 99;
                if (costeA !== costeB) return costeA - costeB;
                
                const nombreA = String(a.carta.n ?? a.carta.nombre ?? a.carta.name ?? '').toLowerCase();
                const nombreB = String(b.carta.n ?? b.carta.nombre ?? b.carta.name ?? '').toLowerCase();
                return nombreA.localeCompare(nombreB);
            });
        });
    };

    const quitarCarta = (cartaId, esSide) => {
        const setMazo = esSide ? setSideDeck : setMazoPrincipal;
        setMazo(prev => {
            const existe = prev.find(item => getIdUnico(item.carta) === cartaId);
            if (existe && existe.cantidad > 1) {
                return prev.map(item => getIdUnico(item.carta) === cartaId ? { ...item, cantidad: item.cantidad - 1 } : item);
            }
            return prev.filter(item => getIdUnico(item.carta) !== cartaId);
        });
    };

    const totalMain = mazoPrincipal.reduce((acc, item) => acc + item.cantidad, 0);
    const totalSide = sideDeck.reduce((acc, item) => acc + item.cantidad, 0);
    const esJugable = totalMain === 50 && totalSide <= 15;

    const ejecutarGuardado = async (forzarReemplazo = false) => {
        const nombreLimpio = nombreMazo.trim();
        if (!nombreLimpio) {
            mostrarMensaje('Por favor, asigna un nombre válido al mazo.', 'error');
            return;
        }

        if (!user) {
            mostrarMensaje('Debes iniciar sesión para guardar mazos.', 'error');
            return;
        }

        const mazoId = idMazo || Date.now();

        const optimizarLista = (lista) => lista.map(item => ({
            cantidad: item.cantidad,
            carta: {
                u: getIdUnico(item.carta), 
                n: item.carta.n ?? item.carta.nombre ?? item.carta.name, 
                i: item.carta.i ?? item.carta.imagen ?? item.carta.img ?? item.carta.image,
                t: item.carta.t ?? item.carta.tipo ?? item.carta.type, 
                c: item.carta.c ?? item.carta.coste ?? item.carta.cost,
                e: item.carta.e ?? item.carta.edicion ?? item.carta.edition,
                f: item.carta.f ?? item.carta.frecuencia ?? item.carta.frequency,
                r: item.carta.r ?? item.carta.raza ?? item.carta.race,
                z: item.carta.z ?? item.carta.fuerza ?? item.carta.power,
                h: item.carta.h ?? item.carta.habilidad ?? item.carta.ability ?? item.carta.text
            }
        }));

        const mazoAguardar = {
            id: mazoId,
            nombre: nombreLimpio,
            formato,
            mazoPrincipal: optimizarLista(mazoPrincipal),
            sideDeck: optimizarLista(sideDeck),
            esJugable,
            fechaCreacion: new Date().toLocaleDateString()
        };

        // --- SOLUCIÓN ---
        // Sanitiza el objeto eliminando valores 'undefined' y convirtiéndolos a 'null'
        // Esto evita el error: FirebaseError: Function setDoc() called with invalid data.
        const mazoLimpio = JSON.parse(
            JSON.stringify(mazoAguardar, (key, value) => (value === undefined ? null : value))
        );

        try {
            if (!idMazo && !forzarReemplazo) {
                const docRef = doc(db, `usuarios/${user.uid}/mazos`, mazoId.toString());
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && !forzarReemplazo) {
                    setMostrarModalDuplicado(true);
                    return;
                }
            }
            // Utilizamos 'mazoLimpio' en el setDoc
            await setDoc(doc(db, `usuarios/${user.uid}/mazos`, mazoId.toString()), mazoLimpio);
            mostrarMensaje('¡Mazo guardado en la nube exitosamente!');
        } catch (error) {
            console.error("Error al guardar en Firestore:", error);
            mostrarMensaje('Hubo un error al sincronizar con la nube.', 'error');
        }

        setMostrarModalDuplicado(false);
    };

    const guardarMazo = () => ejecutarGuardado(false);
    const confirmarReemplazo = () => ejecutarGuardado(true);

    const obtenerOpciones = (key) => {
        const mapaClavesAlternas = { 
            e: ['edicion', 'edition'], 
            t: ['tipo', 'type'], 
            f: ['frecuencia', 'frequency'], 
            r: ['raza', 'race'], 
            c: ['coste', 'cost'], 
            z: ['fuerza', 'power'] 
        };
        const clavesAlternas = mapaClavesAlternas[key] || [key];

        const valoresRaw = cartas.map(c => {
            for (let k of [key, ...clavesAlternas]) {
                if (c[k] !== undefined && c[k] !== null) return c[k];
            }
            return undefined;
        });

        let valoresPlanos = [];
        valoresRaw.forEach(v => {
            if (v !== undefined && v !== null && v !== '') {
                Array.isArray(v) ? v.forEach(subItem => valoresPlanos.push(subItem)) : valoresPlanos.push(v);
            }
        });
        const unicos = [...new Set(valoresPlanos)].sort((a, b) => (typeof a === 'number' && typeof b === 'number') ? a - b : String(a).localeCompare(String(b)));
        return ['Todas', ...unicos];
    };

    // Filtrado robusto de cartas
    let cartasFiltradas = cartas.filter(carta => {
        const queryBusqueda = normalizeString(busqueda);
        const nombreStr = normalizeString(carta.n ?? carta.nombre ?? carta.name);
        const habilidadStr = normalizeString(carta.h ?? carta.habilidad ?? carta.ability ?? carta.text);
        
        // Separa la búsqueda por espacios para que deban coincidir todas las palabras tipeadas
        const terms = queryBusqueda.split(/\s+/).filter(Boolean);
        const coincideBusqueda = terms.length === 0 || terms.every(term => 
            nombreStr.includes(term) || habilidadStr.includes(term)
        );
        
        // Edición
        const valorEdicionRaw = carta.e ?? carta.edicion ?? carta.edition;
        const nombreEdicionMapeada = EDICIONES_MAP[filtroEdicion] ? normalizeString(EDICIONES_MAP[filtroEdicion]) : '';
        const coincideEdicion = filtroEdicion === 'Todas' || (() => {
            const valores = Array.isArray(valorEdicionRaw) ? valorEdicionRaw : [valorEdicionRaw];
            return valores.some(v => {
                if (v === undefined || v === null) return false;
                const strV = String(v);
                return strV === String(filtroEdicion) || 
                       normalizeString(strV) === normalizeString(filtroEdicion) ||
                       (nombreEdicionMapeada && normalizeString(strV) === nombreEdicionMapeada);
            });
        })();
        
        // Tipo
        const valorTipoRaw = carta.t ?? carta.tipo ?? carta.type;
        const nombreTipoMapeado = TIPOS_MAP[filtroTipo] ? normalizeString(TIPOS_MAP[filtroTipo]) : '';
        const coincideTipo = filtroTipo === 'Todas' || (() => {
            const valores = Array.isArray(valorTipoRaw) ? valorTipoRaw : [valorTipoRaw];
            return valores.some(v => {
                if (v === undefined || v === null) return false;
                const strV = String(v);
                return strV === String(filtroTipo) ||
                       normalizeString(strV) === normalizeString(filtroTipo) ||
                       (nombreTipoMapeado && normalizeString(strV) === nombreTipoMapeado);
            });
        })();
        
        // Frecuencia
        const valorFrecuenciaRaw = carta.f ?? carta.frecuencia ?? carta.frequency;
        const nombreFrecMapeada = FRECUENCIAS_MAP[filtroFrecuencia] ? normalizeString(FRECUENCIAS_MAP[filtroFrecuencia]) : '';
        const codigoFrecEncontrado = Object.entries(FRECUENCIAS_MAP).find(([code, name]) => normalizeString(name) === normalizeString(filtroFrecuencia))?.[0] || '';
        const coincideFrecuencia = filtroFrecuencia === 'Todas' || (() => {
            const valores = Array.isArray(valorFrecuenciaRaw) ? valorFrecuenciaRaw : [valorFrecuenciaRaw];
            return valores.some(v => {
                if (v === undefined || v === null) return false;
                const strV = String(v);
                return strV === String(filtroFrecuencia) ||
                       normalizeString(strV) === normalizeString(filtroFrecuencia) ||
                       (nombreFrecMapeada && normalizeString(strV) === nombreFrecMapeada) ||
                       (codigoFrecEncontrado && strV.toUpperCase() === codigoFrecEncontrado.toUpperCase());
            });
        })();
        
        // Raza
        const valorRazaRaw = carta.r ?? carta.raza ?? carta.race;
        const nombreRazaMapeada = RAZAS_MAP[filtroRaza] ? normalizeString(RAZAS_MAP[filtroRaza]) : '';
        const codigoRazaEncontrado = Object.entries(RAZAS_MAP).find(([num, name]) => normalizeString(name) === normalizeString(filtroRaza))?.[0] || '';
        const coincideRaza = filtroRaza === 'Todas' || (() => {
            const valores = Array.isArray(valorRazaRaw) ? valorRazaRaw : [valorRazaRaw];
            return valores.some(v => {
                if (v === undefined || v === null) return false;
                const strV = String(v);
                return strV === String(filtroRaza) ||
                       normalizeString(strV) === normalizeString(filtroRaza) ||
                       (nombreRazaMapeada && normalizeString(strV) === nombreRazaMapeada) ||
                       (codigoRazaEncontrado && strV === codigoRazaEncontrado);
            });
        })();
                             
        // Coste
        const valorCosteRaw = carta.c ?? carta.coste ?? carta.cost;
        const coincideCoste = filtroCoste === 'Todas' || (() => {
            const valores = Array.isArray(valorCosteRaw) ? valorCosteRaw : [valorCosteRaw];
            return valores.some(v => {
                if (v === undefined || v === null || v === '') return false;
                return String(v) === String(filtroCoste) || Number(v) === Number(filtroCoste);
            });
        })();
        
        // Fuerza
        const valorFuerzaRaw = carta.z ?? carta.fuerza ?? carta.power;
        const coincideFuerza = filtroFuerza === 'Todas' || (() => {
            const valores = Array.isArray(valorFuerzaRaw) ? valorFuerzaRaw : [valorFuerzaRaw];
            return valores.some(v => {
                if (v === undefined || v === null || v === '') return false;
                return String(v) === String(filtroFuerza) || Number(v) === Number(filtroFuerza);
            });
        })();
        
        return coincideBusqueda && coincideEdicion && coincideTipo && coincideFrecuencia && coincideRaza && coincideCoste && coincideFuerza;
    });

    // Ordenar resultados de búsqueda para que las coincidencias por Nombre aparezcan primero
    if (busqueda.trim() !== '') {
        const query = normalizeString(busqueda);
        cartasFiltradas.sort((a, b) => {
            const nombreA = normalizeString(a.n ?? a.nombre ?? a.name);
            const nombreB = normalizeString(b.n ?? b.nombre ?? b.name);
            
            const aNameStarts = nombreA.startsWith(query);
            const bNameStarts = nombreB.startsWith(query);
            if (aNameStarts && !bNameStarts) return -1;
            if (!aNameStarts && bNameStarts) return 1;

            const aNameIncludes = nombreA.includes(query);
            const bNameIncludes = nombreB.includes(query);
            if (aNameIncludes && !bNameIncludes) return -1;
            if (!aNameIncludes && bNameIncludes) return 1;
            
            return 0; 
        });
    }

    const RenderItemMazo = ({ item, esSide }) => {
        const costeCarta = item.carta.c ?? item.carta.coste ?? item.carta.cost;
        const nombreCarta = item.carta.n ?? item.carta.nombre ?? item.carta.name;
        const cartaId = getIdUnico(item.carta);
        return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#222', padding: '6px 10px', borderRadius: '6px', marginBottom: '4px', border: '1px solid #333' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    <span style={{ color: '#c5a059', fontWeight: 'bold', minWidth: '15px' }}>x{item.cantidad}</span>
                    {costeCarta !== undefined && costeCarta !== null && costeCarta !== '' && <span style={{ backgroundColor: '#444', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.75rem' }}>{costeCarta}</span>}
                    <span style={{ color: '#e0e0e0', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={nombreCarta}>{nombreCarta}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => quitarCarta(cartaId, esSide)} style={{ background: '#3a1e1e', color: '#ff6b6b', border: 'none', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                    <button onClick={() => agregarCarta(item.carta)} style={{ background: '#1e3a23', color: '#6bff84', border: 'none', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                </div>
            </div>
        );
    };

    const renderMazoAgrupado = (mazo, esSide) => {
        if (mazo.length === 0) {
            return (
                <div style={{ color: '#666', textAlign: 'center', marginTop: '40px' }}>
                    {esSide ? 'El side deck está vacío.' : 'El mazo principal está vacío. Haz clic en el "+" de una carta para añadirla.'}
                </div>
            );
        }

        const tiposMapeadosIds = ESTRUCTURA_TIPOS.map(t => t.id);
        const cartasOtros = mazo.filter(item => !tiposMapeadosIds.includes(getTipoId(item.carta)));

        return (
            <>
                {ESTRUCTURA_TIPOS.map(tipo => {
                    const cartasDelTipo = mazo.filter(item => getTipoId(item.carta) === tipo.id);
                    if (cartasDelTipo.length === 0) return null;

                    const totalCartasTipo = cartasDelTipo.reduce((acc, item) => acc + item.cantidad, 0);

                    return (
                        <div key={tipo.id} style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: '0.75rem', fontWeight: 'bold', letterSpacing: '0.5px', margin: '8px 0 6px 2px', borderBottom: '1px solid #2a2a2a', paddingBottom: '4px' }}>
                                <span style={{ width: '6px', height: '6px', backgroundColor: '#c5a059', borderRadius: '50%', display: 'inline-block' }}></span>
                                <span>{tipo.label} ({totalCartasTipo})</span>
                            </div>
                            {cartasDelTipo.map(item => <RenderItemMazo key={getIdUnico(item.carta)} item={item} esSide={esSide} />)}
                        </div>
                    );
                })}

                {cartasOtros.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888', fontSize: '0.75rem', fontWeight: 'bold', margin: '8px 0 6px 2px', borderBottom: '1px solid #2a2a2a', paddingBottom: '4px' }}>
                            <span style={{ width: '6px', height: '6px', backgroundColor: '#888', borderRadius: '50%', display: 'inline-block' }}></span>
                            <span>OTROS ({cartasOtros.reduce((acc, item) => acc + item.cantidad, 0)})</span>
                        </div>
                        {cartasOtros.map(item => <RenderItemMazo key={getIdUnico(item.carta)} item={item} esSide={esSide} />)}
                    </div>
                )}
            </>
        );
    };

    if (cargandoAuth) {
        return <div style={{ backgroundColor: '#121212', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#c5a059', fontWeight: 'bold', fontSize: '1.2rem' }}>Verificando sesión...</div>;
    }

    if (!user) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#121212', color: '#e0e0e0', fontFamily: 'sans-serif', padding: '20px', textAlign: 'center' }}>
                <h2 style={{ color: '#ff6b6b', fontSize: '2rem', marginBottom: '15px' }}>Acceso Restringido</h2>
                <p style={{ color: '#888', fontSize: '1.1rem', maxWidth: '400px', lineHeight: '1.5' }}>Debes iniciar sesión con tu cuenta para poder crear y guardar mazos en la nube.</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', backgroundColor: '#121212', color: '#e0e0e0', height: '100vh', fontFamily: 'sans-serif', overflow: 'hidden', position: 'relative' }}>
            
            {notificacion && (
                <div style={{
                    position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
                    backgroundColor: notificacion.tipo === 'error' ? '#3a1e1e' : '#1e3a23',
                    color: notificacion.tipo === 'error' ? '#ff6b6b' : '#6bff84',
                    border: `1px solid ${notificacion.tipo === 'error' ? '#ff6b6b' : '#6bff84'}`,
                    padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    transition: 'all 0.3s ease'
                }}>
                    {notificacion.texto}
                </div>
            )}

            {/* PANEL IZQUIERDO */}
            <div style={{ flex: '2', display: 'flex', flexDirection: 'column', padding: '20px', overflowY: 'auto', borderRight: '1px solid #333' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '20px' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                        <input 
                            type="text" 
                            placeholder="Buscar carta o habilidad..." 
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            style={{ width: '100%', padding: '10px 15px', borderRadius: '6px', backgroundColor: '#1e1e1e', border: '1px solid #333', color: '#fff', outline: 'none' }}
                        />
                    </div>
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
                                    <option value="Todas">Todas</option>
                                    {filtro.key === 'r' ? Object.entries(RAZAS_MAP).map(([num, nombre]) => <option key={num} value={num}>{nombre}</option>) :
                                     filtro.key === 'f' ? Object.entries(FRECUENCIAS_MAP).map(([codigo, nombre]) => <option key={codigo} value={codigo}>{nombre}</option>) :
                                     filtro.key === 't' ? Object.entries(TIPOS_MAP).map(([num, nombre]) => <option key={num} value={num}>{nombre}</option>) :
                                     filtro.key === 'e' ? Object.entries(EDICIONES_MAP).sort((a, b) => Number(b[0]) - Number(a[0])).map(([num, nombre]) => <option key={num} value={num}>{nombre}</option>) :
                                     obtenerOpciones(filtro.key).filter(o => o !== 'Todas').map((opcion, i) => <option key={i} value={opcion}>{opcion}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', paddingBottom: '20px' }}>
                    {cartasFiltradas.map((carta) => {
                        const nombreCarta = carta.n ?? carta.nombre ?? carta.name;
                        const imagenCarta = carta.i ?? carta.imagen ?? carta.img ?? carta.image;
                        const cartaId = getIdUnico(carta);
                        return (
                            <div key={cartaId || Math.random()} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#1a1a1a', border: '1px solid #333', transition: 'transform 0.1s', cursor: 'pointer' }}>
                                <img 
                                    src={imagenCarta} alt={nombreCarta} loading="lazy" 
                                    onClick={() => setCartaSeleccionada(carta)}
                                    style={{ width: '100%', display: 'block', aspectRatio: '3/4', objectFit: 'cover' }} 
                                />
                                <button 
                                    onClick={(e) => { e.stopPropagation(); agregarCarta(carta); }}
                                    style={{ position: 'absolute', top: '5px', right: '5px', backgroundColor: '#c5a059', color: '#000', border: 'none', borderRadius: '50%', width: '30px', height: '30px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                                    title="Añadir al mazo activo"
                                >
                                    +
                                </button>
                                <div style={{ padding: '6px', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {nombreCarta}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* PANEL DERECHO */}
            <div style={{ flex: '1', display: 'flex', flexDirection: 'column', backgroundColor: '#181818', padding: '20px', minWidth: '350px' }}>
                <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#c5a059', whiteSpace: 'nowrap' }}>Nombre del Mazo:</span>
                        <input 
                            type="text" 
                            value={nombreMazo} 
                            onChange={(e) => setNombreMazo(e.target.value)}
                            style={{ flex: 1, fontSize: '1.2rem', fontWeight: 'bold', backgroundColor: 'transparent', border: 'none', borderBottom: '2px solid #c5a059', color: '#fff', outline: 'none', padding: '5px 0' }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <select 
                            value={formato} 
                            onChange={(e) => setFormato(e.target.value)}
                            style={{ backgroundColor: '#222', color: '#c5a059', border: '1px solid #444', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', outline: 'none' }}
                        >
                            <option value="IMP">Formato: Imperio (IMP)</option>
                            <option value="VCR">Formato: VCR</option>
                        </select>
                        <span style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', backgroundColor: esJugable ? '#1e3a23' : '#3a1e1e', color: esJugable ? '#6bff84' : '#ff6b6b', fontWeight: 'bold' }}>
                            {esJugable ? '✔ Mazo Jugable' : 'Borrador'}
                        </span>
                    </div>

                    <div>
                        <button 
                            onClick={guardarMazo}
                            style={{ width: '100%', backgroundColor: '#c5a059', color: '#121212', border: 'none', padding: '12px', borderRadius: '6px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
                        >
                            Guardar Mazo
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', borderBottom: '1px solid #333', marginBottom: '15px' }}>
                    <button 
                        onClick={() => setDestinoSeleccionado('MAIN')}
                        style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', color: destinoSeleccionado === 'MAIN' ? '#c5a059' : '#888', border: 'none', borderBottom: destinoSeleccionado === 'MAIN' ? '2px solid #c5a059' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Mazo Principal ({totalMain}/50)
                    </button>
                    <button 
                        onClick={() => setDestinoSeleccionado('SIDE')}
                        style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', color: destinoSeleccionado === 'SIDE' ? '#c5a059' : '#888', border: 'none', borderBottom: destinoSeleccionado === 'SIDE' ? '2px solid #c5a059' : '2px solid transparent', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Side Deck ({totalSide}/15)
                    </button>
                </div>

                <div style={{ flex: '1', overflowY: 'auto', paddingRight: '5px' }}>
                    {destinoSeleccionado === 'MAIN' ? (
                        renderMazoAgrupado(mazoPrincipal, false)
                    ) : (
                        renderMazoAgrupado(sideDeck, true)
                    )}
                </div>
            </div>

            {/* MODAL DE DUPLICADO / REEMPLAZO */}
            {mostrarModalDuplicado && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '20px' }}>
                    <div style={{ backgroundColor: '#181818', border: '1px solid #444', borderRadius: '12px', width: '100%', maxWidth: '450px', padding: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={{ color: '#fff', margin: 0, fontSize: '1.2rem' }}>¿Mazo existente?</h3>
                        <p style={{ color: '#ccc', fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>
                            Ya existe un mazo con este nombre o ID en tu cuenta. ¿Deseas reemplazarlo con los cambios actuales o prefieres cambiarle el nombre?
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                            <button 
                                onClick={() => setMostrarModalDuplicado(false)}
                                style={{ backgroundColor: '#333', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                Cambiar Nombre
                            </button>
                            <button 
                                onClick={confirmarReemplazo}
                                style={{ backgroundColor: '#c5a059', color: '#121212', border: 'none', padding: '10px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                Reemplazar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Detalle de Carta */}
            {cartaSeleccionada && (() => {
                const nombreModal = cartaSeleccionada.n ?? cartaSeleccionada.nombre ?? cartaSeleccionada.name;
                const tipoModal = cartaSeleccionada.t ?? cartaSeleccionada.tipo ?? cartaSeleccionada.type;
                const costeModal = cartaSeleccionada.c ?? cartaSeleccionada.coste ?? cartaSeleccionada.cost;
                const habilidadModal = cartaSeleccionada.h ?? cartaSeleccionada.habilidad ?? cartaSeleccionada.ability ?? cartaSeleccionada.text;
                const imagenModal = cartaSeleccionada.i ?? cartaSeleccionada.imagen ?? cartaSeleccionada.img ?? cartaSeleccionada.image;

                return (
                    <div 
                        onClick={() => setCartaSeleccionada(null)}
                        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', boxSizing: 'border-box' }}
                    >
                        <div 
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'flex', gap: '20px', maxWidth: '900px', width: '100%', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <div style={{ flex: '1', display: 'flex', justifyContent: 'center' }}>
                                <img src={imagenModal} alt={nombreModal} style={{ maxHeight: '80vh', maxWidth: '100%', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.9)' }} />
                            </div>
                            <div style={{ width: '350px', backgroundColor: '#181818', border: '1px solid #333', borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', maxHeight: '80vh' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '15px 15px 0 15px' }}>
                                    <button 
                                        onClick={() => setCartaSeleccionada(null)} 
                                        style={{ background: 'none', border: 'none', color: '#888', fontSize: '2rem', cursor: 'pointer', lineHeight: '1', transition: 'color 0.2s' }}
                                        onMouseOver={(e) => e.target.style.color = '#fff'}
                                        onMouseOut={(e) => e.target.style.color = '#888'}
                                    >
                                        &times;
                                    </button>
                                </div>
                                <div style={{ padding: '0 20px 20px 20px', overflowY: 'auto' }}>
                                    <h2 style={{ fontSize: '1.5rem', color: '#fff', marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px', textTransform: 'uppercase' }}>{nombreModal}</h2>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                        <span style={{ backgroundColor: '#222', border: '1px solid #444', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', color: '#c5a059' }}>{TIPOS_MAP[tipoModal] || tipoModal}</span>
                                        {costeModal !== undefined && costeModal !== null && costeModal !== '' && <span style={{ backgroundColor: '#222', border: '1px solid #444', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>Coste: {costeModal}</span>}
                                    </div>
                                    <div style={{ backgroundColor: '#121212', border: '1px solid #333', borderRadius: '8px', padding: '15px', marginBottom: '20px' }}>
                                        <span style={{ display: 'block', marginBottom: '10px', color: '#c5a059', fontWeight: 'bold', fontSize: '0.85rem' }}>Habilidad</span>
                                        <p style={{ fontSize: '0.85rem', lineHeight: '1.5', color: '#ccc', margin: 0, whiteSpace: 'pre-line' }}>{habilidadModal || "Sin habilidad descrita."}</p>
                                    </div>
                                    <button 
                                        onClick={() => { agregarCarta(cartaSeleccionada); setCartaSeleccionada(null); }}
                                        style={{ width: '100%', backgroundColor: '#1e3a23', color: '#6bff84', border: '1px solid #2e5a33', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        Añadir al Mazo
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}