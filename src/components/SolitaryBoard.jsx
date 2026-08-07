import React, { useState, useEffect, useCallback } from 'react';
import './SolitaryBoard.css';

const SolitaryBoard = ({ mazo, onSalir }) => {
  // --- ESTADOS DE UI ---
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [inspectCard, setInspectCard] = useState(null);
  const [deckMenuOpen, setDeckMenuOpen] = useState(false);
  const [viewingZone, setViewingZone] = useState(null); 
  const [revealedTopModal, setRevealedTopModal] = useState(null);
  const [privateTopModal, setPrivateTopModal] = useState(null);
  const [activeCardMenu, setActiveCardMenu] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [pings, setPings] = useState([]);

  // --- ESTADOS DE SIDE DECK Y MAZO ORIGINAL ---
  const [sideDeckModalOpen, setSideDeckModalOpen] = useState(false);
  const [deckPrincipalOriginal, setDeckPrincipalOriginal] = useState([]);
  const [sideDeckCartas, setSideDeckCartas] = useState([]);

  // --- ESTADO DE LA CALCULADORA (JUGADOR) ---
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPrevValue, setCalcPrevValue] = useState(null);
  const [calcOperation, setCalcOperation] = useState(null);
  const [calcClearOnNext, setCalcClearOnNext] = useState(false);

  // --- ESTADO DE LA CALCULADORA (OPONENTE) ---
  const [opCalcDisplay, setOpCalcDisplay] = useState('0');
  const [opCalcPrevValue, setOpCalcPrevValue] = useState(null);
  const [opCalcOperation, setOpCalcOperation] = useState(null);
  const [opCalcClearOnNext, setOpCalcClearOnNext] = useState(false);

  // --- ESTADOS DE REVELAR MANO ---
  const [manoRevelada, setManoRevelada] = useState(false);
  const [opManoRevelada, setOpManoRevelada] = useState(false);

  // --- ESTADO UNIFICADO DEL TABLERO ---
  const [boardState, setBoardState] = useState({
    mazo: [], mano: [],
    ataque: [], defensa: [], apoyo: [],
    oroPagado: [], oroReserva: [], cementerio: [], destierro: [],
    opMazo: [], opMano: [], opCementerio: [], opDestierro: [], opOroPagado: [], opOroReserva: [],
    opAtaque: [], opDefensa: [], opApoyo: []
  });

  const addLog = useCallback((msg) => {
    setSystemLogs(prev => {
      const newLogs = [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`];
      return newLogs.slice(-15);
    });
  }, []);

  // Inicialización del mazo y Side Deck
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
      setBoardState(prev => ({ ...prev, mazo: expandedDeck }));

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
      addLog("Partida iniciada. Mazo y Side Deck cargados.");
    }
  }, [mazo, addLog]);

  const intercambiarCartaSideDeck = (cartaId, origenEsSide) => {
    if (origenEsSide) {
      const carta = sideDeckCartas.find(c => c.instanciaId === cartaId);
      if (!carta) return;
      setSideDeckCartas(prev => prev.filter(c => c.instanciaId !== cartaId));
      setBoardState(prev => ({ ...prev, mazo: [...prev.mazo, carta] }));
      addLog("Movió una carta del Side Deck al Mazo.");
    } else {
      if (sideDeckCartas.length >= 15) {
        alert("El Side Deck no puede tener más de 15 cartas.");
        return;
      }
      const carta = boardState.mazo.find(c => c.instanciaId === cartaId);
      if (!carta) return;
      setBoardState(prev => ({ ...prev, mazo: prev.mazo.filter(c => c.instanciaId !== cartaId) }));
      setSideDeckCartas(prev => [...prev, carta]);
      addLog("Movió una carta del Mazo al Side Deck.");
    }
  };

  const getZoneOfCard = useCallback((instanciaId) => {
    for (const [zona, cartas] of Object.entries(boardState)) {
      if (cartas.some(c => c.instanciaId === instanciaId)) return zona;
    }
    return null;
  }, [boardState]);

  // --- LÓGICA DRAG & DROP ---
  const handleDragStart = (e, carta, origen) => {
    let payloadCards = selectedCards.some(c => c.instanciaId === carta.instanciaId) 
      ? [...selectedCards] 
      : [carta];

    const groupIds = payloadCards.map(c => c.groupId).filter(Boolean);
    if (groupIds.length > 0) {
      Object.values(boardState).flat().forEach(c => {
        if (c.groupId && groupIds.includes(c.groupId) && !payloadCards.some(pc => pc.instanciaId === c.instanciaId)) {
          payloadCards.push(c);
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

    setBoardState(prev => {
      let newState = { ...prev };
      
      for (const key in newState) {
        if (Array.isArray(newState[key])) {
          newState[key] = newState[key].filter(c => !idsAMover.includes(c.instanciaId));
        }
      }

      let nuevoDestino = [...(newState[destino] || [])];

      cartasPayload.forEach(carta => {
        if (destino.toLowerCase().includes('mazo')) {
          nuevoDestino = [carta, ...nuevoDestino];
        } else {
          nuevoDestino.push(carta);
        }
      });

      newState[destino] = nuevoDestino;
      addLog(`Se movieron ${cartasPayload.length} carta(s) a ${destino}.`);
      return newState;
    });
    
    setSelectedCards([]);
  };

  const handleDropInternalModal = (e, zona, targetIndex = null) => {
    e.preventDefault();
    const cartasData = e.dataTransfer.getData('cartas');
    if (!cartasData) return;
    const cartasPayload = JSON.parse(cartasData);

    if (revealedTopModal && revealedTopModal.zona === zona) {
      setRevealedTopModal(prev => {
        let newSnapshot = [...prev.snapshot];
        cartasPayload.forEach(c => {
          newSnapshot = newSnapshot.filter(item => item.instanciaId !== c.instanciaId);
        });
        if (targetIndex !== null && targetIndex >= 0) {
          newSnapshot.splice(targetIndex, 0, ...cartasPayload);
        } else {
          newSnapshot.push(...cartasPayload);
        }
        setBoardState(bState => ({ ...bState, [zona]: newSnapshot }));
        return { ...prev, snapshot: newSnapshot };
      });
      setSelectedCards([]);
      addLog(`Cartas reordenadas en el visor superior.`);
      return;
    }

    if (privateTopModal && privateTopModal.zona === zona) {
      setPrivateTopModal(prev => {
        let newSnapshot = [...prev.snapshot];
        cartasPayload.forEach(c => {
          newSnapshot = newSnapshot.filter(item => item.instanciaId !== c.instanciaId);
        });
        if (targetIndex !== null && targetIndex >= 0) {
          newSnapshot.splice(targetIndex, 0, ...cartasPayload);
        } else {
          newSnapshot.push(...cartasPayload);
        }
        setBoardState(bState => ({ ...bState, [zona]: newSnapshot }));
        return { ...prev, snapshot: newSnapshot };
      });
      setSelectedCards([]);
      addLog(`Cartas reordenadas en el visor privado.`);
      return;
    }

    setBoardState(prev => {
      let newState = { ...prev };
      cartasPayload.forEach(carta => {
        for (const key in newState) {
          newState[key] = newState[key].filter(c => c.instanciaId !== carta.instanciaId);
        }
      });

      let zonaCartas = [...(newState[zona] || [])];
      if (targetIndex !== null && targetIndex >= 0) {
        zonaCartas.splice(targetIndex, 0, ...cartasPayload);
      } else {
        zonaCartas.push(...cartasPayload);
      }

      newState[zona] = zonaCartas;
      return newState;
    });
    
    setSelectedCards([]);
    addLog(`Cartas reordenadas en ${zona}.`);
  };

  const accionarMazo = useCallback((accion, lado = 'local') => {
    const zonaMazo = lado === 'local' ? 'mazo' : 'opMazo';
    
    if (accion === 'inspeccionar') {
      setViewingZone(zonaMazo);
      setDeckMenuOpen(false);
      return;
    }

    if (accion === 'mostrarTop' || accion === 'mirarTop') {
      if (boardState[zonaMazo].length === 0) return;
      const setter = accion === 'mostrarTop' ? setRevealedTopModal : setPrivateTopModal;
      
      setter(current => {
        if (current && current.zona === zonaMazo) {
          return { 
            ...current, 
            revealedCount: Math.min(current.revealedCount + 1, current.snapshot.length) 
          };
        }
        return { 
          zona: zonaMazo, 
          snapshot: [...boardState[zonaMazo]], 
          revealedCount: 1 
        };
      });
      setDeckMenuOpen(false);
      addLog(accion === 'mostrarTop' ? "Revelando carta superior del mazo." : "Mirando carta superior en privado.");
      return;
    }

    if (boardState[zonaMazo].length === 0) return;
    
    setBoardState(prev => {
      const mazoCopia = [...prev[zonaMazo]];
      
      if (accion === 'barajar') {
        mazoCopia.sort(() => Math.random() - 0.5);
        addLog(`Mazo ${lado} barajado.`);
        return { ...prev, [zonaMazo]: mazoCopia };
      }

      const cartaExtraida = mazoCopia.shift();
      const nuevoEstado = { ...prev, [zonaMazo]: mazoCopia };

      if (lado === 'local') {
        if (accion === 'robar') { nuevoEstado.mano = [...prev.mano, cartaExtraida]; addLog("Carta robada a la mano."); }
        if (accion === 'botar') { nuevoEstado.cementerio = [...prev.cementerio, cartaExtraida]; addLog("Carta botada al cementerio."); }
        if (accion === 'desterrar') { nuevoEstado.destierro = [...prev.destierro, cartaExtraida]; addLog("Carta desterrada desde el mazo."); }
      }
      return nuevoEstado;
    });
  }, [boardState, addLog]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      
      const key = e.key.toLowerCase();
      if (key === 'r') accionarMazo('robar');
      if (key === 's') accionarMazo('barajar');
      if (key === 't') accionarMazo('mostrarTop');
      if (key === 'b') accionarMazo('botar');
      
      if (selectedCards.length > 0) {
        if (key === 'f') {
          selectedCards.forEach(c => modificarCarta(c.instanciaId, getZoneOfCard(c.instanciaId), 'voltear'));
          addLog(`Volteó ${selectedCards.length} carta(s).`);
        }
        if (e.key === 'Delete' && !e.shiftKey) {
          selectedCards.forEach(c => moverCarta(c.instanciaId, getZoneOfCard(c.instanciaId), 'cementerio'));
          addLog(`Envió ${selectedCards.length} carta(s) al cementerio.`);
        }
        if (e.key === 'Delete' && e.shiftKey) {
          selectedCards.forEach(c => moverCarta(c.instanciaId, getZoneOfCard(c.instanciaId), 'destierro'));
          addLog(`Desterró ${selectedCards.length} carta(s).`);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [accionarMazo, selectedCards, getZoneOfCard, addLog]);

  const modificarCarta = (instanciaId, zona, modificacion, valorExtra = 0) => {
    const isSelected = selectedCards.some(c => c.instanciaId === instanciaId);
    const idsAModificar = isSelected ? selectedCards.map(c => c.instanciaId) : [instanciaId];

    setBoardState(prev => {
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

    const isStrengthModification = ['fuerza', 'resetFuerza', 'fuerzaPermanente', 'resetFuerzaPermanente'].includes(modificacion);
    if (!isStrengthModification) {
      setActiveCardMenu(null);
    }
  };

  const moverCarta = (instanciaId, zonaOrigen, zonaDestino) => {
    if (zonaOrigen === zonaDestino) { setActiveCardMenu(null); return; }
    
    const cartaBase = boardState[zonaOrigen].find(c => c.instanciaId === instanciaId);
    if (!cartaBase) return;

    let payload = selectedCards.some(c => c.instanciaId === instanciaId) ? [...selectedCards] : [cartaBase];
    
    const groupIds = payload.map(c => c.groupId).filter(Boolean);
    if (groupIds.length > 0) {
      Object.values(boardState).flat().forEach(c => {
        if (c.groupId && groupIds.includes(c.groupId) && !payload.some(pc => pc.instanciaId === c.instanciaId)) {
          payload.push(c);
        }
      });
    }

    setBoardState(prev => {
      let newState = { ...prev };
      payload.forEach(carta => {
        for (const key in newState) {
          newState[key] = newState[key].filter(c => c.instanciaId !== carta.instanciaId);
        }
      });

      let nuevoDestino = [...newState[zonaDestino]];
      payload.forEach(carta => {
        if (zonaDestino.toLowerCase().includes('mazo')) nuevoDestino = [carta, ...nuevoDestino];
        else nuevoDestino.push(carta);
      });

      newState[zonaDestino] = nuevoDestino;
      return newState;
    });
    
    setActiveCardMenu(null);
    setSelectedCards([]); 
    addLog(`Cartas movidas manualmente a ${zonaDestino}.`);
  };

  const moverAlFondoMazo = (instanciaId, zonaOrigen, esRival = false) => {
    const cartaBase = boardState[zonaOrigen].find(c => c.instanciaId === instanciaId);
    if (!cartaBase) return;

    let payload = selectedCards.some(c => c.instanciaId === instanciaId) ? [...selectedCards] : [cartaBase];
    
    const groupIds = payload.map(c => c.groupId).filter(Boolean);
    if (groupIds.length > 0) {
      Object.values(boardState).flat().forEach(c => {
        if (c.groupId && groupIds.includes(c.groupId) && !payload.some(pc => pc.instanciaId === c.instanciaId)) {
          payload.push(c);
        }
      });
    }

    const zonaMazoDestino = esRival ? 'opMazo' : 'mazo';

    setBoardState(prev => {
      let newState = { ...prev };
      payload.forEach(carta => {
        for (const key in newState) {
          newState[key] = newState[key].filter(c => c.instanciaId !== carta.instanciaId);
        }
      });

      let nuevoMazo = [...newState[zonaMazoDestino]];
      payload.forEach(carta => {
        nuevoMazo.push(carta);
      });

      newState[zonaMazoDestino] = nuevoMazo;
      return newState;
    });
    
    setActiveCardMenu(null);
    setSelectedCards([]); 
    addLog(`Carta(s) enviada(s) al fondo del mazo.`);
  };

  const agruparSeleccionadas = () => {
    if (selectedCards.length < 2) return;
    const newGroupId = Math.random().toString(36).substr(2, 9);
    setBoardState(prev => {
      let newState = { ...prev };
      selectedCards.forEach(carta => {
        const zona = getZoneOfCard(carta.instanciaId);
        if (zona) {
          newState[zona] = newState[zona].map(c => c.instanciaId === carta.instanciaId ? { ...c, groupId: newGroupId } : c);
        }
      });
      return newState;
    });
    addLog(`Unidas ${selectedCards.length} cartas.`);
    setActiveCardMenu(null);
    setSelectedCards([]);
  };

  const separarCarta = (instanciaId, zona) => {
    const cartaTarget = boardState[zona]?.find(c => c.instanciaId === instanciaId);
    const targetGroupId = cartaTarget?.groupId;

    setBoardState(prev => {
      let newState = { ...prev };
      for (const key in newState) {
        newState[key] = newState[key].map(c => {
          if ((targetGroupId && c.groupId === targetGroupId) || c.instanciaId === instanciaId) {
            return { ...c, groupId: null };
          }
          return c;
        });
      }
      return newState;
    });
    addLog("Carta(s) separada(s) de su unión.");
    setActiveCardMenu(null);
  };

  const lanzarAzar = (tipo) => {
    let result = '';
    if (tipo === 'moneda') result = Math.random() > 0.5 ? 'Cara' : 'Sello';
    if (tipo === 'd6') result = Math.floor(Math.random() * 6) + 1;
    if (tipo === 'd20') result = Math.floor(Math.random() * 20) + 1;
    addLog(`Resultado ${tipo}: ${result}`);
  };

  const handlePing = (e) => {
    if (e.altKey) {
      const id = Date.now();
      setPings(prev => [...prev, { x: e.clientX, y: e.clientY, id }]);
      setTimeout(() => setPings(prev => prev.filter(p => p.id !== id)), 1500);
      addLog(`Ping en (${e.clientX}, ${e.clientY})`);
    }
  };

  // --- LÓGICA DE LAS CALCULADORAS ---
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
          style={{ 
            background: 'rgba(20,20,20,0.9)', 
            border: '1px solid #c5a059', 
            borderRadius: '6px', 
            padding: '8px', 
            color: '#fff', 
            fontSize: '12px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '6px'
          }}
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
            <button onClick={() => handleCalcReset(isOp)} style={{ padding: '4px', background: '#d9534f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }} title="Resetear Calculadora">C</button>
          </div>
        </div>
      </div>
    );
  };

  const renderCard = (carta, zona, isHand = false) => {
    const cardClass = isHand ? 'card-item-hand' : 'card-item-board';
    const isSelected = selectedCards.some(c => c.instanciaId === carta.instanciaId) ? 'card-selected' : '';
    const isGrouped = carta.groupId ? 'card-grouped' : '';
    const isHidden = carta.faceDown || 
                     (zona === 'opMano' && !opManoRevelada) || 
                     zona === 'opMazo';
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

          if (posY + menuHeight > window.innerHeight) {
            posY = window.innerHeight - menuHeight - 10;
          }
          if (posX + menuWidth > window.innerWidth) {
            posX = window.innerWidth - menuWidth - 10;
          }

          setActiveCardMenu({ cartaId: carta.instanciaId, zona, carta, x: posX, y: posY });
        }}
        title={isHidden ? 'Carta Oculta' : (carta.n || carta.nombre)}
      >
        {!isHidden && fuerzaValor !== 0 && (
          <div className="card-counter-badge">
            {fuerzaValor > 0 ? `+${fuerzaValor}` : fuerzaValor}
          </div>
        )}

        {!isHidden && fuerzaPermValor !== 0 && (
          <div className="card-counter-badge-permanent" style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: '#d9534f', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', border: '1px solid #fff', zIndex: 10 }}>
            {fuerzaPermValor > 0 ? `+${fuerzaPermValor}` : fuerzaPermValor}
          </div>
        )}

        {isHidden ? (
          <div className="card-back-official" style={{width: '100%', height: '100%', backgroundColor: '#2a1b10', border: '2px solid #5a3c20'}}></div>
        ) : (
          carta.i ? (
            <img src={carta.i} alt={carta.n} draggable="false" className="card-image" />
          ) : (
            <div className="card-placeholder">{carta.n || 'Carta'}</div>
          )
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
      onClick={() => { if(deckMenuOpen) setDeckMenuOpen(false); if(activeCardMenu) setActiveCardMenu(null); }}
      onMouseDown={handlePing}
    >
      {pings.map(p => (
        <div key={p.id} className="ping-animation" style={{ left: p.x, top: p.y }}></div>
      ))}

      <div className="system-panel" style={{ position: 'absolute', top: 60, right: 20, width: '250px', zIndex: 1000, background: 'rgba(0,0,0,0.85)', border: '1px solid #c5a059', color: '#fff', padding: '10px', fontSize: '12px', borderRadius: '6px' }}>
        <div className="rng-controls" style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
          <button onClick={() => lanzarAzar('moneda')}>Moneda</button>
          <button onClick={() => lanzarAzar('d6')}>D6</button>
          <button onClick={() => lanzarAzar('d20')}>D20</button>
        </div>
        <div className="log-box" style={{ maxHeight: '130px', overflowY: 'auto', borderTop: '1px solid #444', paddingTop: '5px' }}>
          {systemLogs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>

      <button onClick={(e) => { e.stopPropagation(); setShowConfirmModal(true); }} className="exit-x-button" title="Abandonar Partida">✕</button>

      {/* --- MENÚ CONTEXTUAL GLOBAL FLOTANTE --- */}
      {activeCardMenu && (
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
          <button onClick={() => modificarCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'fuerzaPermanente', 1)} style={{ color: '#ff8888' }}>Sumar Fuerza Perm. (+1)</button>
          <button onClick={() => modificarCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'resetFuerzaPermanente')} style={{ color: '#ff8888' }}>Restablecer Fuerza Perm. (0)</button>
          <button onClick={() => modificarCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'fuerzaPermanente', -1)} style={{ color: '#ff8888' }}>Restar Fuerza Perm. (-1)</button>
          
          <div style={{ height: '1px', backgroundColor: '#444', margin: '4px 0' }}></div>
          {selectedCards.length > 1 && <button onClick={agruparSeleccionadas}>Unir Cartas (Attachment)</button>}
          {activeCardMenu.carta.groupId && <button onClick={() => separarCarta(activeCardMenu.cartaId, activeCardMenu.zona)}>Desacoplar unión</button>}
          
          <div style={{ height: '1px', backgroundColor: '#444', margin: '4px 0' }}></div>
          <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'mano')}>Subir a Mano</button>
          <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'mazo')}>Mandar al Mazo (Top)</button>
          <button onClick={() => moverAlFondoMazo(activeCardMenu.cartaId, activeCardMenu.zona, false)}>Mandar al Fondo del Mazo</button>
          <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'cementerio')}>Mandar al Cementerio</button>
          <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'destierro')}>Mandar al Destierro</button>
          <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'oroPagado')}>Mandar a Oro Pagado</button>
          <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'oroReserva')}>Mandar a Oro Reserva</button>
          <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'ataque')}>Mandar a Ataque</button>
          <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'defensa')}>Mandar a Defensa</button>
          <button onClick={() => moverCarta(activeCardMenu.cartaId, activeCardMenu.zona, 'apoyo')}>Mandar a Apoyo</button>
        </div>
      )}

      {/* --- MODALES --- */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); setActiveCardMenu(null); }} style={{ zIndex: 5000 }}>
          <div className="modal-dialog">
            <h3>¿Abandonar Partida?</h3>
            <p>¿Estás seguro de que deseas salir del entrenamiento actual?</p>
            <div className="modal-buttons">
              <button className="btn-modal btn-cancel" onClick={() => setShowConfirmModal(false)}>Cancelar</button>
              <button className="btn-modal btn-confirm" onClick={onSalir}>Salir</button>
            </div>
          </div>
        </div>
      )}

      {inspectCard && !inspectCard.faceDown && (
        <div className="modal-overlay" onClick={() => { setInspectCard(null); setActiveCardMenu(null); }} style={{ zIndex: 5000 }}>
          <div className="inspect-modal-content" onClick={e => { e.stopPropagation(); setActiveCardMenu(null); }}>
            <button className="close-inspect" onClick={() => setInspectCard(null)}>✕</button>
            <div className="inspect-left">
              {inspectCard.i ? (
                <img src={inspectCard.i} alt={inspectCard.n} className="inspect-full-image" />
              ) : (
                <div className="inspect-placeholder">Sin Imagen</div>
              )}
            </div>
            <div className="inspect-right">
              <div className="inspect-header">
                <span className="inspect-title">{inspectCard.n || inspectCard.nombre}</span>
              </div>
              <div className="inspect-meta">
                <span className="meta-badge">Coste: {inspectCard.c ?? '-'}</span>
                <span className="meta-badge">Fuerza Base: {inspectCard.z ?? '-'}</span>
                <span className="meta-badge">ID: {inspectCard.u ?? '-'}</span>
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
        <div className="modal-overlay" onClick={() => { setViewingZone(null); setActiveCardMenu(null); }} style={{ zIndex: 4000 }}>
          <div className="zone-viewer-content" onClick={e => { e.stopPropagation(); setActiveCardMenu(null); }}>
            <button className="close-inspect" onClick={() => setViewingZone(null)}>✕</button>
            <div className="zone-viewer-header">Inspeccionando: {mapZoneTitle[viewingZone]} ({boardState[viewingZone].length} cartas)</div>
            <div 
              className="zone-viewer-grid"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropInternalModal(e, viewingZone)}
            >
              {boardState[viewingZone].map((c, index) => (
                <div 
                  key={c.instanciaId}
                  onDragOver={handleDragOver}
                  onDrop={(e) => {
                    e.stopPropagation();
                    handleDropInternalModal(e, viewingZone, index);
                  }}
                  style={{ display: 'inline-block' }}
                >
                  {renderCard(c, viewingZone)}
                </div>
              ))}
              {boardState[viewingZone].length === 0 && <p style={{color: '#666', width: '100%', textAlign: 'center', marginTop: '20px'}}>La zona está vacía.</p>}
            </div>
          </div>
        </div>
      )}

      {revealedTopModal && (
        <div className="modal-overlay" onClick={() => { setRevealedTopModal(null); setActiveCardMenu(null); }} style={{ zIndex: 4000 }}>
          <div className="zone-viewer-content" onClick={e => { e.stopPropagation(); setActiveCardMenu(null); }}>
            <button className="close-inspect" onClick={() => setRevealedTopModal(null)}>✕</button>
            <div className="zone-viewer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Cartas Superiores Reveladas ({mapZoneTitle[revealedTopModal.zona]}) - Reveladas: {revealedTopModal.revealedCount} / {revealedTopModal.snapshot.length}</span>
              <button 
                className="btn-next-top" 
                onClick={() => accionarMazo('mostrarTop', revealedTopModal.zona === 'mazo' ? 'local' : 'rival')} 
                disabled={revealedTopModal.revealedCount >= revealedTopModal.snapshot.length}
                style={{ padding: '6px 12px', background: '#c5a059', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Mostrar Siguiente Carta ({revealedTopModal.snapshot.length - revealedTopModal.revealedCount} restantes)
              </button>
            </div>
            <div 
              className="zone-viewer-grid"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropInternalModal(e, revealedTopModal.zona)}
            >
              {revealedTopModal.snapshot.map((c, index) => {
                const isRevealed = index < revealedTopModal.revealedCount;
                const cardModified = { ...c, faceDown: !isRevealed };
                return (
                  <div 
                    key={c.instanciaId}
                    onDragOver={handleDragOver}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleDropInternalModal(e, revealedTopModal.zona, index);
                    }}
                    style={{ display: 'inline-block' }}
                  >
                    {renderCard(cardModified, revealedTopModal.zona)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {privateTopModal && (
        <div className="modal-overlay" onClick={() => { setPrivateTopModal(null); setActiveCardMenu(null); }} style={{ zIndex: 4000 }}>
          <div className="zone-viewer-content" onClick={e => { e.stopPropagation(); setActiveCardMenu(null); }}>
            <button className="close-inspect" onClick={() => setPrivateTopModal(null)}>✕</button>
            <div className="zone-viewer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{color: '#88ccff'}}>Mirando Cartas Superiores (Privado) - {mapZoneTitle[privateTopModal.zona]} - Vistas: {privateTopModal.revealedCount}</span>
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
                  <div 
                    key={c.instanciaId}
                    onDragOver={handleDragOver}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleDropInternalModal(e, privateTopModal.zona, index);
                    }}
                    style={{ display: 'inline-block' }}
                  >
                    {renderCard(cardModified, privateTopModal.zona)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL SIDE DECK */}
      {sideDeckModalOpen && (
        <div className="modal-overlay" onClick={() => setSideDeckModalOpen(false)} style={{ zIndex: 6000 }}>
          <div className="zone-viewer-content" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '1000px', height: '80vh' }}>
            <button className="close-inspect" onClick={() => setSideDeckModalOpen(false)}>✕</button>
            <div className="zone-viewer-header">Gestión de Side Deck</div>
            <div style={{ display: 'flex', gap: '20px', height: '100%', overflow: 'hidden' }}>
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #444', borderRadius: '8px', padding: '10px' }}>
                <h4 style={{ color: '#c5a059', textAlign: 'center', marginTop: 0 }}>Tu Mazo ({boardState.mazo.length})</h4>
                <div className="zone-viewer-grid">
                  {boardState.mazo.map(c => (
                    <div key={c.instanciaId} onDoubleClick={() => intercambiarCartaSideDeck(c.instanciaId, false)}>
                      {renderCard(c, 'mazo')}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid #444', borderRadius: '8px', padding: '10px' }}>
                <h4 style={{ color: '#c5a059', textAlign: 'center', marginTop: 0 }}>Side Deck ({sideDeckCartas.length}/15)</h4>
                <div className="zone-viewer-grid">
                  {sideDeckCartas.map(c => (
                    <div key={c.instanciaId} onDoubleClick={() => intercambiarCartaSideDeck(c.instanciaId, true)}>
                      {renderCard(c, 'sideDeck')}
                    </div>
                  ))}
                </div>
              </div>
              
            </div>
            <p style={{ textAlign: 'center', color: '#888', fontSize: '0.8rem', marginTop: '10px' }}>* Haz doble clic en una carta para moverla entre el Mazo y el Side Deck.</p>
          </div>
        </div>
      )}

      {/* --- ZONA DE MANO DEL OPONENTE --- */}
      <div className="opponent-hand-zone" onDrop={(e) => handleDrop(e, 'opMano')} onDragOver={handleDragOver}>
        <button
          className={`btn-reveal-hand btn-reveal-opponent ${opManoRevelada ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpManoRevelada(!opManoRevelada);
            addLog(opManoRevelada ? "El rival ha ocultado su mano." : "El rival ha revelado su mano.");
          }}
        >
          {opManoRevelada ? '👁️ Ocultar Mano' : 'Revelar Mano'}
        </button>
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
              <div className="drop-zone square-zone mazo-zone" onDrop={(e) => handleDrop(e, 'opMazo')} onDragOver={handleDragOver} onClick={(e) => { e.stopPropagation(); setViewingZone('opMazo'); }}>
                <div className="mazo-content" style={{ transform: 'rotate(180deg)' }}>
                  <span className="mazo-titulo" style={{fontSize: '0.7rem', color: '#c5a059', fontWeight: 'bold'}}>Mazo Opo</span>
                  <span className="mazo-contador" style={{backgroundColor: '#c5a059', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'}}>{boardState.opMazo.length}</span>
                </div>
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
                {deckMenuOpen && (
                  <div className="context-menu mazo-context" onClick={(e) => e.stopPropagation()} style={{ zIndex: 3000, background: '#1a1a1a', border: '1px solid #c5a059', boxShadow: '0 4px 12px rgba(0,0,0,0.8)' }}>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('robar'); }}>Robar Carta (R)</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('botar'); }}>Botar Carta (B)</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('desterrar'); }}>Desterrar</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('mostrarTop'); }}>Mostrar Carta Superior (T)</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('mirarTop'); }}>Mirar Carta Superior</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('inspeccionar'); }}>Buscar en mazo</button>
                    <button onClick={(e) => { e.stopPropagation(); setSideDeckModalOpen(true); setDeckMenuOpen(false); }}>Abrir Side Deck</button>
                    <button onClick={(e) => { e.stopPropagation(); accionarMazo('barajar'); }}>Barajar Mazo (S)</button>
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
            setManoRevelada(!manoRevelada);
            addLog(manoRevelada ? "Has ocultado tu mano." : "Has revelado tu mano.");
          }}
        >
          {manoRevelada ? '👁️ Ocultar Mano' : 'Revelar Mano'}
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

export default SolitaryBoard;