// GIRO - Sistema Inteligente de Recolección de Residuos - JavaScript
let map;
let markers = [];
let directionsService;
let directionsRenderer;
let autoRefreshInterval;
let currentRoute = [];

// Real-time GPS tracking variables (Waze-style navigation)
let watchId = null;
let userLocation = null;
let currentRouteStep = 0;
let activeRoute = [];
let isNavigating = false;
let userMarker = null;
let proximityThreshold = 50; // meters to consider "arrived" at container

// Initialize map with Waze-style Google Maps
function initMap() {
    try {
        // Always use Waze-style Google Maps interface
        console.log('Inicializando mapa estilo Waze con Google Maps');
        initWazeStyleMap();
        return;
        
        // Default center (Santiago, Chile for Chilean context)
        const defaultCenter = { lat: -33.4489, lng: -70.6693 }; // Santiago, Chile
        
        // Advanced map configuration
        map = new google.maps.Map(document.getElementById("map"), {
            zoom: 12,
            center: defaultCenter,
            mapTypeId: 'roadmap',
            zoomControl: true,
            mapTypeControl: false,
            scaleControl: true,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: true,
            styles: [
                {
                    featureType: 'poi.business',
                    elementType: 'labels',
                    stylers: [{ visibility: 'off' }]
                },
                {
                    featureType: 'transit',
                    elementType: 'labels.icon',
                    stylers: [{ visibility: 'off' }]
                }
            ]
        });

        // Initialize Directions Service with error handling
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            polylineOptions: {
                strokeColor: '#4a7c59', // GIRO green
                strokeWeight: 5,
                strokeOpacity: 0.8
            },
            draggable: false,
            panel: null
        });
        directionsRenderer.setMap(map);

        // Load initial markers
        loadMarkers();
        
        console.log('Google Maps inicializado correctamente');
    } catch (error) {
        console.error('Error inicializando Google Maps:', error);
        console.log('Cambiando a OpenStreetMap como alternativa');
        initOpenStreetMap();
    }
}

// Show map error message
function showMapError(message) {
    const mapElement = document.getElementById('map');
    if (mapElement) {
        mapElement.innerHTML = `
            <div class="d-flex flex-column justify-content-center align-items-center h-100 text-center p-4">
                <i class="bi bi-exclamation-triangle display-4 text-warning mb-3"></i>
                <h5 class="text-muted mb-2">Error de Mapa</h5>
                <p class="text-muted mb-3">${message}</p>
                <button class="btn btn-outline-primary btn-sm" onclick="location.reload()">
                    <i class="bi bi-arrow-clockwise me-1"></i>Recargar Página
                </button>
            </div>
        `;
        mapElement.style.backgroundColor = '#f8f9fa';
    }
}

// Load markers from bins data
function loadMarkers() {
    clearMarkers();
    
    if (!window.binsData || window.binsData.length === 0) {
        console.log('No hay datos de contenedores disponibles');
        return;
    }

    let bounds = new google.maps.LatLngBounds();

    window.binsData.forEach(bin => {
        const position = { lat: parseFloat(bin.lat), lng: parseFloat(bin.lng) };
        
        // Determinar color del marcador basado en el nivel de llenado
        let fillColor, strokeColor, statusText;
        if (bin.nivel_llenado <= 30) {
            fillColor = '#4a7c59'; // Verde GIRO
            strokeColor = '#3a5e47';
            statusText = 'Bajo';
        } else if (bin.nivel_llenado <= 70) {
            fillColor = '#e67e22'; // Naranja
            strokeColor = '#d35400';
            statusText = 'Medio';
        } else {
            fillColor = '#c0392b'; // Rojo
            strokeColor = '#a93226';
            statusText = 'Alto';
        }

        // Create custom marker
        const marker = new google.maps.Marker({
            position: position,
            map: map,
            title: `Contenedor ${bin.id} - ${bin.nivel_llenado}% lleno`,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: fillColor,
                fillOpacity: 0.8,
                strokeColor: strokeColor,
                strokeWeight: 2
            }
        });

        // Crear ventana de información
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div class="info-window">
                    <h6><i class="bi bi-trash"></i> Contenedor ${bin.id}</h6>
                    <p class="mb-1"><strong>Nivel de Llenado:</strong> ${bin.nivel_llenado}%</p>
                    <div class="progress mb-2">
                        <div class="progress-bar ${bin.nivel_llenado <= 30 ? 'bg-success' : bin.nivel_llenado <= 70 ? 'bg-warning' : 'bg-danger'}" 
                             style="width: ${bin.nivel_llenado}%"></div>
                    </div>
                    <p class="mb-1"><strong>Estado:</strong> <span class="badge ${bin.nivel_llenado <= 30 ? 'bg-success' : bin.nivel_llenado <= 70 ? 'bg-warning' : 'bg-danger'}">${statusText}</span></p>
                    <p class="mb-1"><strong>Ubicación:</strong> ${bin.lat.toFixed(6)}, ${bin.lng.toFixed(6)}</p>
                    <p class="mb-0"><small><strong>Actualizado:</strong> ${formatTimestamp(bin.timestamp)}</small></p>
                </div>
            `
        });

        marker.addListener('click', () => {
            // Close all other info windows
            markers.forEach(m => {
                if (m.infoWindow) {
                    m.infoWindow.close();
                }
            });
            infoWindow.open(map, marker);
        });

        marker.infoWindow = infoWindow;
        markers.push(marker);
        bounds.extend(position);
    });

    // Adjust map to fit all markers
    if (markers.length > 0) {
        if (markers.length === 1) {
            map.setCenter(markers[0].getPosition());
            map.setZoom(15);
        } else {
            map.fitBounds(bounds);
            const padding = { top: 50, right: 50, bottom: 50, left: 50 };
            map.fitBounds(bounds, padding);
        }
    }

    console.log(`Cargados ${markers.length} marcadores`);
}

// Clear all markers
function clearMarkers() {
    markers.forEach(marker => {
        if (marker.infoWindow) {
            marker.infoWindow.close();
        }
        marker.setMap(null);
    });
    markers = [];
}

// Calculate optimized route with enhanced error handling
function calculateRoute() {
    try {
        if (!directionsService || !directionsRenderer) {
            console.error('Servicios de Google Maps no están disponibles');
            showNotification('Los servicios de mapas no están disponibles. Por favor verifica la conexión.', 'error');
            return;
        }

        if (!window.binsData || window.binsData.length === 0) {
            showNotification('No hay datos de contenedores para calcular la ruta', 'warning');
            return;
        }

        // Filter high priority bins (>70% fill level) with valid coordinates
        const highPriorityBins = window.binsData.filter(bin => 
            bin.nivel_llenado > 70 && 
            bin.lat && bin.lng && 
            !isNaN(parseFloat(bin.lat)) && 
            !isNaN(parseFloat(bin.lng))
        );
        
        if (highPriorityBins.length === 0) {
            showNotification('No hay contenedores que requieran recolección prioritaria (>70% llenos)', 'warning');
            return;
        }

        // Show loading indicators
        const routeDistanceEl = document.getElementById('routeDistance');
        const routeTimeEl = document.getElementById('routeTime');
        if (routeDistanceEl) {
            routeDistanceEl.textContent = 'Calculando...';
            routeDistanceEl.className = 'badge bg-secondary';
        }
        if (routeTimeEl) {
            routeTimeEl.textContent = 'Calculando...';
            routeTimeEl.className = 'badge bg-secondary';
        }

        // Clear existing route
        directionsRenderer.setDirections({routes: []});
        
        // Setup route parameters
        const origin = { lat: parseFloat(highPriorityBins[0].lat), lng: parseFloat(highPriorityBins[0].lng) };
        const destination = highPriorityBins.length > 1 
            ? { lat: parseFloat(highPriorityBins[highPriorityBins.length - 1].lat), lng: parseFloat(highPriorityBins[highPriorityBins.length - 1].lng) }
            : origin;
        
        let waypoints = [];
        if (highPriorityBins.length > 2) {
            waypoints = highPriorityBins.slice(1, -1).map(bin => ({
                location: { lat: parseFloat(bin.lat), lng: parseFloat(bin.lng) },
                stopover: true
            }));
        }

        const request = {
            origin: origin,
            destination: destination,
            waypoints: waypoints,
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.METRIC,
            avoidHighways: false,
            avoidTolls: false
        };

        directionsService.route(request, function(result, status) {
            try {
                if (status === 'OK' && result.routes && result.routes.length > 0) {
                    directionsRenderer.setDirections(result);
                    currentRoute = result;
                    
                    // Calculate total distance and time
                    const route = result.routes[0];
                    let totalDistance = 0;
                    let totalTime = 0;
                    
                    route.legs.forEach(leg => {
                        totalDistance += leg.distance.value;
                        totalTime += leg.duration.value;
                    });
                    
                    // Update route info with success styling
                    if (routeDistanceEl) {
                        routeDistanceEl.textContent = `${(totalDistance / 1000).toFixed(1)} km`;
                        routeDistanceEl.className = 'badge bg-success';
                    }
                    if (routeTimeEl) {
                        routeTimeEl.textContent = `${Math.round(totalTime / 60)} min`;
                        routeTimeEl.className = 'badge bg-info';
                    }
                    
                    console.log(`Ruta optimizada: ${highPriorityBins.length} contenedores críticos, ${(totalDistance / 1000).toFixed(1)}km, ${Math.round(totalTime / 60)}min`);
                    showNotification(`Ruta optimizada calculada: ${highPriorityBins.length} contenedores críticos`, 'success');
                } else {
                    handleRouteError(status);
                }
            } catch (error) {
                console.error('Error procesando resultado de ruta:', error);
                handleRouteError('PROCESSING_ERROR');
            }
        });
    } catch (error) {
        console.error('Error calculando la ruta:', error);
        handleRouteError('GENERAL_ERROR');
    }
}

// Handle route calculation errors
function handleRouteError(status) {
    const routeDistanceEl = document.getElementById('routeDistance');
    const routeTimeEl = document.getElementById('routeTime');
    
    let errorMessage = 'Error desconocido';
    
    switch(status) {
        case 'ZERO_RESULTS':
            errorMessage = 'No se encontró ruta entre los puntos especificados';
            break;
        case 'OVER_QUERY_LIMIT':
            errorMessage = 'Se excedió el límite de consultas de la API';
            break;
        case 'REQUEST_DENIED':
            errorMessage = 'Solicitud denegada - verifica la clave API';
            break;
        case 'INVALID_REQUEST':
            errorMessage = 'Solicitud inválida - verifica las coordenadas';
            break;
        case 'UNKNOWN_ERROR':
            errorMessage = 'Error del servidor - inténtalo más tarde';
            break;
        case 'PROCESSING_ERROR':
            errorMessage = 'Error procesando la respuesta del servidor';
            break;
        case 'GENERAL_ERROR':
            errorMessage = 'Error general calculando la ruta';
            break;
        default:
            errorMessage = `Error de ruta: ${status}`;
    }
    
    if (routeDistanceEl) {
        routeDistanceEl.textContent = 'Error';
        routeDistanceEl.className = 'badge bg-danger';
    }
    if (routeTimeEl) {
        routeTimeEl.textContent = 'Error';
        routeTimeEl.className = 'badge bg-danger';
    }
    
    console.error('Error calculando la ruta:', errorMessage);
    showNotification(errorMessage, 'error');
}

// Actualizar datos del servidor desde API FastAPI
async function refreshData() {
    try {
        const button = document.querySelector('[onclick="refreshData()"]');
        if (button) button.classList.add('loading');
        
        showNotification('Actualizando datos desde la API...', 'info');
        
        // Obtener datos frescos desde la API FastAPI
        const response = await fetch('/api_refresh.php');
        if (response.ok) {
            // Recargar la página para mostrar datos actualizados
            window.location.reload();
        } else {
            throw new Error('Error conectando con la API');
        }
    } catch (error) {
        console.error('Error actualizando datos:', error);
        showNotification('Error al actualizar datos desde la API', 'error');
    } finally {
        const button = document.querySelector('[onclick="refreshData()"]');
        if (button) {
            button.classList.remove('loading');
        }
    }
}

// Ordenar contenedores en la tabla
function sortBins(criteria) {
    const tableBody = document.querySelector('#binsTable tbody');
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    
    if (rows.length <= 1) return; // Sin datos o solo encabezado

    rows.sort((a, b) => {
        if (criteria === 'nivel_llenado') {
            const aFill = parseInt(a.cells[1].textContent);
            const bFill = parseInt(b.cells[1].textContent);
            return bFill - aFill; // Orden descendente (más alto primero)
        } else if (criteria === 'timestamp') {
            const aTime = a.cells[3].textContent;
            const bTime = b.cells[3].textContent;
            return bTime.localeCompare(aTime); // Más reciente primero
        }
        return 0;
    });

    // Reordenar filas ordenadas
    rows.forEach(row => tableBody.appendChild(row));
    
    showNotification(`Ordenado por ${criteria === 'nivel_llenado' ? 'nivel de llenado' : 'fecha'}`, 'info');
}

// Alternar actualización automática
function toggleAutoRefresh() {
    const checkbox = document.getElementById('autoRefresh');
    const refreshButton = document.querySelector('[onclick="refreshData()"]');
    
    if (checkbox.checked) {
        // Iniciar actualización automática cada 30 segundos
        autoRefreshInterval = setInterval(() => {
            refreshData();
        }, 30000);
        
        refreshButton.classList.add('auto-refresh-active');
        showNotification('Actualización automática activada (intervalo de 30s)', 'info');
    } else {
        // Detener actualización automática
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
        
        refreshButton.classList.remove('auto-refresh-active');
        showNotification('Actualización automática desactivada', 'info');
    }
}

// Utility function to format timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show notification messages
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 300px;';
    notification.innerHTML = `
        <small>${message}</small>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification && notification.parentNode) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification && notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 150);
        }
    }, 3000);
}

// Inicializar todo cuando se carga el DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('GIRO - Sistema Inteligente de Recolección de Residuos cargado');
    
    // Inicializar tooltips si Bootstrap está disponible
    if (typeof bootstrap !== 'undefined') {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
});

// Manejar cambio de visibilidad de página para actualización automática
document.addEventListener('visibilitychange', function() {
    const checkbox = document.getElementById('autoRefresh');
    
    if (document.hidden && autoRefreshInterval) {
        // Página oculta, pausar actualización automática
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    } else if (!document.hidden && checkbox && checkbox.checked) {
        // Página visible de nuevo, reanudar actualización automática
        if (!autoRefreshInterval) {
            autoRefreshInterval = setInterval(() => {
                refreshData();
            }, 30000);
        }
    }
});

// Manejador de errores global
window.addEventListener('error', function(event) {
    console.error('Error de JavaScript:', event.error);
    showNotification('Ocurrió un error. Por favor, actualiza la página.', 'error');
});

// Initialize OpenStreetMap as free alternative
function initOpenStreetMap() {
    try {
        console.log('Inicializando OpenStreetMap...');
        
        // Check if Leaflet is loaded
        if (typeof L === 'undefined') {
            console.error('Leaflet no está cargado');
            showMapError('Error cargando el mapa. Por favor recarga la página.');
            return;
        }
        
        // Santiago, Chile coordinates
        const defaultLat = -33.4489;
        const defaultLng = -70.6693;
        
        // Initialize Leaflet map
        map = L.map('map').setView([defaultLat, defaultLng], 12);
        
        // Free OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        // Store markers in Leaflet format
        window.leafletMarkers = [];
        
        // Load markers for OpenStreetMap
        loadOpenStreetMapMarkers();
        
        console.log('OpenStreetMap inicializado correctamente (100% gratuito)');
        showNotification('Mapa inicializado con OpenStreetMap (gratuito)', 'success');
        
        // Start automatic user location detection
        startAutoLocationDetection();
    } catch (error) {
        console.error('Error inicializando Google Maps, usando fallback:', error);
        initOpenStreetMapFallback();
    }
}

// Initialize Waze-style Google Maps
function initWazeStyleMap() {
    // Default center (Santiago, Chile)
    const defaultCenter = { lat: -33.4489, lng: -70.6693 };
    
    // Waze-style map configuration
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 15,
        center: defaultCenter,
        mapTypeId: 'roadmap',
        zoomControl: true,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: true,
        gestureHandling: 'greedy',
        // Waze-style custom styling
        styles: [
            // Hide unnecessary POIs for cleaner Waze look
            {
                featureType: 'poi.business',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            },
            {
                featureType: 'poi.park',
                elementType: 'labels.text',
                stylers: [{ visibility: 'off' }]
            },
            {
                featureType: 'transit',
                elementType: 'labels.icon',
                stylers: [{ visibility: 'off' }]
            },
            // Enhance road visibility like Waze
            {
                featureType: 'road',
                elementType: 'geometry',
                stylers: [{ color: '#ffffff' }]
            },
            {
                featureType: 'road',
                elementType: 'labels.text.stroke',
                stylers: [{ color: '#ffffff' }, { weight: 2 }]
            },
            {
                featureType: 'road.highway',
                elementType: 'geometry',
                stylers: [{ color: '#dadada' }]
            },
            // Water and landscape styling
            {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ color: '#a2daf2' }]
            },
            {
                featureType: 'landscape',
                elementType: 'geometry',
                stylers: [{ color: '#f5f5f5' }]
            }
        ]
    });

    // Initialize Directions Service for Waze-style routing
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true, // We'll use custom Waze-style markers
        polylineOptions: {
            strokeColor: '#4285F4', // Waze blue
            strokeWeight: 8,
            strokeOpacity: 0.9
        },
        preserveViewport: false
    });
    directionsRenderer.setMap(map);

    console.log('Google Maps estilo Waze inicializado correctamente');
    
    // Load container markers with Waze styling
    loadWazeStyleMarkers();
    
    // Start automatic user location detection
    startAutoLocationDetection();
}

// Fallback to OpenStreetMap if Google Maps fails
function initOpenStreetMapFallback() {
    console.log('Usando OpenStreetMap como alternativa');
    
    // Initialize OpenStreetMap
    const defaultCenter = [-33.4489, -70.6693]; // Santiago, Chile
    
    map = L.map('map', {
        center: defaultCenter,
        zoom: 13,
        zoomControl: true,
        attributionControl: true
    });
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Store markers in Leaflet format
    window.leafletMarkers = [];
    
    // Load markers for OpenStreetMap
    loadOpenStreetMapMarkers();
    
    console.log('OpenStreetMap inicializado como alternativa');
    showNotification('Mapa inicializado con OpenStreetMap (alternativa)', 'info');
    
    // Start automatic user location detection
    startAutoLocationDetection();
}

// Load container markers with Waze-style design for Google Maps
function loadWazeStyleMarkers() {
    if (!window.binsData || window.binsData.length === 0) {
        console.log('No hay datos de contenedores para mostrar');
        return;
    }
    
    console.log('Datos de contenedores encontrados:', window.binsData);
    
    // Clear existing markers
    if (window.googleMarkers) {
        window.googleMarkers.forEach(marker => marker.setMap(null));
    }
    window.googleMarkers = [];
    
    window.binsData.forEach(bin => {
        console.log(`Procesando contenedor ${bin.id}: lat=${bin.lat}, lng=${bin.lng}, nivel=${bin.nivel_llenado}%`);
        
        // Create custom Waze-style marker for Google Maps
        const wazeMarker = createGoogleMapsWazeMarker(bin);
        window.googleMarkers.push(wazeMarker);
    });
    
    updateCounters();
    console.log(`Cargados ${window.binsData.length} marcadores estilo Waze en Google Maps`);
}

// Create Waze-style container marker for Google Maps
function createGoogleMapsWazeMarker(container) {
    const position = new google.maps.LatLng(container.lat, container.lng);
    
    // Determine colors based on fill level (Waze style)
    let fillColor, strokeColor, priority;
    if (container.nivel_llenado > 70) {
        fillColor = '#dc3545'; // Red for critical
        strokeColor = '#b02a37';
        priority = 'CRÍTICO';
    } else if (container.nivel_llenado > 30) {
        fillColor = '#ffc107'; // Yellow for medium
        strokeColor = '#e0a800';
        priority = 'MEDIO';
    } else {
        fillColor = '#28a745'; // Green for low
        strokeColor = '#1e7e34';
        priority = 'BAJO';
    }
    
    // Create Waze-style circular marker
    const wazeIcon = {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: fillColor,
        fillOpacity: 0.9,
        strokeColor: strokeColor,
        strokeWeight: 3,
        scale: 12,
        anchor: new google.maps.Point(0, 0)
    };
    
    const marker = new google.maps.Marker({
        position: position,
        map: map,
        icon: wazeIcon,
        title: `Contenedor ${container.id} - ${container.nivel_llenado}% lleno`,
        zIndex: container.nivel_llenado > 70 ? 1000 : 500
    });
    
    // Create Waze-style info window
    const infoContent = `
        <div class="waze-info-window">
            <div style="background: linear-gradient(135deg, ${fillColor}, ${strokeColor}); color: white; padding: 10px; margin: -10px -10px 10px -10px; border-radius: 8px 8px 0 0;">
                <h6 style="margin: 0; font-weight: bold;">${container.id}</h6>
            </div>
            <div style="padding: 10px 0;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <div style="width: 20px; height: 20px; background: ${fillColor}; border-radius: 3px;"></div>
                    <span><strong>${container.nivel_llenado}%</strong> lleno</span>
                </div>
                <div style="margin-bottom: 8px;">
                    <span class="badge" style="background: ${fillColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                        ${priority}
                    </span>
                </div>
                <small style="color: #666;">Último reporte: ${container.timestamp || 'Ahora'}</small>
            </div>
        </div>
    `;
    
    const infoWindow = new google.maps.InfoWindow({
        content: infoContent,
        maxWidth: 250
    });
    
    marker.addListener('click', () => {
        // Close all open info windows
        if (window.activeInfoWindow) {
            window.activeInfoWindow.close();
        }
        
        infoWindow.open(map, marker);
        window.activeInfoWindow = infoWindow;
    });
    
    return marker;
}

// Load markers for OpenStreetMap
function loadOpenStreetMapMarkers() {
    console.log('Cargando marcadores en OpenStreetMap...');
    
    // Clear existing markers
    if (window.leafletMarkers) {
        window.leafletMarkers.forEach(marker => {
            map.removeLayer(marker);
        });
        window.leafletMarkers = [];
    }
    
    if (!window.binsData || window.binsData.length === 0) {
        console.log('No hay datos de contenedores disponibles');
        return;
    }
    
    console.log('Datos de contenedores encontrados:', window.binsData);
    
    window.binsData.forEach((bin, index) => {
        const lat = parseFloat(bin.lat);
        const lng = parseFloat(bin.lng);
        
        console.log(`Procesando contenedor ${bin.id}: lat=${lat}, lng=${lng}, nivel=${bin.nivel_llenado}%`);
        
        if (isNaN(lat) || isNaN(lng)) {
            console.warn(`Coordenadas inválidas para contenedor ${bin.id}`);
            return;
        }
        
        // Determine marker color based on fill level
        let markerColor;
        if (bin.nivel_llenado <= 30) {
            markerColor = '#4a7c59'; // GIRO green
        } else if (bin.nivel_llenado <= 70) {
            markerColor = '#e67e22'; // Orange
        } else {
            markerColor = '#c0392b'; // Red
        }
        
        // Create custom icon
        const customIcon = L.divIcon({
            html: `<div style="background-color: ${markerColor}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            className: 'custom-div-icon'
        });
        
        // Create marker
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        
        // Create popup
        const statusText = bin.nivel_llenado <= 30 ? 'Bajo' : bin.nivel_llenado <= 70 ? 'Medio' : 'Alto';
        const statusClass = bin.nivel_llenado <= 30 ? 'success' : bin.nivel_llenado <= 70 ? 'warning' : 'danger';
        
        marker.bindPopup(`
            <div class="info-window">
                <h6><i class="bi bi-trash"></i> Contenedor ${bin.id}</h6>
                <p class="mb-1"><strong>Nivel:</strong> ${bin.nivel_llenado}%</p>
                <div class="progress mb-2" style="height: 10px;">
                    <div class="progress-bar bg-${statusClass}" style="width: ${bin.nivel_llenado}%"></div>
                </div>
                <p class="mb-1"><strong>Estado:</strong> <span class="badge bg-${statusClass}">${statusText}</span></p>
                <p class="mb-1"><strong>Ubicación:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
                <p class="mb-0"><small><strong>Actualizado:</strong> ${bin.timestamp}</small></p>
            </div>
        `);
        
        window.leafletMarkers.push(marker);
    });
    
    // Fit map to show all markers
    if (window.leafletMarkers.length > 0) {
        const group = new L.featureGroup(window.leafletMarkers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
    
    console.log(`Cargados ${window.leafletMarkers.length} marcadores en OpenStreetMap`);
    
    // Update UI counters
    updateCounters();
}

// Override calculateRoute function to handle both Google Maps and OpenStreetMap
const originalCalculateRoute = window.calculateRoute || function() {};

window.calculateRoute = function() {
    if (window.useOpenStreetMap && typeof L !== 'undefined') {
        calculateRouteOpenStreetMap();
    } else {
        originalCalculateRoute();
    }
};

// Calculate optimized route like Waze for OpenStreetMap
function calculateRouteOpenStreetMap() {
    showNotification('Calculando ruta optimizada desde tu ubicación...', 'info');
    
    if (!window.binsData || window.binsData.length === 0) {
        showNotification('No hay datos de contenedores para calcular ruta', 'warning');
        return;
    }
    
    // Check if user location is available
    if (!userLocation) {
        showNotification('Obteniendo tu ubicación para calcular la mejor ruta...', 'info');
        getCurrentLocationForRoute();
        return;
    }
    
    // Filter containers that need collection (>50% full)
    const containersToCollect = window.binsData.filter(bin => bin.nivel_llenado > 50);
    
    if (containersToCollect.length === 0) {
        showNotification('No hay contenedores que requieran recolección (>50% llenos)', 'warning');
        return;
    }
    
    // Sort by priority: critical first (>70%), then medium (>50%)
    const sortedContainers = containersToCollect.sort((a, b) => {
        // Priority score: level + urgency factor
        const scoreA = a.nivel_llenado + (a.nivel_llenado > 70 ? 50 : 0);
        const scoreB = b.nivel_llenado + (b.nivel_llenado > 70 ? 50 : 0);
        return scoreB - scoreA;
    });
    
    console.log('Contenedores ordenados por prioridad:', sortedContainers);
    
    // Apply Traveling Salesman Problem (TSP) optimization from user location
    const optimizedRoute = optimizeTSPRouteFromLocation(sortedContainers, userLocation);
    
    // Clear existing route and markers
    if (window.routeLine) {
        map.removeLayer(window.routeLine);
    }
    if (window.routeOutline) {
        map.removeLayer(window.routeOutline);
    }
    if (window.routeMarkers) {
        window.routeMarkers.forEach(marker => map.removeLayer(marker));
    }
    window.routeMarkers = [];
    
    // Create optimized route polyline including user location
    const routePoints = [];
    
    // Add user location as starting point
    if (userLocation) {
        routePoints.push([userLocation.lat, userLocation.lng]);
    }
    
    // Add container points
    routePoints.push(...optimizedRoute.map(bin => [parseFloat(bin.lat), parseFloat(bin.lng)]));
    
    // Create Waze-style thick blue route line
    window.routeLine = L.polyline(routePoints, {
        color: '#4285F4',           // Google Maps blue
        weight: 8,                  // Thick like Waze
        opacity: 0.9,
        lineCap: 'round',           // Rounded ends
        lineJoin: 'round'           // Rounded corners
    }).addTo(map);
    
    // Add route outline for better visibility
    window.routeOutline = L.polyline(routePoints, {
        color: '#ffffff',
        weight: 12,
        opacity: 0.6,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(map);
    
    // Bring main route to front
    if (window.routeLine) {
        window.routeLine.bringToFront();
    }
    
    // Add Waze-style starting point marker if user location exists
    if (userLocation) {
        const startIcon = L.divIcon({
            html: `
                <div style="position: relative;">
                    <!-- Shadow -->
                    <div style="
                        position: absolute;
                        top: 3px;
                        left: 3px;
                        width: 36px;
                        height: 36px;
                        background: rgba(0,0,0,0.2);
                        border-radius: 50%;
                        z-index: 1;
                    "></div>
                    <!-- Main marker -->
                    <div style="
                        position: relative;
                        width: 36px;
                        height: 36px;
                        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                        border-radius: 50%;
                        border: 3px solid white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 16px;
                        color: white;
                        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                        z-index: 2;
                    ">🚀</div>
                </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
            className: 'waze-start-marker'
        });
        
        const startMarker = L.marker([userLocation.lat, userLocation.lng], { 
            icon: startIcon,
            zIndexOffset: 1500
        }).addTo(map);
        
        startMarker.bindPopup(`
            <div class="waze-popup">
                <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 10px; margin: -10px -10px 10px -10px; border-radius: 8px 8px 0 0;">
                    <h6 style="margin: 0; font-weight: bold;"><i class="bi bi-geo-alt-fill me-2"></i>Punto de Inicio</h6>
                </div>
                <p class="mb-2"><strong>Tu ubicación actual</strong></p>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <div style="width: 20px; height: 20px; background: #4285F4; border-radius: 50%;"></div>
                    <span>Ruta optimizada desde aquí</span>
                </div>
                <small class="text-muted">Coordenadas: ${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}</small>
            </div>
        `);
        
        if (!window.routeMarkers) window.routeMarkers = [];
        window.routeMarkers.push(startMarker);
    }
    
    // Add route direction markers with Waze-style numbering
    addWazeStyleRouteMarkers(optimizedRoute);
    
    // Calculate route metrics from user location
    const distance = userLocation ? 
        calculateTotalRouteDistance(userLocation, optimizedRoute) : 
        calculateSimpleDistance(routePoints);
    const estimatedTime = calculateOptimizedTime(distance, optimizedRoute.length);
    
    // Update route info
    const routeDistanceEl = document.getElementById('routeDistance');
    const routeTimeEl = document.getElementById('routeTime');
    
    if (routeDistanceEl) {
        routeDistanceEl.textContent = `${distance.toFixed(1)} km`;
        routeDistanceEl.className = 'badge bg-success';
    }
    if (routeTimeEl) {
        routeTimeEl.textContent = `${estimatedTime} min`;
        routeTimeEl.className = 'badge bg-info';
    }
    
    // Show route summary
    const criticalCount = optimizedRoute.filter(bin => bin.nivel_llenado > 70).length;
    showNotification(`Ruta optimizada: ${optimizedRoute.length} contenedores (${criticalCount} críticos)`, 'success');
    
    // Generate step-by-step directions
    generateStepByStepDirections(optimizedRoute);
    
    // Set as active route for GPS navigation
    activeRoute = optimizedRoute;
    currentRouteStep = 0;
    
    // Add GPS navigation start button
    addGPSNavigationControls();
}

// Calculate simple distance between points (Haversine formula)
function calculateSimpleDistance(points) {
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
        const R = 6371; // Earth's radius in km
        const dLat = (points[i][0] - points[i-1][0]) * Math.PI / 180;
        const dLon = (points[i][1] - points[i-1][1]) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(points[i-1][0] * Math.PI / 180) * Math.cos(points[i][0] * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        totalDistance += R * c;
    }
    return totalDistance;
}

// Update dashboard counters
function updateCounters() {
    if (!window.binsData) return;
    
    const totalBins = window.binsData.length;
    const fullBins = window.binsData.filter(bin => bin.nivel_llenado > 70).length;
    const mediumBins = window.binsData.filter(bin => bin.nivel_llenado > 30 && bin.nivel_llenado <= 70).length;
    const lowBins = window.binsData.filter(bin => bin.nivel_llenado <= 30).length;
    
    // Update nav counter
    const activeContainersEl = document.getElementById('activeContainers');
    if (activeContainersEl) {
        activeContainersEl.textContent = totalBins;
    }
    
    // Update dashboard KPIs if they exist
    const totalContainersEl = document.querySelector('[data-metric="total"]');
    const criticalContainersEl = document.querySelector('[data-metric="critical"]');
    const mediumContainersEl = document.querySelector('[data-metric="medium"]');
    const lowContainersEl = document.querySelector('[data-metric="low"]');
    
    if (totalContainersEl) totalContainersEl.textContent = totalBins;
    if (criticalContainersEl) criticalContainersEl.textContent = fullBins;
    if (mediumContainersEl) mediumContainersEl.textContent = mediumBins;
    if (lowContainersEl) lowContainersEl.textContent = lowBins;
    
    console.log(`Contadores actualizados: Total=${totalBins}, Críticos=${fullBins}, Medios=${mediumBins}, Bajos=${lowBins}`);
}

// Optimize route using Traveling Salesman Problem (TSP) approach
function optimizeTSPRoute(containers) {
    if (containers.length <= 2) return containers;
    
    // Start with the most critical container
    const startContainer = containers[0];
    let remainingContainers = containers.slice(1);
    let optimizedRoute = [startContainer];
    
    // Greedy nearest neighbor algorithm with priority weighting
    while (remainingContainers.length > 0) {
        const currentContainer = optimizedRoute[optimizedRoute.length - 1];
        let nearestIndex = 0;
        let shortestDistance = Infinity;
        
        remainingContainers.forEach((container, index) => {
            const distance = calculateDistanceBetweenPoints(
                currentContainer.lat, currentContainer.lng,
                container.lat, container.lng
            );
            
            // Weight distance by priority (critical containers get preference)
            const priorityWeight = container.nivel_llenado > 70 ? 0.7 : 1.0;
            const weightedDistance = distance * priorityWeight;
            
            if (weightedDistance < shortestDistance) {
                shortestDistance = weightedDistance;
                nearestIndex = index;
            }
        });
        
        optimizedRoute.push(remainingContainers[nearestIndex]);
        remainingContainers.splice(nearestIndex, 1);
    }
    
    console.log('Ruta optimizada TSP:', optimizedRoute.map(c => `${c.id}(${c.nivel_llenado}%)`));
    return optimizedRoute;
}

// Calculate distance between two points
function calculateDistanceBetweenPoints(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Calculate optimized time considering stops and traffic
function calculateOptimizedTime(distance, containerCount) {
    const drivingTime = distance * 2; // 2 min per km (urban traffic)
    const stopTime = containerCount * 3; // 3 min per container stop
    const trafficBuffer = distance * 0.5; // 30% traffic buffer
    return Math.round(drivingTime + stopTime + trafficBuffer);
}

// Add direction markers along the route
function addRouteDirectionMarkers(route) {
    route.forEach((container, index) => {
        const directionIcon = L.divIcon({
            html: `<div style="background: #4a7c59; color: white; border-radius: 50%; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${index + 1}</div>`,
            iconSize: [25, 25],
            iconAnchor: [12.5, 12.5],
            className: 'route-direction-marker'
        });
        
        const directionMarker = L.marker([parseFloat(container.lat), parseFloat(container.lng)], { 
            icon: directionIcon,
            zIndexOffset: 1000
        }).addTo(map);
        
        // Add popup with route step info
        const stepInfo = `
            <div class="route-step-info">
                <h6><i class="bi bi-geo-alt"></i> Parada ${index + 1}</h6>
                <p class="mb-1"><strong>Contenedor:</strong> ${container.id}</p>
                <p class="mb-1"><strong>Prioridad:</strong> 
                    <span class="badge ${container.nivel_llenado > 70 ? 'bg-danger' : 'bg-warning'}">
                        ${container.nivel_llenado > 70 ? 'CRÍTICO' : 'MEDIO'} (${container.nivel_llenado}%)
                    </span>
                </p>
                <p class="mb-0"><small><strong>Tiempo estimado de parada:</strong> 3 min</small></p>
            </div>
        `;
        
        directionMarker.bindPopup(stepInfo);
        window.routeMarkers.push(directionMarker);
    });
}

// Generate step-by-step directions like Waze
function generateStepByStepDirections(route) {
    const directionsPanel = document.getElementById('directionsPanel');
    if (!directionsPanel) return;
    
    let directionsHTML = '<div class="directions-header"><h6><i class="bi bi-signpost-2"></i> Instrucciones de Ruta</h6></div>';
    
    route.forEach((container, index) => {
        const isFirst = index === 0;
        const isLast = index === route.length - 1;
        
        let instruction = '';
        let distance = '';
        
        if (isFirst) {
            // Calculate distance from user location to first container
            const distanceFromUser = userLocation ? 
                calculateDistanceBetweenPoints(
                    userLocation.lat, userLocation.lng,
                    container.lat, container.lng
                ) * 1000 : 0;
            
            const userDistanceText = distanceFromUser > 0 ? 
                ` (${distanceFromUser < 1000 ? distanceFromUser.toFixed(0) + 'm' : (distanceFromUser/1000).toFixed(1) + 'km'} desde tu ubicación)` : '';
            
            instruction = `<i class="bi bi-play-circle-fill text-success"></i> Dirigirse al contenedor ${container.id}${userDistanceText}`;
        } else {
            const prevContainer = route[index - 1];
            const stepDistance = calculateDistanceBetweenPoints(
                prevContainer.lat, prevContainer.lng,
                container.lat, container.lng
            );
            distance = `${(stepDistance * 1000).toFixed(0)}m`;
            
            // Simple direction calculation
            const bearing = calculateBearing(
                prevContainer.lat, prevContainer.lng,
                container.lat, container.lng
            );
            const direction = getDirectionFromBearing(bearing);
            
            instruction = `<i class="bi bi-arrow-up-circle"></i> Continuar ${direction} hacia contenedor ${container.id}`;
        }
        
        const priorityClass = container.nivel_llenado > 70 ? 'border-danger' : 'border-warning';
        const priorityText = container.nivel_llenado > 70 ? 'CRÍTICO' : 'MEDIO';
        
        directionsHTML += `
            <div class="direction-step ${priorityClass}">
                <div class="step-number">${index + 1}</div>
                <div class="step-content">
                    <div class="step-instruction">${instruction}</div>
                    ${distance ? `<div class="step-distance">${distance}</div>` : ''}
                    <div class="step-details">
                        <span class="badge ${container.nivel_llenado > 70 ? 'bg-danger' : 'bg-warning'}">${priorityText} ${container.nivel_llenado}%</span>
                        <small class="text-muted ms-2">Tiempo de parada: 3 min</small>
                    </div>
                </div>
            </div>
        `;
    });
    
    directionsHTML += `
        <div class="route-summary mt-3 p-3 bg-light rounded">
            <h6><i class="bi bi-check-circle text-success"></i> Resumen de Ruta</h6>
            <div class="row">
                <div class="col-6">
                    <small><strong>Total paradas:</strong> ${route.length}</small>
                </div>
                <div class="col-6">
                    <small><strong>Críticos:</strong> ${route.filter(c => c.nivel_llenado > 70).length}</small>
                </div>
            </div>
        </div>
        
        <div class="gps-navigation-controls mt-3 p-3 bg-gradient text-white rounded" style="background: linear-gradient(135deg, #4a7c59 0%, #3a5e47 100%);">
            <h6 class="mb-2"><i class="bi bi-geo-alt-fill me-2"></i>Navegación GPS en Tiempo Real</h6>
            <button class="btn btn-light w-100" onclick="startGPSNavigation()">
                <i class="bi bi-play-fill me-2"></i>Iniciar Navegación GPS
            </button>
            <small class="d-block mt-2 text-white-50">
                Permite acceso a tu ubicación para seguimiento automático tipo Waze
            </small>
        </div>
    `;
    
    directionsPanel.innerHTML = directionsHTML;
    
    // Add navigation progress area
    const progressHTML = `
        <div id="navigationProgress" class="mt-3">
            <!-- Real-time navigation progress will appear here -->
        </div>
    `;
    directionsPanel.innerHTML += progressHTML;
}

// Calculate bearing between two points
function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
}

// Get direction text from bearing
function getDirectionFromBearing(bearing) {
    const directions = [
        'norte', 'noreste', 'este', 'sureste',
        'sur', 'suroeste', 'oeste', 'noroeste'
    ];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
}

// ==============================================
// AUTOMATIC LOCATION DETECTION & TRACKING
// ==============================================

// Start automatic location detection when map loads
function startAutoLocationDetection() {
    if (!navigator.geolocation) {
        console.log('Geolocalización no disponible en este dispositivo');
        return;
    }
    
    showNotification('Detectando tu ubicación...', 'info');
    
    // Get initial position
    const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
    };
    
    navigator.geolocation.getCurrentPosition(
        onInitialLocationSuccess,
        onInitialLocationError,
        options
    );
}

// Handle successful initial location detection
function onInitialLocationSuccess(position) {
    const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date()
    };
    
    console.log(`Ubicación inicial detectada: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)} (±${location.accuracy}m)`);
    
    userLocation = location;
    updateUserMarker(location);
    
    // Center map on user location
    if (map && typeof map.setView === 'function') {
        map.setView([location.lat, location.lng], 15);
        showNotification(`Ubicación detectada con precisión de ±${location.accuracy.toFixed(0)}m`, 'success');
    }
    
    // Start continuous tracking
    startContinuousLocationTracking();
}

// Handle location detection errors
function onInitialLocationError(error) {
    let message = 'No se pudo detectar tu ubicación: ';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message += 'Permisos de ubicación denegados. Por favor permite el acceso para calcular rutas desde tu posición.';
            break;
        case error.POSITION_UNAVAILABLE:
            message += 'Ubicación no disponible. Verifica que el GPS esté activado.';
            break;
        case error.TIMEOUT:
            message += 'Tiempo de espera agotado. Intenta nuevamente.';
            break;
        default:
            message += 'Error desconocido.';
            break;
    }
    console.log(message);
    showNotification(message, 'warning');
}

// Start continuous location tracking for route updates
function startContinuousLocationTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
    }
    
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
    };
    
    watchId = navigator.geolocation.watchPosition(
        onLocationUpdate,
        onLocationError,
        options
    );
    
    console.log('Seguimiento continuo de ubicación iniciado');
}

// Get current location specifically for route calculation
function getCurrentLocationForRoute() {
    if (!navigator.geolocation) {
        showNotification('Tu dispositivo no soporta geolocalización', 'error');
        return;
    }
    
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
    };
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date()
            };
            
            updateUserMarker(userLocation);
            
            // Recalculate route with user location
            calculateRouteOpenStreetMap();
        },
        function(error) {
            showNotification('Error obteniendo ubicación. Usando ubicación por defecto.', 'warning');
            // Use Santiago center as fallback
            userLocation = { lat: -33.4489, lng: -70.6693 };
            calculateRouteOpenStreetMap();
        },
        options
    );
}

// ==============================================
// LOCATION-BASED ROUTE OPTIMIZATION
// ==============================================

// Optimize route starting from user's current location
function optimizeTSPRouteFromLocation(containers, startLocation) {
    if (containers.length === 0) return [];
    
    console.log(`Optimizando ruta desde ubicación: ${startLocation.lat.toFixed(6)}, ${startLocation.lng.toFixed(6)}`);
    
    // If only one container, return it
    if (containers.length === 1) return containers;
    
    // Find nearest container to start location
    let nearestIndex = 0;
    let shortestDistance = Infinity;
    
    containers.forEach((container, index) => {
        const distance = calculateDistanceBetweenPoints(
            startLocation.lat, startLocation.lng,
            container.lat, container.lng
        );
        
        // Weight by priority (critical containers get preference)
        const priorityWeight = container.nivel_llenado > 70 ? 0.8 : 1.0;
        const weightedDistance = distance * priorityWeight;
        
        if (weightedDistance < shortestDistance) {
            shortestDistance = weightedDistance;
            nearestIndex = index;
        }
    });
    
    // Start route with nearest container
    const startContainer = containers[nearestIndex];
    let remainingContainers = containers.filter((_, index) => index !== nearestIndex);
    let optimizedRoute = [startContainer];
    
    // Apply TSP algorithm for remaining containers
    while (remainingContainers.length > 0) {
        const currentContainer = optimizedRoute[optimizedRoute.length - 1];
        let nearestIndex = 0;
        let shortestDistance = Infinity;
        
        remainingContainers.forEach((container, index) => {
            const distance = calculateDistanceBetweenPoints(
                currentContainer.lat, currentContainer.lng,
                container.lat, container.lng
            );
            
            // Priority weighting
            const priorityWeight = container.nivel_llenado > 70 ? 0.7 : 1.0;
            const weightedDistance = distance * priorityWeight;
            
            if (weightedDistance < shortestDistance) {
                shortestDistance = weightedDistance;
                nearestIndex = index;
            }
        });
        
        optimizedRoute.push(remainingContainers[nearestIndex]);
        remainingContainers.splice(nearestIndex, 1);
    }
    
    const totalDistance = calculateTotalRouteDistance(startLocation, optimizedRoute);
    console.log(`Ruta optimizada desde ubicación actual: ${optimizedRoute.length} contenedores, ${totalDistance.toFixed(2)}km total`);
    
    return optimizedRoute;
}

// Calculate total route distance including start location
function calculateTotalRouteDistance(startLocation, route) {
    if (route.length === 0) return 0;
    
    let totalDistance = 0;
    
    // Distance from start location to first container
    totalDistance += calculateDistanceBetweenPoints(
        startLocation.lat, startLocation.lng,
        route[0].lat, route[0].lng
    );
    
    // Distance between containers
    for (let i = 1; i < route.length; i++) {
        totalDistance += calculateDistanceBetweenPoints(
            route[i-1].lat, route[i-1].lng,
            route[i].lat, route[i].lng
        );
    }
    
    return totalDistance;
}

// ==============================================
// REAL-TIME GPS NAVIGATION (WAZE-STYLE)
// ==============================================

// Start real-time GPS navigation
function startGPSNavigation() {
    if (!navigator.geolocation) {
        showNotification('Tu dispositivo no soporta geolocalización', 'error');
        return;
    }
    
    // Check for permission
    navigator.permissions.query({name: 'geolocation'}).then(function(result) {
        if (result.state === 'denied') {
            showNotification('Por favor permite el acceso a tu ubicación para navegación en tiempo real', 'warning');
            return;
        }
        
        isNavigating = true;
        showNotification('Iniciando navegación GPS en tiempo real...', 'info');
        
        // High accuracy GPS tracking
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 1000
        };
        
        // Start watching position
        watchId = navigator.geolocation.watchPosition(
            onLocationUpdate,
            onLocationError,
            options
        );
        
        // Update UI to show navigation mode
        updateNavigationUI(true);
        
    }).catch(function() {
        // Fallback for older browsers
        startGPSTracking();
    });
}

// Handle location updates
function onLocationUpdate(position) {
    const newLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date()
    };
    
    console.log(`GPS actualizado: ${newLocation.lat.toFixed(6)}, ${newLocation.lng.toFixed(6)} (±${newLocation.accuracy}m)`);
    
    userLocation = newLocation;
    updateUserMarker(newLocation);
    
    // Check if we have an active route
    if (isNavigating && activeRoute.length > 0) {
        checkRouteProgress(newLocation);
    }
}

// Handle location errors
function onLocationError(error) {
    let message = 'Error de GPS: ';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message += 'Acceso a ubicación denegado';
            break;
        case error.POSITION_UNAVAILABLE:
            message += 'Ubicación no disponible';
            break;
        case error.TIMEOUT:
            message += 'Tiempo de espera agotado';
            break;
        default:
            message += 'Error desconocido';
            break;
    }
    console.error(message, error);
    showNotification(message, 'warning');
}

// Update user marker on map
function updateUserMarker(location) {
    if (!map) return;
    
    // Remove existing user marker
    if (userMarker && typeof userMarker.remove === 'function') {
        userMarker.remove();
    }
    
    // Create user location marker (blue dot like Google Maps/Waze)
    const userIcon = L.divIcon({
        html: `
            <div style="position: relative;">
                <div style="
                    width: 20px; 
                    height: 20px; 
                    background: #4285F4; 
                    border: 3px solid white; 
                    border-radius: 50%; 
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    position: relative;
                    z-index: 1000;
                "></div>
                <div style="
                    width: 40px; 
                    height: 40px; 
                    background: rgba(66, 133, 244, 0.2); 
                    border-radius: 50%; 
                    position: absolute; 
                    top: -10px; 
                    left: -10px; 
                    z-index: 999;
                "></div>
            </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        className: 'user-location-marker'
    });
    
    userMarker = L.marker([location.lat, location.lng], { 
        icon: userIcon,
        zIndexOffset: 1000 
    }).addTo(map);
    
    userMarker.bindPopup(`
        <div class="user-location-popup">
            <h6><i class="bi bi-geo-alt-fill text-primary"></i> Tu Ubicación</h6>
            <p class="mb-1"><strong>Coordenadas:</strong> ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}</p>
            <p class="mb-1"><strong>Precisión:</strong> ±${location.accuracy.toFixed(0)}m</p>
            <p class="mb-0"><small><strong>Actualizado:</strong> ${location.timestamp.toLocaleTimeString()}</small></p>
        </div>
    `);
}

// Check progress along the route
function checkRouteProgress(userLocation) {
    if (!activeRoute || activeRoute.length === 0) return;
    
    const currentTarget = activeRoute[currentRouteStep];
    if (!currentTarget) return;
    
    // Calculate distance to current target
    const distance = calculateDistanceBetweenPoints(
        userLocation.lat, userLocation.lng,
        currentTarget.lat, currentTarget.lng
    ) * 1000; // Convert to meters
    
    console.log(`Distancia al contenedor ${currentTarget.id}: ${distance.toFixed(0)}m`);
    
    // Check if arrived at current container
    if (distance <= proximityThreshold) {
        onContainerReached(currentTarget);
    } else if (distance <= proximityThreshold * 3) {
        // Approaching notification
        showProximityNotification(currentTarget, distance);
    }
    
    // Update progress in navigation panel
    updateNavigationProgress(distance);
}

// Handle container reached
function onContainerReached(container) {
    showNotification(`¡Llegaste al contenedor ${container.id}! (${container.nivel_llenado}% lleno)`, 'success');
    
    // Play arrival sound (if supported)
    playNotificationSound();
    
    // Mark container as completed
    markContainerCompleted(container);
    
    // Move to next container
    currentRouteStep++;
    
    if (currentRouteStep >= activeRoute.length) {
        // Route completed
        onRouteCompleted();
    } else {
        // Continue to next container
        const nextContainer = activeRoute[currentRouteStep];
        showNotification(`Siguiente: Contenedor ${nextContainer.id} (${nextContainer.nivel_llenado}% lleno)`, 'info');
        updateNavigationInstructions();
    }
}

// Show proximity notification
function showProximityNotification(container, distance) {
    const distanceText = distance < 1000 ? `${distance.toFixed(0)}m` : `${(distance/1000).toFixed(1)}km`;
    
    // Only show every 25 meters to avoid spam
    if (Math.floor(distance / 25) !== Math.floor((distance - 1) / 25)) {
        showNotification(`Acercándose al contenedor ${container.id} - ${distanceText}`, 'info', 2000);
    }
}

// Update navigation progress in UI
function updateNavigationProgress(distanceToTarget) {
    const progressElement = document.getElementById('navigationProgress');
    if (!progressElement) return;
    
    const currentTarget = activeRoute[currentRouteStep];
    if (!currentTarget) return;
    
    const distanceText = distanceToTarget < 1000 ? `${distanceToTarget.toFixed(0)}m` : `${(distanceToTarget/1000).toFixed(1)}km`;
    
    progressElement.innerHTML = `
        <div class="navigation-progress">
            <div class="current-target">
                <h6><i class="bi bi-geo-alt text-primary"></i> Destino Actual</h6>
                <p class="mb-1"><strong>Contenedor:</strong> ${currentTarget.id}</p>
                <p class="mb-1"><strong>Distancia:</strong> ${distanceText}</p>
                <p class="mb-1"><strong>Prioridad:</strong> 
                    <span class="badge ${currentTarget.nivel_llenado > 70 ? 'bg-danger' : 'bg-warning'}">
                        ${currentTarget.nivel_llenado > 70 ? 'CRÍTICO' : 'MEDIO'} (${currentTarget.nivel_llenado}%)
                    </span>
                </p>
                <div class="progress mt-2">
                    <div class="progress-bar bg-success" style="width: ${Math.max(0, 100 - (distanceToTarget/200) * 100)}%"></div>
                </div>
            </div>
            <div class="route-progress mt-3">
                <small><strong>Progreso de ruta:</strong> ${currentRouteStep + 1} de ${activeRoute.length} contenedores</small>
                <div class="progress mt-1">
                    <div class="progress-bar bg-info" style="width: ${((currentRouteStep + 1) / activeRoute.length) * 100}%"></div>
                </div>
            </div>
        </div>
    `;
}

// Mark container as completed
function markContainerCompleted(container) {
    // Find and update the container marker
    window.leafletMarkers.forEach(marker => {
        const popup = marker.getPopup();
        if (popup && popup.getContent().includes(container.id)) {
            // Change marker to completed style
            const completedIcon = L.divIcon({
                html: `<div style="background-color: #28a745; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); position: relative;">
                         <i class="bi bi-check" style="color: white; font-size: 12px; position: absolute; top: 2px; left: 4px;"></i>
                       </div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
                className: 'completed-container-icon'
            });
            marker.setIcon(completedIcon);
        }
    });
    
    // Update route markers
    if (window.routeMarkers && window.routeMarkers[currentRouteStep]) {
        const routeMarker = window.routeMarkers[currentRouteStep];
        const completedRouteIcon = L.divIcon({
            html: `<div style="background: #28a745; color: white; border-radius: 50%; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">✓</div>`,
            iconSize: [25, 25],
            iconAnchor: [12.5, 12.5],
            className: 'completed-route-marker'
        });
        routeMarker.setIcon(completedRouteIcon);
    }
}

// Handle route completion
function onRouteCompleted() {
    isNavigating = false;
    stopGPSNavigation();
    
    showNotification('¡Ruta completada! Todos los contenedores han sido recolectados.', 'success');
    
    // Play completion sound
    playNotificationSound('completion');
    
    // Update UI
    updateNavigationUI(false);
    
    // Show completion summary
    showRouteCompletionSummary();
}

// Stop GPS navigation
function stopGPSNavigation() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    
    isNavigating = false;
    currentRouteStep = 0;
    activeRoute = [];
    
    // Update UI
    updateNavigationUI(false);
    
    showNotification('Navegación GPS detenida', 'info');
}

// Update navigation UI
function updateNavigationUI(navigating) {
    const routeButton = document.querySelector('button[onclick="calculateRoute()"]');
    if (routeButton) {
        if (navigating) {
            routeButton.innerHTML = '<i class="bi bi-stop-fill me-1"></i>Detener Navegación';
            routeButton.className = 'btn btn-danger btn-sm me-2';
            routeButton.setAttribute('onclick', 'stopGPSNavigation()');
        } else {
            routeButton.innerHTML = '<i class="bi bi-signpost-2-fill me-1"></i>Ruta Inteligente';
            routeButton.className = 'btn btn-success btn-sm me-2';
            routeButton.setAttribute('onclick', 'calculateRoute()');
        }
    }
}

// Play notification sound
function playNotificationSound(type = 'default') {
    try {
        // Create audio context for web audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        if (type === 'completion') {
            // Happy completion sound
            oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
            oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
            oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
        } else {
            // Default notification
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        }
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
        
    } catch (error) {
        console.log('No se pudo reproducir sonido de notificación');
    }
}

// Show route completion summary
function showRouteCompletionSummary() {
    const directionsPanel = document.getElementById('directionsPanel');
    if (!directionsPanel) return;
    
    const completionTime = new Date().toLocaleTimeString();
    
    directionsPanel.innerHTML = `
        <div class="completion-summary p-4 text-center">
            <div class="completion-icon mb-3">
                <i class="bi bi-check-circle-fill text-success" style="font-size: 4rem;"></i>
            </div>
            <h5 class="text-success mb-3">¡Ruta Completada!</h5>
            <div class="completion-stats">
                <div class="row">
                    <div class="col-6">
                        <div class="stat-item">
                            <strong>${activeRoute.length}</strong>
                            <br><small>Contenedores</small>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="stat-item">
                            <strong>${completionTime}</strong>
                            <br><small>Completado</small>
                        </div>
                    </div>
                </div>
            </div>
            <button class="btn btn-primary mt-3" onclick="calculateRoute()">
                <i class="bi bi-arrow-repeat me-2"></i>Nueva Ruta
            </button>
        </div>
    `;
}

// Add Waze-style numbered markers for route sequence
function addWazeStyleRouteMarkers(route) {
    if (!route || route.length === 0) return;
    
    route.forEach((container, index) => {
        const markerNumber = index + 1;
        
        // Determine priority color based on fill level
        const priorityColor = container.nivel_llenado > 70 ? '#dc3545' : 
                            container.nivel_llenado > 30 ? '#ffc107' : '#28a745';
        
        // Create Waze-style numbered marker (circular with shadow)
        const wazeIcon = L.divIcon({
            html: `
                <div style="position: relative;">
                    <!-- Shadow -->
                    <div style="
                        position: absolute;
                        top: 3px;
                        left: 3px;
                        width: 32px;
                        height: 32px;
                        background: rgba(0,0,0,0.2);
                        border-radius: 50%;
                        z-index: 1;
                    "></div>
                    <!-- Priority ring -->
                    <div style="
                        position: absolute;
                        top: -2px;
                        left: -2px;
                        width: 36px;
                        height: 36px;
                        border: 2px solid ${priorityColor};
                        border-radius: 50%;
                        z-index: 1;
                    "></div>
                    <!-- Main marker -->
                    <div style="
                        position: relative;
                        width: 32px;
                        height: 32px;
                        background: linear-gradient(135deg, #4285F4 0%, #1a73e8 100%);
                        border-radius: 50%;
                        border: 3px solid white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: 14px;
                        color: white;
                        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                        z-index: 2;
                    ">${markerNumber}</div>
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            className: 'waze-route-marker'
        });
        
        const marker = L.marker([container.lat, container.lng], { 
            icon: wazeIcon,
            zIndexOffset: 1000 + index
        }).addTo(map);
        
        // Waze-style popup with enhanced information
        marker.bindPopup(`
            <div class="waze-popup">
                <div style="background: linear-gradient(135deg, #4285F4, #1a73e8); color: white; padding: 10px; margin: -10px -10px 10px -10px; border-radius: 8px 8px 0 0;">
                    <h6 style="margin: 0; font-weight: bold;"><i class="bi bi-geo-alt-fill me-2"></i>Parada ${markerNumber}</h6>
                </div>
                <p class="mb-2"><strong>Contenedor:</strong> ${container.id}</p>
                <div class="level-indicator mb-2">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 20px; height: 20px; background: ${priorityColor}; border-radius: 3px;"></div>
                        <span><strong>${container.nivel_llenado}%</strong> lleno</span>
                    </div>
                </div>
                <div class="priority-badge mb-2">
                    <span class="badge ${container.nivel_llenado > 70 ? 'bg-danger' : container.nivel_llenado > 30 ? 'bg-warning' : 'bg-success'}">
                        ${container.nivel_llenado > 70 ? 'CRÍTICO' : container.nivel_llenado > 30 ? 'MEDIO' : 'BAJO'}
                    </span>
                </div>
                <small class="text-muted">Actualizado: ${container.timestamp || 'Ahora'}</small>
            </div>
        `);
        
        if (!window.routeMarkers) window.routeMarkers = [];
        window.routeMarkers.push(marker);
    });
}
