/**
 * APLICACIÓN LECTORA DE NFC - VERSIÓN MEJORADA
 * ============================================
 * Versión optimizada para extraer y analizar la máxima información posible
 * de las etiquetas NFC usando la API Web NFC.
 */

class NFCReader {
    constructor() {
        // Referencias a elementos del DOM
        this.startButton = document.getElementById('startScan');
        this.stopButton = document.getElementById('stopScan');
        this.nfcStatus = document.getElementById('nfcStatus');
        this.tagInfo = document.getElementById('tagInfo');
        this.messageContainer = document.getElementById('messageContainer');
        
        // Referencias a campos de información
        this.tagType = document.getElementById('tagType');
        this.serialNumber = document.getElementById('serialNumber');
        this.technology = document.getElementById('technology');
        this.ndefRecords = document.getElementById('ndefRecords');
        this.maxSize = document.getElementById('maxSize');
        this.isReadOnly = document.getElementById('isReadOnly');
        this.canFormat = document.getElementById('canFormat');
        
        // Variables para almacenar datos
        this.abortController = null;
        this.currentTagData = null;
        
        this.init();
    }
    
    init() {
        this.checkNFCAvailability();
        this.startButton.addEventListener('click', () => this.startScanning());
        this.stopButton.addEventListener('click', () => this.stopScanning());
    }
    
    checkNFCAvailability() {
        if (!('NDEFReader' in window)) {
            this.updateNFCStatus('unavailable', '❌ NFC no soportado');
            this.showMessage('Tu navegador no soporta la API Web NFC. Necesitas Chrome 89+ en Android.', 'error');
            return;
        }
        
        // Verificar si hay hardware NFC disponible
        if (navigator.permissions) {
            navigator.permissions.query({ name: 'nfc' })
                .then(permissionStatus => {
                    if (permissionStatus.state === 'granted') {
                        this.enableNFC();
                    } else if (permissionStatus.state === 'prompt') {
                        this.enableNFC();
                        this.showMessage('La aplicación necesita permiso para usar NFC.', 'info');
                    } else {
                        this.updateNFCStatus('unavailable', '🔒 Permiso NFC denegado');
                    }
                })
                .catch(() => {
                    this.enableNFC();
                });
        } else {
            this.enableNFC();
        }
    }
    
    enableNFC() {
        this.updateNFCStatus('available', '✅ NFC Disponible');
        this.startButton.disabled = false;
    }
    
    updateNFCStatus(status, text) {
        this.nfcStatus.className = 'status-badge';
        this.nfcStatus.classList.add(status);
        this.nfcStatus.querySelector('.status-text').textContent = text;
    }
    
    async startScanning() {
        try {
            this.abortController = new AbortController();
            const ndef = new NDEFReader();
            
            this.updateNFCStatus('scanning', '📡 Escaneando...');
            this.startButton.disabled = true;
            this.stopButton.disabled = false;
            this.showMessage('Acerca una etiqueta NFC a tu dispositivo...', 'info');
            this.tagInfo.classList.add('hidden');
            
            await ndef.scan({ signal: this.abortController.signal });
            
            this.showMessage('✅ Escaneo iniciado. Esperando etiquetas...', 'success');
            
            ndef.addEventListener("reading", ({ message, serialNumber }) => {
                this.handleTagRead(serialNumber, message);
            });
            
            ndef.addEventListener("readingerror", (event) => {
                this.showMessage('Error al leer la etiqueta. Intenta de nuevo.', 'error');
                console.error('Error de lectura:', event);
            });
            
        } catch (error) {
            console.error('Error:', error);
            if (error.name === 'AbortError') {
                this.showMessage('Escaneo detenido.', 'info');
            } else if (error.name === 'NotAllowedError') {
                this.showMessage('Permiso NFC denegado.', 'error');
            } else if (error.name === 'NotSupportedError') {
                this.showMessage('NFC no soportado o desactivado.', 'error');
            } else {
                this.showMessage(`Error: ${error.message}`, 'error');
            }
            this.resetUI();
        }
    }
    
    /**
     * MÉTODO MEJORADO: Análisis detallado de la etiqueta NFC
     * Extrae y analiza toda la información disponible de la etiqueta
     */
    handleTagRead(serialNumber, message) {
        // Almacenar datos para análisis
        this.currentTagData = {
            serialNumber: serialNumber,
            message: message,
            records: message.records || [],
            timestamp: new Date()
        };
        
        // Hacer visible la sección de información
        this.tagInfo.classList.remove('hidden');
        
        // 1. ANÁLISIS DEL NÚMERO DE SERIE
        this.analyzeSerialNumber(serialNumber);
        
        // 2. ANÁLISIS DEL MENSAJE NDEF
        this.analyzeNDEFMessage(message);
        
        // 3. ANÁLISIS DE REGISTROS
        this.processNDEFRecords(message.records);
        
        // 4. ANÁLISIS TÉCNICO INFERIDO
        this.analyzeTechnicalDetails(message);
        
        // Feedback háptico
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }
        
        this.showMessage('✅ ¡Etiqueta NFC leída exitosamente!', 'success');
    }
    
    /**
     * Analiza el número de serie para inferir información del fabricante
     */
    analyzeSerialNumber(serialNumber) {
        this.serialNumber.textContent = serialNumber;
        
        // Análisis del número de serie
        const serialClean = serialNumber.replace(/[:\s]/g, '').toUpperCase();
        
        // Detectar fabricante por prefijo del número de serie
        let manufacturer = 'Desconocido';
        let chipType = 'No determinado';
        
        if (serialClean.startsWith('04')) {
            manufacturer = 'NXP Semiconductors';
            
            // Análisis más detallado para chips NXP comunes
            const serialBytes = serialClean.match(/.{1,2}/g) || [];
            
            if (serialBytes.length >= 7) {
                const byte0 = parseInt(serialBytes[0], 16);
                const byte1 = parseInt(serialBytes[1], 16);
                const byte2 = parseInt(serialBytes[2], 16);
                
                // Identificación de chips NXP comunes
                if (byte1 === 0x01) {
                    if (byte2 >= 0x10 && byte2 <= 0x13) {
                        chipType = 'NTAG210/212 (48-164 bytes)';
                    } else if (byte2 >= 0x14 && byte2 <= 0x17) {
                        chipType = 'NTAG213 (144 bytes)';
                    } else if (byte2 >= 0x18 && byte2 <= 0x1B) {
                        chipType = 'NTAG215 (504 bytes)';
                    } else if (byte2 >= 0x1C && byte2 <= 0x1F) {
                        chipType = 'NTAG216 (888 bytes)';
                    }
                }
            }
        } else if (serialClean.startsWith('08')) {
            manufacturer = 'STMicroelectronics';
        } else if (serialClean.startsWith('24')) {
            manufacturer = 'Infineon Technologies';
        }
        
        // Actualizar UI con información del fabricante
        this.tagType.innerHTML = `
            <div style="margin-bottom: 10px;">
                <strong>Chip Probable:</strong> ${chipType}
            </div>
            <div style="color: #7f8c8d; font-size: 0.9em;">
                <strong>Fabricante:</strong> ${manufacturer}
            </div>
            <div style="color: #95a5a6; font-size: 0.8em; margin-top: 5px;">
                📝 Esta información es inferida del número de serie y puede no ser 100% precisa
            </div>
        `;
    }
    
    /**
     * Analiza el mensaje NDEF completo
     */
    analyzeNDEFMessage(message) {
        const records = message.records || [];
        
        // Calcular uso de memoria aproximado
        let totalDataSize = 0;
        records.forEach(record => {
            if (record.data) {
                totalDataSize += record.data.byteLength;
            }
        });
        
        // Mostrar información de uso
        this.technology.innerHTML = `
            <strong>Registros NDEF:</strong> ${records.length}<br>
            <strong>Datos totales:</strong> ${totalDataSize} bytes<br>
            <strong>Tipo de mensaje:</strong> ${this.determineMessageType(records)}
        `;
    }
    
    /**
     * Determina el tipo de mensaje basado en los registros
     */
    determineMessageType(records) {
        if (!records || records.length === 0) return 'Etiqueta vacía';
        
        const types = records.map(r => r.recordType);
        
        if (types.includes('smart-poster')) return 'Smart Poster';
        if (types.includes('url') || types.includes('absolute-url')) return 'Etiqueta URL';
        if (types.includes('text')) return 'Etiqueta de Texto';
        if (types.includes('mime')) return 'Etiqueta MIME';
        if (types.includes('empty')) return 'Etiqueta Vacía';
        
        return 'Mixta/Personalizada';
    }
    
    /**
     * Procesa y muestra los registros NDEF con máximo detalle
     */
    processNDEFRecords(records) {
        this.ndefRecords.innerHTML = '';
        
        if (!records || records.length === 0) {
            this.ndefRecords.innerHTML = '<p class="placeholder">No se encontraron registros NDEF</p>';
            return;
        }
        
        records.forEach((record, index) => {
            const recordElement = this.createDetailedRecordElement(record, index);
            this.ndefRecords.appendChild(recordElement);
        });
    }
    
    /**
     * Crea un elemento detallado para cada registro NDEF
     */
    createDetailedRecordElement(record, index) {
        const recordDiv = document.createElement('div');
        recordDiv.className = 'ndef-record';
        
        // Información completa del registro
        let html = `
            <div class="record-header">
                <span class="record-type">${this.getRecordTypeName(record)}</span>
                <span class="record-index">Registro #${index + 1}</span>
            </div>
        `;
        
        // Datos del registro según su tipo
        html += `<div class="record-data-details">`;
        
        // Procesar datos según el tipo de registro
        if (record.recordType === 'text') {
            const textDecoder = new TextDecoder(record.encoding || 'utf-8');
            const text = textDecoder.decode(record.data);
            
            html += `
                <div class="detail-row">
                    <span class="detail-label">📝 Texto:</span>
                    <span class="detail-value">${text}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">🌐 Idioma:</span>
                    <span class="detail-value">${record.lang || 'No especificado'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">🔤 Codificación:</span>
                    <span class="detail-value">${record.encoding || 'utf-8'}</span>
                </div>
            `;
        } else if (record.recordType === 'url' || record.recordType === 'absolute-url') {
            const textDecoder = new TextDecoder();
            const url = textDecoder.decode(record.data);
            
            html += `
                <div class="detail-row">
                    <span class="detail-label">🔗 URL:</span>
                    <span class="detail-value">
                        <a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>
                    </span>
                </div>
            `;
        } else if (record.recordType === 'mime') {
            html += `
                <div class="detail-row">
                    <span class="detail-label">📦 Tipo MIME:</span>
                    <span class="detail-value">${record.mediaType || 'desconocido'}</span>
                </div>
            `;
            
            if (record.data) {
                html += `
                    <div class="detail-row">
                        <span class="detail-label">📏 Tamaño:</span>
                        <span class="detail-value">${record.data.byteLength} bytes</span>
                    </div>
                `;
            }
        }
        
        // Información común a todos los registros
        if (record.data) {
            html += `
                <div class="detail-row">
                    <span class="detail-label">📏 Tamaño de datos:</span>
                    <span class="detail-value">${record.data.byteLength} bytes</span>
                </div>
            `;
        }
        
        if (record.id) {
            html += `
                <div class="detail-row">
                    <span class="detail-label">🆔 ID:</span>
                    <span class="detail-value">${record.id}</span>
                </div>
            `;
        }
        
        // Mostrar datos en bruto (hexadecimal)
        if (record.data) {
            const dataView = new Uint8Array(record.data.buffer);
            const hexString = Array.from(dataView)
                .slice(0, 32) // Primeros 32 bytes
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
            
            html += `
                <div class="detail-row">
                    <span class="detail-label">🔢 Datos (hex):</span>
                    <span class="detail-value hex-data">${hexString}${dataView.length > 32 ? '...' : ''}</span>
                </div>
            `;
        }
        
        html += `</div>`;
        
        recordDiv.innerHTML = html;
        return recordDiv;
    }
    
    /**
     * Obtiene un nombre descriptivo para el tipo de registro
     */
    getRecordTypeName(record) {
        const typeMap = {
            'empty': '🏷️ Vacío',
            'text': '📝 Texto',
            'url': '🔗 URL',
            'absolute-url': '🔗 URL Absoluta',
            'smart-poster': '📊 Smart Poster',
            'mime': '📦 Datos MIME',
            'unknown': '❓ Desconocido'
        };
        
        return typeMap[record.recordType] || `📋 ${record.recordType}`;
    }
    
    /**
     * Análisis técnico inferido de la etiqueta
     */
    analyzeTechnicalDetails(message) {
        const records = message.records || [];
        
        // Calcular tamaño total de datos
        let totalSize = 0;
        records.forEach(record => {
            if (record.data) {
                totalSize += record.data.byteLength;
            }
        });
        
        // Estimar capacidad de la etiqueta basado en el tipo de chip detectado
        let estimatedCapacity = 'Desconocida';
        let isFormateable = 'Probablemente sí';
        
        // Si detectamos un chip NXP específico, podemos estimar
        const serialClean = this.currentTagData.serialNumber.replace(/[:\s]/g, '').toUpperCase();
        const serialBytes = serialClean.match(/.{1,2}/g) || [];
        
        if (serialBytes.length >= 3 && serialBytes[0] === '04') {
            const byte2 = parseInt(serialBytes[2], 16);
            
            if (byte2 >= 0x14 && byte2 <= 0x17) {
                estimatedCapacity = '144 bytes (NTAG213)';
                isFormateable = 'Sí (NTAG213 es regrabable)';
            } else if (byte2 >= 0x18 && byte2 <= 0x1B) {
                estimatedCapacity = '504 bytes (NTAG215)';
                isFormateable = 'Sí (NTAG215 es regrabable)';
            } else if (byte2 >= 0x1C && byte2 <= 0x1F) {
                estimatedCapacity = '888 bytes (NTAG216)';
                isFormateable = 'Sí (NTAG216 es regrabable)';
            }
        }
        
        // Mostrar información técnica
        this.maxSize.innerHTML = `
            <strong>Capacidad estimada:</strong> ${estimatedCapacity}<br>
            <strong>Datos actuales:</strong> ${totalSize} bytes (${((totalSize / parseInt(estimatedCapacity) * 100) || 0).toFixed(1)}% usado)<br>
            <span style="color: #95a5a6; font-size: 0.8em;">⚠️ La capacidad exacta no es accesible mediante Web NFC</span>
        `;
        
        this.isReadOnly.textContent = 'No determinable con Web NFC';
        this.canFormat.textContent = isFormateable;
    }
    
    stopScanning() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.resetUI();
        this.showMessage('Escaneo detenido.', 'info');
    }
    
    resetUI() {
        this.updateNFCStatus('available', '✅ NFC Disponible');
        this.startButton.disabled = false;
        this.stopButton.disabled = true;
    }
    
    showMessage(message, type = 'info') {
        this.messageContainer.textContent = message;
        this.messageContainer.className = 'message-container';
        this.messageContainer.classList.add(type);
        
        if (type === 'success') {
            setTimeout(() => {
                if (this.messageContainer.textContent === message) {
                    this.messageContainer.textContent = '';
                }
            }, 5000);
        }
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    window.nfcReader = new NFCReader();
});
