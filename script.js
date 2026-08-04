/**
 * APLICACIÓN LECTORA DE NFC
 * =========================
 * Esta aplicación web utiliza la API Web NFC para leer etiquetas NFC
 * directamente desde el navegador en dispositivos compatibles.
 * 
 * Requisitos:
 * - Dispositivo Android con Chrome 89 o superior
 * - Hardware NFC en el dispositivo
 * - Conexión HTTPS o localhost (requerido por la API Web NFC)
 */

class NFCReader {
    /**
     * Constructor de la clase NFCReader
     * Inicializa todas las referencias del DOM y configura los event listeners
     */
    constructor() {
        // Referencias a elementos del DOM para manipulación de la interfaz
        this.startButton = document.getElementById('startScan');
        this.stopButton = document.getElementById('stopScan');
        this.nfcStatus = document.getElementById('nfcStatus');
        this.tagInfo = document.getElementById('tagInfo');
        this.messageContainer = document.getElementById('messageContainer');
        
        // Referencias a los campos de información de la etiqueta
        this.tagType = document.getElementById('tagType');
        this.serialNumber = document.getElementById('serialNumber');
        this.technology = document.getElementById('technology');
        this.ndefRecords = document.getElementById('ndefRecords');
        this.maxSize = document.getElementById('maxSize');
        this.isReadOnly = document.getElementById('isReadOnly');
        this.canFormat = document.getElementById('canFormat');
        
        // Variable para almacenar la referencia al lector NFC abort controller
        this.abortController = null;
        
        // Inicializar la aplicación
        this.init();
    }
    
    /**
     * Método de inicialización
     * Configura los event listeners y verifica la disponibilidad de NFC
     */
    init() {
        // Verificar si la API Web NFC está disponible en el navegador
        this.checkNFCAvailability();
        
        // Configurar event listeners para los botones
        this.startButton.addEventListener('click', () => this.startScanning());
        this.stopButton.addEventListener('click', () => this.stopScanning());
    }
    
    /**
     * Verifica si el navegador y el dispositivo soportan NFC
     * Actualiza la interfaz según el resultado
     */
    checkNFCAvailability() {
        // Verificar si el objeto NDEFReader existe en el navegador
        if (!('NDEFReader' in window)) {
            this.updateNFCStatus('unavailable', '❌ NFC no soportado');
            this.showMessage('Tu navegador no soporta la API Web NFC. Necesitas Chrome 89+ en Android.', 'error');
            return;
        }
        
        // Verificar si hay permisos para usar NFC (si la API de permisos está disponible)
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'nfc' })
                .then(permissionStatus => {
                    if (permissionStatus.state === 'granted') {
                        this.enableNFC();
                    } else if (permissionStatus.state === 'prompt') {
                        this.enableNFC();
                        this.showMessage('La aplicación necesita permiso para usar NFC. Se solicitará al iniciar el escaneo.', 'info');
                    } else {
                        this.updateNFCStatus('unavailable', '🔒 Permiso NFC denegado');
                        this.showMessage('El permiso para usar NFC ha sido denegado. Por favor, verifica la configuración de tu navegador.', 'error');
                    }
                    
                    // Escuchar cambios en el estado del permiso
                    permissionStatus.addEventListener('change', () => {
                        this.checkNFCAvailability();
                    });
                })
                .catch(() => {
                    // Si la API de permisos falla, asumimos que NFC podría estar disponible
                    this.enableNFC();
                });
        } else {
            // Si no hay API de permisos, habilitamos NFC de todos modos
            this.enableNFC();
        }
    }
    
    /**
     * Habilita la funcionalidad NFC y actualiza la interfaz
     */
    enableNFC() {
        this.updateNFCStatus('available', '✅ NFC Disponible');
        this.startButton.disabled = false;
        this.showMessage('¡NFC está disponible! Presiona "Iniciar Escaneo" para comenzar a leer etiquetas.', 'success');
    }
    
    /**
     * Actualiza el indicador de estado de NFC en la interfaz
     * @param {string} status - Clase CSS para el estado ('available', 'unavailable', 'scanning')
     * @param {string} text - Texto a mostrar en el indicador
     */
    updateNFCStatus(status, text) {
        // Remover todas las clases de estado previas
        this.nfcStatus.className = 'status-badge';
        // Agregar la nueva clase de estado
        this.nfcStatus.classList.add(status);
        // Actualizar el texto del indicador
        this.nfcStatus.querySelector('.status-text').textContent = text;
    }
    
    /**
     * Inicia el proceso de escaneo NFC
     * Crea una nueva instancia de NDEFReader y comienza a escuchar
     */
    async startScanning() {
        try {
            // Crear un nuevo controlador para poder abortar el escaneo
            this.abortController = new AbortController();
            
            // Crear instancia del lector NDEF
            const ndef = new NDEFReader();
            
            // Actualizar interfaz para mostrar estado de escaneo
            this.updateNFCStatus('scanning', '📡 Escaneando...');
            this.startButton.disabled = true;
            this.stopButton.disabled = false;
            this.showMessage('Acerca una etiqueta NFC a la parte trasera de tu dispositivo...', 'info');
            this.tagInfo.classList.add('hidden');
            
            // Iniciar el escaneo
            await ndef.scan({ signal: this.abortController.signal });
            
            this.showMessage('✅ Escaneo iniciado correctamente. Esperando etiquetas NFC...', 'success');
            
            // Configurar manejadores de eventos para lectura de etiquetas
            ndef.addEventListener("reading", ({ message, serialNumber }) => {
                this.handleTagRead(serialNumber, message);
            });
            
            // Manejar errores durante la lectura
            ndef.addEventListener("readingerror", (event) => {
                this.showMessage('Error al leer la etiqueta NFC. Intenta de nuevo.', 'error');
                console.error('Error de lectura NFC:', event);
            });
            
        } catch (error) {
            // Manejar diferentes tipos de errores
            console.error('Error al iniciar escaneo NFC:', error);
            
            if (error.name === 'AbortError') {
                this.showMessage('Escaneo detenido por el usuario.', 'info');
            } else if (error.name === 'NotAllowedError') {
                this.showMessage('Permiso para usar NFC denegado. Por favor, concede el permiso e intenta de nuevo.', 'error');
            } else if (error.name === 'NotSupportedError') {
                this.showMessage('Tu dispositivo no soporta la lectura NFC o la funcionalidad está desactivada.', 'error');
            } else {
                this.showMessage(`Error inesperado: ${error.message}`, 'error');
            }
            
            // Restaurar la interfaz
            this.resetUI();
        }
    }
    
    /**
     * Procesa la información de una etiqueta NFC leída
     * @param {string} serialNumber - Número de serie de la etiqueta
     * @param {NDEFMessage} message - Mensaje NDEF completo
     */
    handleTagRead(serialNumber, message) {
        // Hacer visible la sección de información
        this.tagInfo.classList.remove('hidden');
        
        // Actualizar información básica de la etiqueta
        this.serialNumber.textContent = serialNumber;
        this.tagType.textContent = this.determineTagType(message);
        this.technology.textContent = 'NFC Forum Type 2/4/5'; // Genérico ya que Web NFC no expone esto
        
        // Procesar registros NDEF
        this.processNDEFRecords(message.records);
        
        // Actualizar detalles técnicos (valores típicos, Web NFC no expone todos)
        this.maxSize.textContent = 'Variable (depende del tipo de etiqueta)';
        this.isReadOnly.textContent = 'No disponible en Web NFC';
        this.canFormat.textContent = 'No disponible en Web NFC';
        
        // Mostrar mensaje de éxito
        this.showMessage('✅ ¡Etiqueta NFC leída exitosamente!', 'success');
        
        // Hacer vibrar el dispositivo si está disponible (feedback háptico)
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }
    }
    
    /**
     * Determina el tipo de etiqueta basado en los registros NDEF
     * @param {NDEFMessage} message - Mensaje NDEF
     * @returns {string} - Tipo de etiqueta determinado
     */
    determineTagType(message) {
        if (!message.records || message.records.length === 0) {
            return 'Etiqueta vacía o no NDEF';
        }
        
        // Analizar los tipos de registros para determinar el tipo de etiqueta
        const recordTypes = message.records.map(record => record.recordType);
        
        if (recordTypes.includes('smart-poster')) {
            return 'Smart Poster';
        } else if (recordTypes.includes('url')) {
            return 'Etiqueta URL';
        } else if (recordTypes.includes('text')) {
            return 'Etiqueta de Texto';
        } else if (recordTypes.includes('mime')) {
            return 'Etiqueta MIME';
        } else if (recordTypes.includes('empty')) {
            return 'Etiqueta Vacía';
        }
        
        return 'Etiqueta NDEF Genérica';
    }
    
    /**
     * Procesa y muestra los registros NDEF de la etiqueta
     * @param {Array} records - Array de registros NDEF
     */
    processNDEFRecords(records) {
        // Limpiar el contenedor de registros
        this.ndefRecords.innerHTML = '';
        
        if (!records || records.length === 0) {
            this.ndefRecords.innerHTML = '<p class="placeholder">No se encontraron registros NDEF</p>';
            return;
        }
        
        // Procesar cada registro NDEF
        records.forEach((record, index) => {
            const recordElement = this.createRecordElement(record, index);
            this.ndefRecords.appendChild(recordElement);
        });
    }
    
    /**
     * Crea un elemento DOM para un registro NDEF individual
     * @param {NDEFRecord} record - Registro NDEF individual
     * @param {number} index - Índice del registro en el mensaje
     * @returns {HTMLElement} - Elemento DOM del registro
     */
    createRecordElement(record, index) {
        const recordDiv = document.createElement('div');
        recordDiv.className = 'ndef-record';
        
        // Determinar el tipo de registro de manera legible
        let recordTypeText = record.recordType;
        switch (record.recordType) {
            case 'empty':
                recordTypeText = 'Vacío';
                break;
            case 'text':
                recordTypeText = 'Texto';
                break;
            case 'url':
                recordTypeText = 'URL';
                break;
            case 'smart-poster':
                recordTypeText = 'Smart Poster';
                break;
            case 'mime':
                recordTypeText = `MIME (${record.mediaType || 'desconocido'})`;
                break;
            case 'absolute-url':
                recordTypeText = 'URL Absoluta';
                break;
        }
        
        // Decodificar y procesar los datos del registro
        let recordData = 'Datos no disponibles';
        
        try {
            // Intentar diferentes métodos de decodificación según el tipo
            if (record.recordType === 'text') {
                const textDecoder = new TextDecoder(record.encoding || 'utf-8');
                recordData = textDecoder.decode(record.data);
            } else if (record.recordType === 'url' || record.recordType === 'absolute-url') {
                const textDecoder = new TextDecoder();
                recordData = textDecoder.decode(record.data);
                // Si es una URL, hacerla cliqueable visualmente
                if (this.isValidURL(recordData)) {
                    recordData = `<a href="${recordData}" target="_blank" rel="noopener noreferrer">${recordData}</a>`;
                }
            } else if (record.data) {
                // Para otros tipos, mostrar datos en bruto
                const textDecoder = new TextDecoder();
                recordData = textDecoder.decode(record.data);
            }
        } catch (e) {
            console.warn('Error decodificando registro NDEF:', e);
            recordData = 'Error al decodificar los datos';
        }
        
        // Construir el HTML del registro
        recordDiv.innerHTML = `
            <div class="record-header">
                <span class="record-type">${recordTypeText}</span>
                <span class="record-index">Registro #${index + 1}</span>
            </div>
            <div class="record-data">${recordData}</div>
            ${record.mediaType ? `<div class="record-meta">Media Type: ${record.mediaType}</div>` : ''}
            ${record.id ? `<div class="record-meta">ID: ${record.id}</div>` : ''}
        `;
        
        return recordDiv;
    }
    
    /**
     * Verifica si una cadena es una URL válida
     * @param {string} string - Cadena a verificar
     * @returns {boolean} - True si es una URL válida
     */
    isValidURL(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
    
    /**
     * Detiene el proceso de escaneo NFC
     */
    stopScanning() {
        if (this.abortController) {
            // Abortar la operación de escaneo
            this.abortController.abort();
            this.abortController = null;
        }
        
        // Restaurar la interfaz de usuario
        this.resetUI();
        this.showMessage('Escaneo detenido.', 'info');
    }
    
    /**
     * Restaura la interfaz de usuario a su estado inicial
     */
    resetUI() {
        this.updateNFCStatus('available', '✅ NFC Disponible');
        this.startButton.disabled = false;
        this.stopButton.disabled = true;
    }
    
    /**
     * Muestra un mensaje en el contenedor de mensajes
     * @param {string} message - Texto del mensaje
     * @param {string} type - Tipo de mensaje ('error', 'success', 'info')
     */
    showMessage(message, type = 'info') {
        this.messageContainer.textContent = message;
        this.messageContainer.className = 'message-container';
        this.messageContainer.classList.add(type);
        
        // Auto-ocultar mensajes de éxito después de 5 segundos
        if (type === 'success') {
            setTimeout(() => {
                if (this.messageContainer.textContent === message) {
                    this.messageContainer.textContent = '';
                }
            }, 5000);
        }
    }
}

/**
 * Inicialización de la aplicación
 * Espera a que el DOM esté completamente cargado antes de instanciar el lector NFC
 */
document.addEventListener('DOMContentLoaded', () => {
    // Crear instancia del lector NFC
    window.nfcReader = new NFCReader();
    
    // Registrar Service Worker para funcionalidad PWA (opcional)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('Service Worker registrado exitosamente:', registration);
            })
            .catch(error => {
                console.log('Error al registrar Service Worker:', error);
            });
    }
});
