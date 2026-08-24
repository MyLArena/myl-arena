import React, { useState, useEffect, useCallback, useRef } from 'react';
import { socketService } from '../services/socketService';
import './SolitaryBoard.css';

const invertBoardState = (state) => {
  return {
    mazo: state.opMazo, opMazo: state.mazo,
    mano: state.opMano, opMano: state.mano,
    ataque: state.opAtaque, opAtaque: state.ataque,
    defensa: state.opDefensa, opDefensa: state.defensa,
    apoyo: state.opApoyo, opApoyo: state.apoyo,
    oroPagado: state.opOroPagado, opOroPagado: state.oroPagado,
    oroReserva: state.opOroReserva, opOroReserva: state.oroReserva,
    cementerio: state.opCementerio, opCementerio: state.cementerio,
    destierro: state.opDestierro, opDestierro: state.destierro,
    topRevelado: state.opTopRevelado, opTopRevelado: state.topRevelado
  };
};

const MultiplayerBoard = ({ mazo, roomCode = "SALA-TEST", esCreador = true, onSalir }) => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [inspectCard, setInspectCard] = useState(null);
  const [deckMenuOpen, setDeckMenuOpen] = useState(false);
  const [opDeckMenuOpen, setOpDeckMenuOpen] = useState(false);
  const [viewingZone, setViewingZone] = useState(null); 
  const [revealedTopModal, setRevealedTopModal] = useState(null);
  const [privateTopModal, setPrivateTopModal] = useState(null);
  const [activeCardMenu, setActiveCardMenu] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [pings, setPings] = useState([]);

  // --- ESTADOS DE SIDE DECK Y MAZOS ORIGINALES ---
  const [sideDeckModalOpen, setSideDeckModalOpen] = useState(false);
  const [deckPrincipalOriginal, setDeckPrincipalOriginal] = useState([]);
  const [sideDeckCartas, setSideDeckCartas] = useState([]);

  // --- ESTADOS DE LA CALCULADORA ---
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPrevValue, setCalcPrevValue] = useState(null);
  const [calcOperation, setCalcOperation] = useState(null);
  const [calcClearOnNext, setCalcClearOnNext] = useState(false);

  const [opCalcDisplay, setOpCalcDisplay] = useState('0');
  const [opCalcPrevValue, setOpCalcPrevValue] = useState(null);
  const [opCalcOperation, setOpCalcOperation] = useState(null);
  const [opCalcClearOnNext, setOpCalcClearOnNext] = useState(false);

  // --- ESTADOS DE REVELAR MANO ---
  const [manoRevelada, setManoRevelada] = useState(false);
  const [opManoRevelada, setOpManoRevelada] = useState(false);

  const [boardState, setBoardState] = useState({
    mazo: [], mano: [],
    ataque: [], defensa: [], apoyo: [],
    oroPagado: [], oroReserva: [], cementerio: [], destierro: [],
    opMazo: [], opMano: [], opCementerio: [], opDestierro: [], opOroPagado: [], opOroReserva: [],
    opAtaque: [], opDefensa: [], opApoyo: [],
    topRevelado: false, opTopRevelado: false
  });

  // Ref para evitar que cambios en callbacks reinicien el socket de forma cíclica
  const onSalirRef = useRef(onSalir);
  useEffect(() => {
    onSalirRef.current = onSalir;
  }, [onSalir]);

  const addLog = useCallback((msg) => {
    setSystemLogs(prev => {
      const newLogs = [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`];
      return newLogs.slice(-15);
    });
  }, []);

  const emitLog = useCallback((msg) => {
    addLog(msg);
    socketService.emit('syncLog', msg);
  }, [addLog]);

  // Corrección: Separación pura del updater y la emisión de socket
  const setAndSyncBoardState = useCallback((action) => {
    setBoardState(prev => {
      const newState = typeof action === 'function' ? action(prev) : action;
      queueMicrotask(() => {
        socketService.emit('syncBoard', invertBoardState(newState));
      });
      return newState;
    });
  }, []);

  // Manejo de conexión de Socket estable
  useEffect(() => {
    const actionType = esCreador ? 'create' : 'join';
    socketService.connect(roomCode, actionType);

    socketService.on('room_error', (mensaje) => {
      alert(mensaje);
      if (onSalirRef.current) onSalirRef.current();
    });

    socketService.on('request_sync', () => {
      setAndSyncBoardState(prev => prev);
    });

    socketService.on('syncBoard', (invertedState) => {
      setBoardState(invertedState);
    });

    socketService.on('playerJoined', (opDeck) => {
      setAndSyncBoardState(prev => ({ ...prev, opMazo: opDeck }));
      addLog("Un jugador se ha conectado. Sincronizando tableros...");
    });

    socketService.on('syncLog', (msg) => {
      addLog(`Rival: ${msg}`);
    });

    socketService.on('ping', (data) => {
      const id = Date.now() + Math.random();
      setPings(prev => [...prev, { x: data.x, y: data.y, id }]);
      setTimeout(() => setPings(prev => prev.filter(p => p.id !== id)), 1500);
    });

    socketService.on('syncReveal', (isRevealed) => {
      setOpManoRevelada(isRevealed);
    });

    socketService.on('syncRevealedTop', (modalState) => {
      if (!modalState) return;
      const invertedZone = modalState.zona === 'mazo' ? 'opMazo' : (modalState.zona === 'opMazo' ? 'mazo' : modalState.zona);
      setRevealedTopModal({ ...modalState, zona: invertedZone });
    });

    socketService.on('closeRevealedTop', () => {
      setRevealedTopModal(null);
    });

    socketService.on('syncCalcLocal', (calcData) => {
      setOpCalcDisplay(calcData.display);
      setOpCalcPrevValue(calcData.prevValue);
      setOpCalcOperation(calcData.operation);
      setOpCalcClearOnNext(calcData.clearOnNext);
    });

    return () => {
      socketService.disconnect();
    };
  }, [roomCode, esCreador, addLog, setAndSyncBoardState]);

  // --- CARGA DEL MAZO Y SIDE DECK INICIAL ---
  useEffect(() => {
    if (mazo) {
      const expandedDeck = [];
      if (mazo.mazoPrincipal) {
        mazo.mazoPrincipal.forEach(item => {
          for (let i = 0; i < item.cantidad; i++) {
            expandedDeck.push({ 
              ...item.carta, 
              instanciaId: Math.random().toString(36).substr(2, 9),
              rotation: 0,
              faceDown: false,
              groupId: null,
              stats: { fuerza: 0, fuerzaPermanente: 0 }
            });
          }
        });
      }
      setDeckPrincipalOriginal(expandedDeck);
      setBoardState(prev => ({ ...prev, mazo: [...expandedDeck] }));

      const expandedSide = [];
      if (mazo.sideDeck) {
        mazo.sideDeck.forEach(item => {
          for (let i = 0; i < item.cantidad; i++) {
            expandedSide.push({ 
              ...item.carta, 
              instanciaId: Math.random().toString(36).substr(2, 9),
              rotation: 0,
              faceDown: false,
              groupId: null,
              stats: { fuerza: 0, fuerzaPermanente: 0 }
            });
          }
        });
      }
      setSideDeckCartas(expandedSide);

      socketService.emit('playerJoined', expandedDeck);
      addLog("Mazo y Side Deck cargados exitosamente.");
    }
  }, [mazo, addLog]);

  useEffect(() => {
    socketService.emit('syncCalcLocal', {
      display: calcDisplay,
      prevValue: calcPrevValue,
      operation: calcOperation,
      clearOnNext: calcClearOnNext
    });
  }, [calcDisplay, calcPrevValue, calcOperation, calcClearOnNext]);

  useEffect(() => {
    socketService.emit('syncReveal', manoRevelada);
  }, [manoRevelada]);

  const getZoneOfCard = useCallback((instanciaId) => {
    for (const [zona, cartas] of Object.entries(boardState)) {
      if (Array.isArray(cartas) && cartas.some(c => c.instanciaId === instanciaId)) return zona;
    }
    return null;
  }, [boardState]);

  // --- MECÁNICA: REINICIO DE MAZO (RESET) ---
  const handleResetDeck = () => {
    setAndSyncBoardState(prev => {
      const todasLasCartasPropias = [
        ...prev.mazo, ...prev.mano, ...prev.ataque, ...prev.defensa, ...prev.apoyo,
        ...prev.oroPagado, ...prev.oroReserva, ...prev.cementerio, ...prev.destierro
      ];

      const mazoReinicio = todasLasCartasPropias.map(c => ({
        ...c, rotation: 0, faceDown: false, groupId: null, stats: { fuerza: 0, fuerzaPermanente: 0 }
      })).sort(() => Math.random() - 0.5);

      return {
        ...prev, mazo: mazoReinicio, mano: [], ataque: [], defensa: [], apoyo: [],
        oroPagado: [], oroReserva: [], cementerio: [], destierro: []
      };
    });

    emitLog("Ha reiniciado su mazo devolviendo todas las cartas al mazo principal y barajándolo.");
    setDeckMenuOpen(false);
  };

  // --- MECÁNICA: OUIJA (PRIMERA DESCUBIERTA) ---
  const toggleTopRevelado = (lado = 'local') => {
    setAndSyncBoardState(prev => ({
      ...prev,
      ...(lado === 'local' ? { topRevelado: !prev.topRevelado } : { opTopRevelado: !prev.opTopRevelado })
    }));
    setDeckMenuOpen(false);
    setOpDeckMenuOpen(false);
  };

  // --- MECÁNICA: INTERCAMBIO DE SIDE DECK ---
  const intercambiarCartaSideDeck = (cartaId, origenEsSide) => {
    if (origenEsSide) {
      const carta = sideDeckCartas.find(c => c.instanciaId === cartaId);
      if (!carta) return;

      setSideDeckCartas(prev => prev.filter(c => c.instanciaId !== cartaId));
      setAndSyncBoardState(prev => ({ ...prev, mazo: [...prev.mazo, carta] }));
      emitLog("Movió una carta del Side Deck al Mazo.");
    } else {
      if (sideDeckCartas.length >= 15) {
        alert("El Side Deck no puede tener más de 15 cartas.");
        return;
      }

      const carta = boardState.mazo.find(c => c.instanciaId === cartaId);
      if (!carta) return;

      setAndSyncBoardState(prev => ({ ...prev, mazo: prev.mazo.filter(c => c.instanciaId !== cartaId) }));
      setSideDeckCartas(prev => [...prev, carta]);
      emitLog("Movió una carta del Mazo al Side Deck.");
    }
  };

  // --- LÓGICA DRAG & DROP FÍSICA ---
  const handleDragStart = (e, carta, origen) => {
    let baseSelectedIds = selectedCards.some(c => c.instanciaId === carta.instanciaId) 
      ? selectedCards.map(c => c.instanciaId) 
      : [carta.instanciaId];

    let payloadCards = [];
    Object.values(boardState).flat().forEach(c => {
       if (c && c.instanciaId && baseSelectedIds.includes(c.instanciaId)) {
           payloadCards.push({...c});
       }
    });

    const groupIds = payloadCards.map(c => c.groupId).filter(Boolean);
    if (groupIds.length > 0) {
      Object.values(boardState).flat().forEach(c => {
        if (c && c.groupId && groupIds.includes(c.groupId) && !payloadCards.some(pc => pc.instanciaId === c.instanciaId)) {
          payloadCards.push({...c});
        }
      });
    }

    e.dataTransfer.setData('cartas', JSON.stringify(payloadCards));
    e.dataTransfer.setData('origen', origen);
    if (activeCardMenu) setActiveCardMenu(null);
  };

  const handleDragEnd = () => {};
  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e, destino) => {
    e.preventDefault();
    const cartasData = e.dataTransfer.getData('cartas');
    if (!cartasData) return;
    
    const cartasPayload = JSON.parse(cartasData);
    const origen = e.dataTransfer.getData('origen');
    if (!origen) return;

    const idsAMover = cartasPayload.map(c => c.instanciaId);

    setAndSyncBoardState(prev => {
      let newState = { ...prev };
      for (const key in newState) {
        if (Array.isArray(newState[key])) {
          newState[key] = newState[key].filter(c => !idsAMover.includes(c.instanciaId));
        }
      }
      let nuevoDestino = [...(newState[destino] || [])];
      cartasPayload.forEach(carta => {
        if (destino.toLowerCase().includes('mazo')) nuevoDestino = [carta, ...nuevoDestino];
        else nuevoDestino.push(carta);
      });
      newState[destino] = nuevoDestino;
      return newState;
    });
    
    setSelectedCards([]);
  };

  // Corrección: Inmutabilidad estricta al manipular snapshots en modales
  const handleDropInternalModal = (e, zona, targetIndex = null) => {
    e.preventDefault();
    const cartasData = e.dataTransfer.getData('cartas');
    if (!cartasData) return;
    const cartasPayload = JSON.parse(cartasData);

    if (revealedTopModal && revealedTopModal.zona === zona) {
      let updatedSnapshot = [...revealedTopModal.snapshot].filter(
        item => !cartasPayload.some(c => c.instanciaId === item.instanciaId)
      );
      if (targetIndex !== null && targetIndex >= 0) {
        updatedSnapshot.splice(targetIndex, 0, ...cartasPayload);
      } else {
        updatedSnapshot.push(...cartasPayload);
      }

      setRevealedTopModal(prev => (prev ? { ...prev, snapshot: updatedSnapshot } : null));
      setAndSyncBoardState(bState => ({ ...bState, [zona]: updatedSnapshot }));
      setSelectedCards([]);
      return;
    }

    if (privateTopModal && privateTopModal.zona === zona) {
      let updatedSnapshot = [...privateTopModal.snapshot].filter(
        item => !cartasPayload.some(c => c.instanciaId === item.instanciaId)
      );
      if (targetIndex !== null && targetIndex >= 0) {
        updatedSnapshot.splice(targetIndex, 0, ...cartasPayload);
      } else {
        updatedSnapshot.push(...cartasPayload);
      }

      setPrivateTopModal(prev => (prev ? { ...prev, snapshot: updatedSnapshot } : null));
      setAndSyncBoardState(bState => ({ ...bState, [zona]: updatedSnapshot }));
      setSelectedCards([]);
      return;
    }

    setAndSyncBoardState(prev => {
      let newState = { ...prev };
      cartasPayload.forEach(carta => {
        for (const key in newState) {
          if (Array.isArray(newState[key])) {
            newState[key] = newState[key].filter(c => c.instanciaId !== carta.instanciaId);
          }
        }
      });
      let zonaCartas = [...(newState[zona] || [])];
      if (targetIndex !== null && targetIndex >= 0) zonaCartas.splice(targetIndex, 0, ...cartasPayload);
      else zonaCartas.push(...cartasPayload);

      newState[zona] = zonaCartas;
      return newState;
    });
    
    setSelectedCards([]);
  };

  const accionarMazo = useCallback((accion, lado = 'local') => {
    const zonaMazo = lado === 'local' ? 'mazo' : 'opMazo';
    if (accion === 'inspeccionar') { 
      setViewingZone(zonaMazo); 
      setDeckMenuOpen(false); 
      setOpDeckMenuOpen(false); 
      return; 
    }

    if (accion === 'mostrarTop' || accion === 'mirarTop') {
      if (boardState[zonaMazo].length === 0) return;
      const setter = accion === 'mostrarTop' ? setRevealedTopModal : setPrivateTopModal;
      
      setter(current => {
        const newState = (current && current.zona === zonaMazo)
          ? { ...current, revealedCount: Math.min(current.revealedCount + 1, current.snapshot.length) }
          : { zona: zonaMazo, snapshot: [...boardState[zonaMazo]], revealedCount: 1 };
        
        if (accion === 'mostrarTop') {
          socketService.emit('syncRevealedTop', newState);
        }
        return newState;
      });
      
      setDeckMenuOpen(false);
      setOpDeckMenuOpen(false);
      emitLog(accion === 'mostrarTop' ? `Mostró la carta superior del mazo ${lado === 'local' ? '' : 'rival'}.` : `Miró la carta superior del mazo ${lado === 'local' ? '' : 'rival'}.`);
      return;
    }

    if (boardState[zonaMazo].length === 0) return;
    
    setAndSyncBoardState(prev => {
      const mazoCopia = [...prev[zonaMazo]];
      if (accion === 'barajar') {
        mazoCopia.sort(() => Math.random() - 0.5);
        emitLog(`Mazo ${lado === 'local' ? 'propio' : 'rival'} barajado.`);
        return { ...prev, [zonaMazo]: mazoCopia };
      }
      
      const cartaExtraida = mazoCopia.shift();
      const nuevoEstado = { ...prev, [zonaMazo]: mazoCopia };

      const targetMano = lado === 'local' ? 'mano' : 'opMano';
      const targetCementerio = lado === 'local' ? 'cementerio' : 'opCementerio';
      const targetDestierro = lado === 'local' ? 'destierro' : 'opDestierro';

      if (accion === 'robar') { nuevoEstado[targetMano] = [...prev[targetMano], cartaExtraida]; emitLog(`Robó una carta ${lado === 'local' ? '' : 'del rival'}.`); }
      if (accion === 'botar') { nuevoEstado[targetCementerio] = [...prev[targetCementerio], cartaExtraida]; emitLog(`Botó una carta ${lado === 'local' ? '' : 'del rival'}.`); }
      if (accion === 'desterrar') { nuevoEstado[targetDestierro] = [...prev[targetDestierro], cartaExtraida]; emitLog(`Desterró una carta del mazo ${lado === 'local' ? '' : 'rival'}.`); }
      
      return nuevoEstado;
    });

    if (accion !== 'robar') {
      setDeckMenuOpen(false);
      setOpDeckMenuOpen(false);
    }
  }, [boardState, emitLog, setAndSyncBoardState]);

  // Corrección: Verificación completa de inputs, textareas, selects y editables
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isEditing = activeEl && (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) ||
        activeEl.isContentEditable ||
        activeEl.closest('input, select, textarea, [contenteditable="true"]')
      );

      if (isEditing) return;

      const key = e.key.toLowerCase();
      if (key === 'r') accionarMazo('robar');
      if (key === 's') accionarMazo('barajar');
      if (key === 't') accionarMazo('mostrarTop');
      if (key === 'b') accionarMazo('botar');
      
      if (selectedCards.length > 0) {
        if (key === 'f') {
          selectedCards.forEach(c => modificarCarta(c.instanciaId, getZoneOfCard(c.instanciaId), 'voltear'));
        }
        if (e.key === 'Delete' && !e.shiftKey) {
          selectedCards.forEach(c => moverCarta(c.instanciaId, getZoneOfCard(c.instanciaId), getZoneOfCard(c.instanciaId).startsWith('op') ? 'opCementerio' : 'cementerio'));
        }
        if (e.key === 'Delete' && e.shiftKey) {
          selectedCards.forEach(c => moverCarta(c.instanciaId, getZoneOfCard(c.instanciaId), getZoneOfCard(c.instanciaId).startsWith('op') ? 'opDestierro' : 'destierro'));
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [accionarMazo, selectedCards, getZoneOfCard]);

  const modificarCarta = (instanciaId, zona, modificacion, valorExtra = 0) => {
    const isSelected = selectedCards.some(c => c.instanciaId === instanciaId);
    const idsAModificar = isSelected ? selectedCards.map(c => c.instanciaId) : [instanciaId];

    setAndSyncBoardState(prev => {
      const zonaActualizada = prev[zona].map(c => {
        if (idsAModificar.includes(c.instanciaId)) {
          if (modificacion === 'rotar') return { ...c, rotation: c.rotation === 0 ? 180 : 0 };
          if (modificacion === 'voltear') return { ...c, faceDown: !c.faceDown };
          if (modificacion === 'fuerza') return { ...c, stats: { ...c.stats, fuerza: (c.stats?.fuerza || 0) + valorExtra } };
          if (modificacion === 'resetFuerza') return { ...c, stats: { ...c.stats, fuerza: 0 } };
          if (modificacion === 'fuerzaPermanente') return { ...c, stats: { ...c.stats, fuerzaPermanente: (c.stats?.fuerzaPermanente || 0) + valorExtra } };
          if (modificacion === 'resetFuerzaPermanente') return { ...c, stats: { ...c.stats, fuerzaPermanente: 0 } };
        }
        return c;
      });
      return { ...prev, [zona]: zonaActualizada };
    });

    if (!['fuerza', 'resetFuerza', 'fuerzaPermanente', 'resetFuerzaPermanente'].includes(modificacion)) setActiveCardMenu(null);
  };

  const moverCarta = (instanciaId, zonaOrigen, zonaDestino) => {
    if (zonaOrigen === zonaDestino) { setActiveCardMenu(null); return; }

    let baseIds = selectedCards.some(c => c.instanciaId === instanciaId) 
      ? selectedCards.map(c => c.instanciaId) 
      : [instanciaId];

    setAndSyncBoardState(prev => {
      let newState = { ...prev };
      
      let payload = [];
      Object.values(newState).flat().forEach(c => {
         if (c && c.instanciaId && baseIds.includes(c.instanciaId)) {
             payload.push({...c});
         }
      });

      const groupIds = payload.map(c => c.groupId).filter(Boolean);
      if (groupIds.length > 0) {
        Object.values(newState).flat().forEach(c => {
          if (c && c.groupId && groupIds.includes(c.groupId) && !payload.some(pc => pc.instanciaId === c.instanciaId)) {
            payload.push({...c});
          }
        });
      }

      payload.forEach(carta => {
        for (const key in newState) {
          if (Array.isArray(newState[key])) {
            newState[key] = newState[key].filter(c => c.instanciaId !== carta.instanciaId);
          }
        }
      });

      let nuevoDestino = [...(newState[zonaDestino] || [])];
      payload.forEach(carta => {
        if (zonaDestino.toLowerCase().includes('mazo')) nuevoDestino = [carta, ...nuevoDestino];
        else nuevoDestino.push(carta);
      });
      
      newState[zonaDestino] = nuevoDestino;
      return newState;
    });
    
    setActiveCardMenu(null);
    setSelectedCards([]); 
  };

  const moverAlFondoMazo = (instanciaId, zonaOrigen, esRival = false) => {
    let baseIds = selectedCards.some(c => c.instanciaId === instanciaId) 
      ? selectedCards.map(c => c.instanciaId) 
      : [instanciaId];
      
    const zonaMazoDestino = esRival ? 'opMazo' : 'mazo';

    setAndSyncBoardState(prev => {
      let newState = { ...prev };
      
      let payload = [];
      Object.values(newState).flat().forEach(c => {
         if (c && c.instanciaId && baseIds.includes(c.instanciaId)) {
             payload.push({...c});
         }
      });

      payload.forEach(carta => {
        for (const key in newState) {
          if (Array.isArray(newState[key])) {
            newState[key] = newState[key].filter(c => c.instanciaId !== carta.instanciaId);
          }
        }
      });
      
      let nuevoMazo = [...newState[zonaMazoDestino]];
      payload.forEach(carta => { nuevoMazo.push(carta); });
      newState[zonaMazoDestino] = nuevoMazo;
      
      return newState;
    });
    
    setActiveCardMenu(null);
    setSelectedCards([]); 
  };

  const agruparSeleccionadas = () => {
    if (selectedCards.length < 2) return;
    const newGroupId = Math.random().toString(36).substr(2, 9);
    setAndSyncBoardState(prev => {
      let newState = { ...prev };
      selectedCards.forEach(carta => {
        const zona = getZoneOfCard(carta.instanciaId);
        if (zona) {
          newState[zona] = newState[zona].map(c => c.instanciaId === carta.instanciaId ? { ...c, groupId: newGroupId } : c);
        }
      });
      return newState;
    });
    setActiveCardMenu(null);
    setSelectedCards([]);
  };

  const separarCarta = (instanciaId, zona) => {
    const cartaTarget = boardState[zona]?.find(c => c.instanciaId === instanciaId);
    const targetGroupId = cartaTarget?.groupId;

    setAndSyncBoardState(prev => {
      let newState = { ...prev };
      for (const key in newState) {
        if (Array.isArray(newState[key])) {
          newState[key] = newState[key].map(c => {
            if ((targetGroupId && c.groupId === targetGroupId) || c.instanciaId === instanciaId) {
              return { ...c, groupId: null };
            }
            return c;
          });
        }
      }
      return newState;
    });
    setActiveCardMenu(null);
  };

  const lanzarAzar = (tipo) => {
    let result = '';
    if (tipo === 'moneda') result = Math.random() > 0.5 ? 'Cara' : 'Sello';
    if (tipo === 'd6') result = Math.floor(Math.random() * 6) + 1;
    if (tipo === 'd20') result = Math.floor(Math.random() * 20) + 1;
    emitLog(`Lanzamiento de ${tipo}: ${result}`);
  };

  const handlePing = (e) => {
    if (e.altKey) {
      const id = Date.now();
      const pingData = { x: e.clientX, y: e.clientY, id };
      setPings(prev => [...prev, pingData]);
      socketService.emit('ping', { x: e.clientX, y: e.clientY });
      setTimeout(() => setPings(prev => prev.filter(p => p.id !== id)), 1500);
    }
  };

  const handleCalcInput = (digit, isOp = false) => {
    const display = isOp ? opCalcDisplay : calcDisplay;
    const setDisplay = isOp ? setOpCalcDisplay : setCalcDisplay;
    const clearOnNext = isOp ? opCalcClearOnNext : calcClearOnNext;
    const setClearOnNext = isOp ? setOpCalcClearOnNext : setCalcClearOnNext;

    if (display === '0' || clearOnNext) {
      setDisplay(digit);
      setClearOnNext(false);
    } else {
      setDisplay(display + digit);
    }
  };

  const handleCalcOperation = (op, isOp = false) => {
    const display = isOp ? opCalcDisplay : calcDisplay;
    const setDisplay = isOp ? setOpCalcDisplay : setCalcDisplay;
    const prevValue = isOp ? opCalcPrevValue : calcPrevValue;
    const setPrevValue = isOp ? setOpCalcPrevValue : setCalcPrevValue;
    const operation = isOp ? opCalcOperation : calcOperation;
    const setOperation = isOp ? setOpCalcOperation : setCalcOperation;
    const setClearOnNext = isOp ? setOpCalcClearOnNext : setCalcClearOnNext;

    const current = parseFloat(display);
    if (prevValue === null) {
      setPrevValue(current);
    } else if (operation) {
      let res = prevValue;
      if (operation === '+') res = prevValue + current;
      if (operation === '-') res = prevValue - current;
      if (operation === '*') res = prevValue * current;
      setPrevValue(res);
      setDisplay(String(res));
    }
    setOperation(op);
    setClearOnNext(true);
  };

  const handleCalcEquals = (isOp = false) => {
    const display = isOp ? opCalcDisplay : calcDisplay;
    const setDisplay = isOp ? setOpCalcDisplay : setCalcDisplay;
    const prevValue = isOp ? opCalcPrevValue : calcPrevValue;
    const setPrevValue = isOp ? setOpCalcPrevValue : setCalcPrevValue;
    const operation = isOp ? opCalcOperation : calcOperation;
    const setOperation = isOp ? setOpCalcOperation : setCalcOperation;
    const setClearOnNext = isOp ? setOpCalcClearOnNext : setCalcClearOnNext;

    if (prevValue === null || operation === null) return;
    const current = parseFloat(display);
    let res = prevValue;
    if (operation === '+') res = prevValue + current;
    if (operation === '-') res = prevValue - current;
    if (operation === '*') res = prevValue * current;
    setDisplay(String(res));
    setPrevValue(null);
    setOperation(null);
    setClearOnNext(true);
  };

  const handleCalcReset = (isOp = false) => {
    const setDisplay = isOp ? setOpCalcDisplay : setCalcDisplay;
    const setPrevValue = isOp ? setOpCalcPrevValue : setCalcPrevValue;
    const setOperation = isOp ? setOpCalcOperation : setCalcOperation;
    const setClearOnNext = isOp ? setOpCalcClearOnNext : setCalcClearOnNext;

    setDisplay('0');
    setPrevValue(null);
    setOperation(null);
    setClearOnNext(false);
  };

  const renderCalculatorWidget = (isOp = false) => {
    const display = isOp ? opCalcDisplay : calcDisplay;
    return (
      <div style={{ display: 'inline-block' }}>
        <div 
          className="calculator player-calculator-widget" 
          onClick={(e) => e.stopPropagation()} 
          style={{ background: 'rgba(20,20,20,0.9)', border: '1px solid #c5a059', borderRadius: '6px', padding: '8px', color: '#fff', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}
        >
          <div style={{ background: '#111', border: '1px solid #444', padding: '4px 6px', textAlign: 'right', fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold', color: '#c5a059', borderRadius: '4px', overflow: 'hidden' }}>
            {display}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
            <button onClick={() => handleCalcInput('7', isOp)} style={{ padding: '4px', background: '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>7</button>
            <button onClick={() => handleCalcInput('8', isOp)} style={{ padding: '4px', background: '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>8</button>
            <button onClick={() => handleCalcInput('9', isOp)} style={{ padding: '4px', background: '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>9</button>
            <button onClick={() => handleCalcOperation('+', isOp)} style={{ padding: '4px', background: '#c5a059', color: '#000', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>

            <button onClick={() => handleCalcInput('4', isOp)} style={{ padding: '4px', background: '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>4</button>
            <button onClick={() => handleCalcInput('5', isOp)} style={{ padding: '4px', background: '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>5</button>
            <button onClick={() => handleCalcInput('6', isOp)} style={{ padding: '4px', background: '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>6</button>
            <button onClick={() => handleCalcOperation('-', isOp)} style={{ padding: '4px', background: '#c5a059', color: '#000', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}>-</button>

            <button onClick={() => handleCalcInput('1', isOp)} style={{ padding: '4px', background: '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>1</button>
            <button onClick={() => handleCalcInput('2', isOp)} style={{ padding: '4px', background: '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>2</button>
            <button onClick={() => handleCalcInput('3', isOp)} style={{ padding: '4px', background: '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>3</button>
            <button onClick={() => handleCalcOperation('*', isOp)} style={{ padding: '4px', background: '#c5a059', color: '#000', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}>×</button>

            <button onClick={() => handleCalcInput('0', isOp)} style={{ padding: '4px', background: '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', gridColumn: 'span 2' }}>0</button>
            <button onClick={() => handleCalcEquals(isOp)} style={{ padding: '4px', background: '#c5a059', color: '#000', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}>=</button>
            <button onClick={() => handleCalcReset(isOp)} style={{ padding: '4px', background: '#d9534f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}>C</button>
          </div>
        </div>
      </div>
    );
  };

  const renderCard = (carta, zona, isHand = false, customOnClick = null) => {
    const cardClass = isHand ? 'card-item-hand' : 'card-item-board';
    const isSelected = selectedCards.some(c => c.instanciaId === carta.instanciaId) ? 'card-selected' : '';
    const isGrouped = carta.groupId ? 'card-grouped' : '';
    
    const isHidden = carta.faceDown || 
                     (zona === 'opMano' && !opManoRevelada) || 
                     (zona === 'opMazo' && !carta.reveladaPublicamente);
                     
    const fuerzaValor = carta.stats?.fuerza || 0;
    const fuerzaPermValor = carta.stats?.fuerzaPermanente || 0;

    return (
      <div 
        key={carta.instanciaId} 
        className={`${cardClass} ${isSelected} ${isGrouped} card-container-wrapper`}
        draggable={true}
        style={{ transform: `rotate(${carta.rotation || 0}deg)`, flexShrink: 0 }}
        onDragStart={(e) => handleDragStart(e, carta, zona)}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          e.stopPropagation();
          if (activeCardMenu) setActiveCardMenu(null);
          
          if (customOnClick) {
            customOnClick();
            return;
          }

          if (e.shiftKey) {
            setSelectedCards(prev => {
              const exists = prev.some(c => c.instanciaId === carta.instanciaId);
              if (exists) return prev.filter(c => c.instanciaId !== carta.instanciaId);
              return [...prev, carta];
            });
          } else {
            if (!isHidden) setInspectCard(carta);
            setSelectedCards([]);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const menuHeight = 280;
          const menuWidth = 180;
          let posX = e.clientX;
          let posY = e.clientY;

          if (posY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 10;
          if (posX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 10;

          setActiveCardMenu({ cartaId: carta.instanciaId, zona, carta, x: posX, y: posY });
        }}
        title={isHidden ? 'Carta Oculta' : (carta.n || carta.nombre)}
      >
        {!isHidden && fuerzaValor !== 0 && (
          <div className="card-counter-badge">{fuerzaValor > 0 ? `+${fuerzaValor}` : fuerzaValor}</div>
        )}
        {!isHidden && fuerzaPermValor !== 0 && (
          <div className="card-counter-badge-permanent" style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: '#d9534f', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', border: '1px solid #fff', zIndex: 10 }}>
            {fuerzaPermValor > 0 ? `+${fuerzaPermValor}` : fuerzaPermValor}
          </div>
        )}
        {isHidden ? (
          <div className="card-back-official" style={{width: '100%', height: '100%', backgroundColor: '#2a1b10', border: '2px solid #5a3c20'}}></div>
        ) : (
          carta.i ? <img src={carta.i} alt={carta.n} draggable="false" className="card-image" /> : <div className="card-placeholder">{carta.n || 'Carta'}</div>
        )}
      </div>
    );
  };

  const mapZoneTitle = {
    mazo: 'Mazo Principal', opMazo: 'Mazo Oponente',
    cementerio: 'Cementerio', destierro: 'Zona de Destierro', oroPagado: 'Oro Pagado', oroReserva: 'Oro Reserva',
    opCementerio: 'Cementerio Rival', opDestierro: 'Destierro Rival', opOroPagado: 'Oro Pagado Rival', opOroReserva: 'Oro Reserva Rival'
  };

  return (
    <div 
      className="arena-container wrapper-bounds-fixed"
      onClick={() => { if(deckMenuOpen) setDeckMenuOpen(false); if(opDeckMenuOpen) setOpDeckMenuOpen(false); if(activeCardMenu) setActiveCardMenu(null); }}
      onMouseDown={handlePing}
    >
      {pings.map(p => (
        <div key={p.id} className="ping-animation" style={{ left: p.x, top: p.y }}></div>
      ))}

      {/* --- BOTÓN SIDE DECK --- */}
      <button 
        onClick={(e) => { e.stopPropagation(); setSideDeckModalOpen(true); }} 
        style={{ position: 'absolute', bottom: '180px', left: '20px', zIndex: 2000, backgroundColor: '#1a1a1a', color: '#c5a059', border: '1px solid #c5a059', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
      >
        🗂️ Side Deck ({sideDeckCartas.length}/15)
      </button>

      <div className="system-panel" style={{ position: 'absolute', top: 60, right: 20, width: '250px', zIndex: 1000, background: 'rgba(0,0,0,0.85)', border: '1px solid #c5a059', color: '#fff', padding: '10px', fontSize: '12px', borderRadius: '6px' }}>
        <div style={{ color: '#c5a059', fontWeight: 'bold', marginBottom: '8px', fontSize: '14px', textAlign: 'center', borderBottom: '1px solid #444', paddingBottom: '5px' }}>
          🔑 Sala: <span style={{ color: '#fff' }}>{roomCode}</span>
        </div>
        <div className="rng-controls" style={{ display: 'flex', gap: '5px', marginBottom: '10px', marginTop: '5px' }}>
          <button onClick={() => lanzarAzar('moneda')}>Moneda</button>
          <button onClick={() => lanzarAzar('d6')}>D6</button>
          <button onClick={() => lanzarAzar('d20')}>D20</button>
        </div>
        <div className="log-box" style={{ maxHeight: '130px', overflowY: 'auto', borderTop: '1px solid #444', paddingTop: '5px' }}>
          {systemLogs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>

      <button onClick={(e) => { e.stopPropagation(); setShowConfirmModal(true); }} className="exit-x-button" title="Abandonar Partida">✕</button>

      {/* --- MENÚ CONTEXTUAL GLOBAL --- */}
      {activeCardMenu && (() => {
        const isOp = activeCardMenu.zona.startsWith('op');
        const dest = {
          mano: isOp ? 'opMano' : 'mano',
          mazo: isOp ? 'opMazo' : 'mazo',
          cementerio: isOp ? 'opCementerio' : 'cementerio',
          destierro: isOp ? 'opDestierro' : 'destierro',
          oroPagado: isOp ? 'opOroPagado' : 'oroPagado',
          oroReserva: isOp ? 'opOroReserva' : 'oroReserva',
          ataque: isOp ? 'opAtaque' : 'ataque',
          defensa: isOp ? 'opDefensa' : 'defensa',
          apoyo: isOp ? 'opApoyo' : 'apoyo'
        };

        return (
          <div 
            className="context-menu global-card-context-menu" 
            style={{ position: 'fixed', top: `${activeCardMenu.y}px`, left: `${activeCardMenu.x}px`, zIndex: 99999 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => modificarCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'rotar')}>Rotar 180°</button>
            <button onClick={() => modificarCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'voltear')}>
              {activeCardMenu.carta.faceDown ? 'Revelar Carta' : 'Voltear (Ocultar)'}
            </button>
            <div style={{ height: '1px', backgroundColor: '#444', margin: '4px 0' }}></div>
            <button onClick={() => modificarCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'fuerza', 1)}>Sumar Fuerza (+1)</button>
            <button onClick={() => modificarCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'resetFuerza')}>Restablecer Fuerza (0)</button>
            <button onClick={() => modificarCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'fuerza', -1)}>Restar Fuerza (-1)</button>

            <div style={{ height: '1px', backgroundColor: '#444', margin: '4px 0' }}></div>
            <button onClick={() => modificarCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'fuerzaPermanente', 1)}>Sumar Fuerza Perm. (+1)</button>
            <button onClick={() => modificarCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'resetFuerzaPermanente')}>Restablecer Fuerza Perm. (0)</button>
            <button onClick={() => modificarCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'fuerzaPermanente', -1)}>Restar Fuerza Perm. (-1)</button>

            <div style={{ height: '1px', backgroundColor: '#444', margin: '4px 0' }}></div>
            {selectedCards.length > 1 && <button onClick={agruparSeleccionadas}>Unir Cartas (Attachment)</button>}
            {activeCardMenu.carta.groupId && <button onClick={() => separarCarta(activeCardMenu.cartaId, activeCardMenu.zona)}>Desacoplar unión</button>}
            <div style={{ height: '1px', backgroundColor: '#444', margin: '4px 0' }}></div>
            <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, dest.mano)}>Subir a Mano</button>
            <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, dest.mazo)}>Mandar al Mazo (Top)</button>
            <button onClick={() => moverAlFondoMazo(activeCardMenu.cartaId, activeCardMenu.zona, isOp)}>Mandar al Fondo del Mazo</button>
            <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, dest.cementerio)}>Mandar al Cementerio</button>
            <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, dest.destierro)}>Mandar al Destierro</button>
            <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, dest.oroPagado)}>Mandar a Oro Pagado</button>
            <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, dest.oroReserva)}>Mandar a Oro Reserva</button>
            <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, dest.ataque)}>Mandar a Ataque</button>
            <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, dest.defensa)}>Mandar a Defensa</button>
            <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, dest.apoyo)}>Mandar a Apoyo</button>
          </div>
        );
      })()}

      {/* --- MODAL SIDE DECK --- */}
      {sideDeckModalOpen && (
        <div className="modal-overlay" onClick={() => setSideDeckModalOpen(false)} style={{ zIndex: 6000 }}>
          <div className="zone-viewer-content" onClick={e => e.stopPropagation()} style={{ width: '850px', height: '75vh', display: 'flex', flexDirection: 'column' }}>
            <button className="close-inspect" onClick={() => setSideDeckModalOpen(false)}>✕</button>
            <div className="zone-viewer-header" style={{ textAlign: 'center', marginBottom: '10px' }}>
              GESTIÓN DE SIDE DECK
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto', flex: 1, padding: '10px' }}>
              <div>
                <h4 style={{ color: '#c5a059', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cartas en Side Deck ({sideDeckCartas.length}/15)</span>
                  <small style={{ color: '#888', fontWeight: 'normal' }}>Haz clic para mover al Mazo Principal</small>
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '110px', background: '#111', padding: '10px', borderRadius: '6px', border: '1px dashed #c5a059' }}>
                  {sideDeckCartas.map(c => (
                    <div key={c.instanciaId} style={{ cursor: 'pointer' }}>
                      {renderCard(c, 'sideDeck', false, () => intercambiarCartaSideDeck(c.instanciaId, true))}
                    </div>
                  ))}
                  {sideDeckCartas.length === 0 && (
                    <div style={{ color: '#666', width: '100%', textAlign: 'center', paddingTop: '35px', fontStyle: 'italic' }}>
                      Side Deck vacío.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 style={{ color: '#c5a059', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cartas en Mazo Principal ({boardState.mazo.length})</span>
                  <small style={{ color: '#888', fontWeight: 'normal' }}>Haz clic para mover al Side Deck</small>
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '110px', background: '#111', padding: '10px', borderRadius: '6px', maxHeight: '250px', overflowY: 'auto', border: '1px solid #333' }}>
                  {boardState.mazo.map(c => (
                    <div key={c.instanciaId} style={{ cursor: 'pointer' }}>
                      {renderCard(c, 'mazo', false, () => intercambiarCartaSideDeck(c.instanciaId, false))}
                    </div>
                  ))}
                  {boardState.mazo.length === 0 && (
                    <div style={{ color: '#666', width: '100%', textAlign: 'center', paddingTop: '35px', fontStyle: 'italic' }}>
                      No hay cartas en el Mazo Principal.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALES DE CONFIRMACIÓN E INSPECCIÓN --- */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)} style={{ zIndex: 5000 }}>
          <div className="modal-dialog">
            <h3>¿Abandonar Partida?</h3>
            <p>¿Estás seguro de que deseas salir del encuentro actual?</p>
            <div className="modal-buttons">
              <button className="btn-modal btn-cancel" onClick={() => setShowConfirmModal(false)}>Cancelar</button>
              <button className="btn-modal btn-confirm" onClick={onSalirRef.current}>Salir</button>
            </div>
          </div>
        </div>
      )}

      {inspectCard && !inspectCard.faceDown && (
        <div className="modal-overlay" onClick={() => setInspectCard(null)} style={{ zIndex: 5000 }}>
          <div className="inspect-modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-inspect" onClick={() => setInspectCard(null)}>✕</button>
            <div className="inspect-left">
              {inspectCard.i ? <img src={inspectCard.i} alt={inspectCard.n} className="inspect-full-image" /> : <div className="inspect-placeholder">Sin Imagen</div>}
            </div>
            <div className="inspect-right">
              <div className="inspect-header"><span className="inspect-title">{inspectCard.n || inspectCard.nombre}</span></div>
              <div className="inspect-meta">
                <span className="meta-badge">Coste: {inspectCard.c ?? '-'}</span>
                <span className="meta-badge">Fuerza Base: {inspectCard.z ?? '-'}</span>
              </div>
              <div className="inspect-ability">
                <h4>Habilidad</h4>
                <p>{inspectCard.h || 'Sin habilidad descrita.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingZone && (
        <div className="modal-overlay" onClick={() => setViewingZone(null)} style={{ zIndex: 4000 }}>
          <div className="zone-viewer-content" onClick={e => e.stopPropagation()}>
            <button className="close-inspect" onClick={() => setViewingZone(null)}>✕</button>
            <div className="zone-viewer-header">Inspeccionando: {mapZoneTitle[viewingZone]} ({boardState[viewingZone].length} cartas)</div>
            <div className="zone-viewer-grid" onDragOver={handleDragOver} onDrop={(e) => handleDropInternalModal(e, viewingZone)}>
              {boardState[viewingZone].map((c, index) => (
                <div key={c.instanciaId} onDragOver={handleDragOver} onDrop={(e) => { e.stopPropagation(); handleDropInternalModal(e, viewingZone, index); }} style={{ display: 'inline-block' }}>
                  {renderCard(c, viewingZone)}
                </div>
              ))}
              {boardState[viewingZone].length === 0 && <p style={{color: '#666', width: '100%', textAlign: 'center', marginTop: '20px'}}>La zona está vacía.</p>}
            </div>
          </div>
        </div>
      )}

      {/* MODAL MOSTRAR (PÚBLICO) */}
      {revealedTopModal && (
        <div className="modal-overlay" onClick={() => { 
          setRevealedTopModal(null); 
          setActiveCardMenu(null);
          socketService.emit('closeRevealedTop');
        }} style={{ zIndex: 4000 }}>
          <div className="zone-viewer-content" onClick={e => { e.stopPropagation(); setActiveCardMenu(null); }}>
            <button className="close-inspect" onClick={() => {
              setRevealedTopModal(null);
              socketService.emit('closeRevealedTop');
            }}>✕</button>
            <div className="zone-viewer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Cartas Superiores Reveladas - Reveladas: {revealedTopModal.revealedCount} / {revealedTopModal.snapshot.length}</span>
              <button 
                className="btn-next-top" 
                onClick={() => accionarMazo('mostrarTop', revealedTopModal.zona === 'mazo' ? 'local' : 'rival')} 
                disabled={revealedTopModal.revealedCount >= revealedTopModal.snapshot.length}
                style={{ padding: '6px 12px', background: '#c5a059', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Mostrar Siguiente Carta
              </button>
            </div>
            <div 
              className="zone-viewer-grid"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropInternalModal(e, revealedTopModal.zona)}
            >
              {revealedTopModal.snapshot.map((c, index) => {
                const isRevealed = index < revealedTopModal.revealedCount;
                
                const cardModified = { 
                  ...c, 
                  faceDown: !isRevealed, 
                  reveladaPublicamente: isRevealed 
                };
                
                return (
                  <div key={c.instanciaId} onDragOver={handleDragOver} onDrop={(e) => { e.stopPropagation(); handleDropInternalModal(e, revealedTopModal.zona, index); }} style={{ display: 'inline-block' }}>
                    {renderCard(cardModified, revealedTopModal.zona)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL MIRAR (PRIVADO) */}
      {privateTopModal && (
        <div className="modal-overlay" onClick={() => { setPrivateTopModal(null); setActiveCardMenu(null); }} style={{ zIndex: 4000 }}>
          <div className="zone-viewer-content" onClick={e => { e.stopPropagation(); setActiveCardMenu(null); }}>
            <button className="close-inspect" onClick={() => setPrivateTopModal(null)}>✕</button>
            <div className="zone-viewer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{color: '#88ccff'}}>Mirando Cartas Superiores (Privado) - Vistas: {privateTopModal.revealedCount}</span>
              <button 
                className="btn-next-top" 
                onClick={() => accionarMazo('mirarTop', privateTopModal.zona === 'mazo' ? 'local' : 'rival')} 
                disabled={privateTopModal.revealedCount >= privateTopModal.snapshot.length}
                style={{ padding: '6px 12px', background: '#88ccff', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Mirar Siguiente Carta
              </button>
            </div>
            <div 
              className="zone-viewer-grid"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropInternalModal(e, privateTopModal.zona)}
            >
              {privateTopModal.snapshot.map((c, index) => {
                const isRevealed = index < privateTopModal.revealedCount;
                const cardModified = { ...c, faceDown: !isRevealed };
                return (
                  <div key={c.instanciaId} onDragOver={handleDragOver} onDrop={(e) => { e.stopPropagation(); handleDropInternalModal(e, privateTopModal.zona, index); }} style={{ display: 'inline-block' }}>
                    {renderCard(cardModified, privateTopModal.zona)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- ZONA DE MANO DEL OPONENTE --- */}
      <div className="opponent-hand-zone" onDrop={(e) => handleDrop(e, 'opMano')} onDragOver={handleDragOver}>
        <div
          className={`btn-reveal-hand btn-reveal-opponent ${opManoRevelada ? 'active' : ''}`}
          style={{ cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', background: opManoRevelada ? '#c5a059' : '#1a1a1a', color: opManoRevelada ? '#000' : '#c5a059' }}
        >
          {opManoRevelada ? '👁️ Mano Rival Revelada' : 'Mano Rival Oculta'}
        </div>
        <div className="hand-header" style={{ transform: 'rotate(180deg)' }}>
          <span className="hand-label">Mano Oponente ({boardState.opMano.length})</span>
        </div>
        <div className="hand-cards-container">
          {boardState.opMano.length === 0 ? (
            <span className="hand-empty-text" style={{ transform: 'rotate(180deg)', display: 'inline-block' }}>Mano rival vacía.</span>
          ) : (
            boardState.opMano.map((carta) => renderCard(carta, 'opMano', true))
          )}
        </div>
      </div>

      {/* --- MESA DE JUEGO PRINCIPAL (RIVAL) --- */}
      <div className="board-section opponent-section">
        <div className="player-half opponent-side">
          <div className="resources-block">
            <div className="resource-col external-col">
              <div className="drop-zone square-zone" onClick={(e) => { e.stopPropagation(); setViewingZone('opCementerio'); }} onDrop={(e) => handleDrop(e, 'opCementerio')} onDragOver={handleDragOver}>
                <span className="zone-bg-text" style={{ transform: 'rotate(180deg)', display: 'inline-block' }}>Cem</span>
                {boardState.opCementerio.length > 0 && (
                  <div style={{ pointerEvents: 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderCard(boardState.opCementerio[boardState.opCementerio.length - 1], 'opCementerio')}
                  </div>
                )}
              </div>
              <div className="drop-zone square-zone" onClick={(e) => { e.stopPropagation(); setViewingZone('opDestierro'); }} onDrop={(e) => handleDrop(e, 'opDestierro')} onDragOver={handleDragOver}>
                <span className="zone-bg-text" style={{ transform: 'rotate(180deg)', display: 'inline-block' }}>Des</span>
                {boardState.opDestierro.length > 0 && (
                  <div style={{ pointerEvents: 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderCard(boardState.opDestierro[boardState.opDestierro.length - 1], 'opDestierro')}
                  </div>
                )}
              </div>
            </div>
            
            <div className="resource-col internal-col">
              <div className="drop-zone square-zone" onClick={(e) => { e.stopPropagation(); setViewingZone('opOroPagado'); }} onDrop={(e) => handleDrop(e, 'opOroPagado')} onDragOver={handleDragOver}>
                <span className="zone-bg-text" style={{ transform: 'rotate(180deg)', display: 'inline-block' }}>Oro P</span>
                {boardState.opOroPagado.length > 0 && (
                  <div style={{ pointerEvents: 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderCard(boardState.opOroPagado[boardState.opOroPagado.length - 1], 'opOroPagado')}
                  </div>
                )}
              </div>
              <div className="drop-zone square-zone mazo-zone" onDrop={(e) => handleDrop(e, 'opMazo')} onDragOver={handleDragOver} onClick={(e) => { e.stopPropagation(); setOpDeckMenuOpen(!opDeckMenuOpen); }}>
                <div className="mazo-content" style={{ transform: 'rotate(180deg)' }}>
                  <span className="mazo-titulo" style={{fontSize: '0.7rem', color: '#c5a059', fontWeight: 'bold'}}>Mazo Opo</span>
                  <span className="mazo-contador" style={{backgroundColor: '#c5a059', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'}}>{boardState.opMazo.length}</span>
                </div>
                {boardState.opTopRevelado && boardState.opMazo.length > 0 && (
                  <div style={{ pointerEvents: 'none', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderCard({...boardState.opMazo[0], faceDown: false, reveladaPublicamente: true}, 'opMazo')}
                  </div>
                )}
                {opDeckMenuOpen && (
                  <div className="context-menu mazo-context" onClick={(e) => e.stopPropagation()} style={{ zIndex: 3000, background: '#1a1a1a', border: '1px solid #c5a059', boxShadow: '0 4px 12px rgba(0,0,0,0.8)' }}>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('robar', 'rival'); }}>Mandar a Mano Rival (R)</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('botar', 'rival'); }}>Botar Carta (B)</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('desterrar', 'rival'); }}>Desterrar</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('mostrarTop', 'rival'); }}>Mostrar Carta Superior (T)</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('mirarTop', 'rival'); }}>Mirar Carta Superior</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('inspeccionar', 'rival'); }}>Buscar en mazo rival</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('barajar', 'rival'); }}>Barajar Mazo (S)</button>
                    <button onClick={(e) => { e.stopPropagation(); toggleTopRevelado('rival'); }} style={{ color: '#88ccff', fontWeight: 'bold' }}>{boardState.opTopRevelado ? 'Ocultar Primera (Ouija)' : 'Revelar Primera (Ouija)'}</button>
                  </div>
                )}
              </div>
              <div className="drop-zone square-zone" onClick={(e) => { e.stopPropagation(); setViewingZone('opOroReserva'); }} onDrop={(e) => handleDrop(e, 'opOroReserva')} onDragOver={handleDragOver}>
                <span className="zone-bg-text" style={{ transform: 'rotate(180deg)', display: 'inline-block' }}>Oro R</span>
                {boardState.opOroReserva.length > 0 && (
                  <div style={{ pointerEvents: 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderCard(boardState.opOroReserva[boardState.opOroReserva.length - 1], 'opOroReserva')}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="central-zones">
            <div className="drop-zone line-zone" onDrop={(e) => handleDrop(e, 'opAtaque')} onDragOver={handleDragOver}>
              <span className="zone-bg-text" style={{ transform: 'rotate(180deg)', display: 'inline-block' }}>Ataque</span>
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: '6px', width: '100%', height: '100%', overflowX: 'auto', padding: '4px', zIndex: 2, position: 'relative' }}>
                {boardState.opAtaque.map(c => renderCard(c, 'opAtaque'))}
              </div>
            </div>
            <div className="drop-zone line-zone" onDrop={(e) => handleDrop(e, 'opDefensa')} onDragOver={handleDragOver}>
              <span className="zone-bg-text" style={{ transform: 'rotate(180deg)', display: 'inline-block' }}>Defensa</span>
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: '6px', width: '100%', height: '100%', overflowX: 'auto', padding: '4px', zIndex: 2, position: 'relative' }}>
                {boardState.opDefensa.map(c => renderCard(c, 'opDefensa'))}
              </div>
            </div>
            <div className="drop-zone line-zone" onDrop={(e) => handleDrop(e, 'opApoyo')} onDragOver={handleDragOver}>
              <span className="zone-bg-text" style={{ transform: 'rotate(180deg)', display: 'inline-block' }}>Apoyo</span>
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: '6px', width: '100%', height: '100%', overflowX: 'auto', padding: '4px', zIndex: 2, position: 'relative' }}>
                {boardState.opApoyo.map(c => renderCard(c, 'opApoyo'))}
              </div>
            </div>
          </div>

          {renderCalculatorWidget(true)}
        </div>
      </div>
      
      <div className="table-divider"></div>
      
      {/* --- MESA DE JUEGO PRINCIPAL (JUGADOR) --- */}
      <div className="board-section player-section">
        <div className="player-half">
          <div className="resources-block">
            <div className="resource-col external-col">
              <div className="drop-zone square-zone" title="Cementerio" onClick={(e) => { e.stopPropagation(); setViewingZone('cementerio'); }} onDrop={(e) => handleDrop(e, 'cementerio')} onDragOver={handleDragOver}>
                <span className="zone-bg-text">Cem</span>
                {boardState.cementerio.length > 0 && (
                  <div style={{ pointerEvents: 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderCard(boardState.cementerio[boardState.cementerio.length - 1], 'cementerio')}
                  </div>
                )}
              </div>
              <div className="drop-zone square-zone" title="Destierro" onClick={(e) => { e.stopPropagation(); setViewingZone('destierro'); }} onDrop={(e) => handleDrop(e, 'destierro')} onDragOver={handleDragOver}>
                <span className="zone-bg-text">Des</span>
                {boardState.destierro.length > 0 && (
                  <div style={{ pointerEvents: 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderCard(boardState.destierro[boardState.destierro.length - 1], 'destierro')}
                  </div>
                )}
              </div>
            </div>
            
            <div className="resource-col internal-col">
              <div className="drop-zone square-zone" title="Oro Pagado" onClick={(e) => { e.stopPropagation(); setViewingZone('oroPagado'); }} onDrop={(e) => handleDrop(e, 'oroPagado')} onDragOver={handleDragOver}>
                <span className="zone-bg-text">Oro P</span>
                {boardState.oroPagado.length > 0 && (
                  <div style={{ pointerEvents: 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderCard(boardState.oroPagado[boardState.oroPagado.length - 1], 'oroPagado')}
                  </div>
                )}
              </div>
              
              <div className="drop-zone square-zone mazo-zone" title="Mazo" onDrop={(e) => handleDrop(e, 'mazo')} onDragOver={handleDragOver} onClick={(e) => { e.stopPropagation(); setDeckMenuOpen(!deckMenuOpen); }}>
                <div className="mazo-content">
                  <span className="mazo-titulo" style={{fontSize: '0.7rem', color: '#c5a059', fontWeight: 'bold'}}>Mazo</span>
                  <span className="mazo-contador" style={{backgroundColor: '#c5a059', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'}}>{boardState.mazo.length}</span>
                </div>
                {boardState.topRevelado && boardState.mazo.length > 0 && (
                  <div style={{ pointerEvents: 'none', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderCard({...boardState.mazo[0], faceDown: false, reveladaPublicamente: true}, 'mazo')}
                  </div>
                )}
                {deckMenuOpen && (
                  <div className="context-menu mazo-context" onClick={(e) => e.stopPropagation()} style={{ zIndex: 3000, background: '#1a1a1a', border: '1px solid #c5a059', boxShadow: '0 4px 12px rgba(0,0,0,0.8)' }}>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('robar'); }}>Robar Carta (R)</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('botar'); }}>Botar Carta (B)</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('desterrar'); }}>Desterrar</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('mostrarTop'); }}>Mostrar Carta Superior (T)</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('mirarTop'); }}>Mirar Carta Superior</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('inspeccionar'); }}>Buscar en mazo</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('barajar'); }}>Barajar Mazo (S)</button>
                    <button onClick={(e) => { e.stopPropagation(); toggleTopRevelado('local'); }} style={{ color: '#88ccff', fontWeight: 'bold' }}>{boardState.topRevelado ? 'Ocultar Primera (Ouija)' : 'Jugar con Primera (Ouija)'}</button>
                    <button onClick={(e) => { e.stopPropagation(); handleResetDeck(); }} style={{ color: '#ff8888', fontWeight: 'bold' }}>🔄 Reiniciar Mazo Completo</button>
                  </div>
                )}
              </div>

              <div className="drop-zone square-zone" title="Oro Reserva" onClick={(e) => { e.stopPropagation(); setViewingZone('oroReserva'); }} onDrop={(e) => handleDrop(e, 'oroReserva')} onDragOver={handleDragOver}>
                <span className="zone-bg-text">Oro R</span>
                {boardState.oroReserva.length > 0 && (
                  <div style={{ pointerEvents: 'none', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderCard(boardState.oroReserva[boardState.oroReserva.length - 1], 'oroReserva')}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="central-zones">
            <div className="drop-zone line-zone" onDrop={(e) => handleDrop(e, 'ataque')} onDragOver={handleDragOver}>
              <span className="zone-bg-text">Ataque</span>
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: '6px', width: '100%', height: '100%', overflowX: 'auto', padding: '4px', zIndex: 2, position: 'relative' }}>
                {boardState.ataque.map(c => renderCard(c, 'ataque'))}
              </div>
            </div>
            <div className="drop-zone line-zone" onDrop={(e) => handleDrop(e, 'defensa')} onDragOver={handleDragOver}>
              <span className="zone-bg-text">Defensa</span>
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: '6px', width: '100%', height: '100%', overflowX: 'auto', padding: '4px', zIndex: 2, position: 'relative' }}>
                {boardState.defensa.map(c => renderCard(c, 'defensa'))}
              </div>
            </div>
            <div className="drop-zone line-zone" onDrop={(e) => handleDrop(e, 'apoyo')} onDragOver={handleDragOver}>
              <span className="zone-bg-text">Apoyo</span>
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: '6px', width: '100%', height: '100%', overflowX: 'auto', padding: '4px', zIndex: 2, position: 'relative' }}>
                {boardState.apoyo.map(c => renderCard(c, 'apoyo'))}
              </div>
            </div>
          </div>

          {renderCalculatorWidget(false)}
        </div>
      </div>

      {/* --- ZONA DE MANO --- */}
      <div className="player-hand-zone" onDrop={(e) => handleDrop(e, 'mano')} onDragOver={handleDragOver}>
        <button
          className={`btn-reveal-hand btn-reveal-player ${manoRevelada ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            const nuevoEstado = !manoRevelada;
            setManoRevelada(nuevoEstado);
            addLog(nuevoEstado ? "Has revelado tu mano." : "Has ocultado tu mano.");
          }}
        >
          {manoRevelada ? '👁️ Ocultar Mi Mano' : 'Revelar Mi Mano'}
        </button>
        <div className="hand-header">
          <span className="hand-label">Mano ({boardState.mano.length})</span>
        </div>
        <div className="hand-cards-container">
          {boardState.mano.length === 0 ? (
            <span className="hand-empty-text">Mano vacía. Haz clic en el Mazo y selecciona "Robar".</span>
          ) : (
            boardState.mano.map((carta) => renderCard(carta, 'mano', true))
          )}
        </div>
      </div>
    </div>
  );
};

export default MultiplayerBoard;