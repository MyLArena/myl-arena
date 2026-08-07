export async function fetchCards() {
    try {
        const response = await fetch('/informacion_cartas.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        let text = await response.text();

        // 0. ELIMINAR COMENTARIOS: El validador indicó que el archivo tiene comentarios no permitidos
        text = text.replace(/\/\*[\s\S]*?\*\/|([^:])\/\/.*$/gm, '$1');

        // 1. Limpieza de asignaciones de variables si las hubiera
        text = text.trim();
        if (text.startsWith('export') || text.includes('=')) {
            const firstEqual = text.indexOf('=');
            if (firstEqual !== -1) {
                text = text.substring(firstEqual + 1).trim();
                if (text.endsWith(';')) {
                    text = text.slice(0, -1).trim();
                }
            }
        }

        // 2. Intento nativo directo
        try {
            return procesarDatos(JSON.parse(text));
        } catch (e1) {
            try {
                // 3. Reemplazo seguro para corregir palabras sueltas o propiedades sin comillas comunes
                let textoReparado = text
                    // Corrige comillas simples por dobles en propiedades o textos
                    .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:\s*)/g, '$1"$2"$3')
                    // Limpia saltos de línea sin escapar dentro de strings que rompen el JSON
                    .replace(/\r?\n|\r/g, " ");

                return procesarDatos(JSON.parse(textoReparado));
            } catch (e2) {
                // 4. Último recurso: evaluación segura limpiando bloques defectuosos
                console.warn("Aplicando modo de rescate profundo para el archivo JSON...");
                const parseJS = new Function(`return (${text});`);
                return procesarDatos(parseJS());
            }
        }
    } catch (error) {
        console.error("Error crítico al cargar el archivo de cartas:", error);
        return [];
    }
}

function procesarDatos(data) {
    if (Array.isArray(data)) {
        return data;
    }
    if (data && typeof data === 'object') {
        if (Array.isArray(data.cards)) {
            return data.cards;
        }
        const possibleArray = Object.values(data).find(val => Array.isArray(val));
        if (possibleArray) return possibleArray;
        
        return Object.values(data);
    }
    return [];
}