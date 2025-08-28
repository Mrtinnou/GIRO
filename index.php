<?php
// Load data from FastAPI PostgreSQL backend
require_once 'api_data.php';

$bins_data = getContainerDataFromAPI();
$stats = getSystemStatistics();

// Handle system reset request
if (isset($_POST['action']) && $_POST['action'] === 'reset_data') {
    // This would require an API endpoint to reset data
    // For now, just reload the page
    header('Location: index.php');
    exit();
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GIRO® - Sistema Inteligente de Recolección de Residuos | Universidad Gabriela Mistral</title>
    
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" rel="stylesheet">
    <!-- Custom CSS -->
    <link href="assets/style.css" rel="stylesheet">
</head>
<body>
    <!-- Professional Navigation -->
    <nav class="navbar navbar-expand-lg navbar-dark fixed-top professional-nav">
        <div class="container">
            <a class="navbar-brand d-flex align-items-center" href="#">
                <div class="brand-logo me-3">
                    <i class="bi bi-recycle"></i>
                </div>
                <div class="brand-text">
                    <strong>GIRO<sup>®</sup></strong>
                    <small class="d-block text-light opacity-75">Gestión Inteligente de Residuos</small>
                </div>
            </a>
            
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto align-items-center">
                    <li class="nav-item me-3">
                        <div class="nav-status d-flex align-items-center">
                            <span class="status-indicator online me-2"></span>
                            <small class="text-light">Sistema Operativo</small>
                        </div>
                    </li>
                    <li class="nav-item me-3">
                        <span class="navbar-text text-light">
                            <i class="bi bi-geo-alt me-1"></i>
                            <span id="activeContainers"><?php echo count($bins_data); ?></span> Contenedores Monitoreados
                        </span>
                    </li>
                    <li class="nav-item">
                        <img src="https://i.postimg.cc/1tzXbbVC/Logo-UGM-alto-contraste-Blanco-01-tdz.png" 
                             alt="Universidad Gabriela Mistral" class="navbar-logo">
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <!-- Professional Header Section -->
    <div class="hero-section">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-md-8">
                    <h1 class="hero-title">Panel de Control GIRO<sup>®</sup></h1>
                    <p class="hero-subtitle">Gestión Inteligente de Residuos en Tiempo Real</p>
                </div>
                <div class="col-md-4 text-end">
                    <div class="control-panel d-flex gap-3 justify-content-end">
                        <button type="button" class="btn btn-success professional-btn" onclick="refreshData()">
                            <i class="bi bi-arrow-clockwise me-1"></i> Actualizar Datos
                        </button>
                        <button type="button" class="btn btn-primary professional-btn" onclick="calculateRoute()">
                            <i class="bi bi-route me-1"></i> Optimizar Ruta
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- KPI Dashboard Section -->
    <div class="container-fluid" style="margin-top: -30px; padding-top: 30px; background: linear-gradient(to bottom, rgba(74, 124, 89, 0.05) 0%, rgba(248, 249, 250, 0.95) 50%, #f8f9fa 100%);">
        <div class="row">
            <div class="col-12">
                <div class="kpi-dashboard">
                    <div class="row justify-content-center">
                        <div class="col-lg-3 col-md-6">
                            <div class="kpi-card-modern success">
                                <div class="kpi-icon-modern">
                                    <i class="bi bi-check-circle"></i>
                                </div>
                                <div class="kpi-content-modern">
                                    <div class="kpi-number"><?php echo $stats['contenedores_bajos'] ?? 0; ?></div>
                                    <div class="kpi-text">
                                        <div class="kpi-label-main">CONTENEDORES</div>
                                        <div class="kpi-label-sub">ÓPTIMOS</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-lg-3 col-md-6">
                            <div class="kpi-card-modern warning">
                                <div class="kpi-icon-modern">
                                    <i class="bi bi-exclamation-triangle"></i>
                                </div>
                                <div class="kpi-content-modern">
                                    <div class="kpi-number"><?php echo $stats['contenedores_medios'] ?? 0; ?></div>
                                    <div class="kpi-text">
                                        <div class="kpi-label-main">EN MONITOREO</div>
                                        <div class="kpi-label-sub"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-lg-3 col-md-6">
                            <div class="kpi-card-modern danger">
                                <div class="kpi-icon-modern">
                                    <i class="bi bi-exclamation-octagon"></i>
                                </div>
                                <div class="kpi-content-modern">
                                    <div class="kpi-number"><?php echo $stats['contenedores_criticos'] ?? 0; ?></div>
                                    <div class="kpi-text">
                                        <div class="kpi-label-main">ESTADO CRÍTICO</div>
                                        <div class="kpi-label-sub"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-lg-3 col-md-6">
                            <div class="kpi-card-modern info">
                                <div class="kpi-icon-modern">
                                    <i class="bi bi-geo-alt"></i>
                                </div>
                                <div class="kpi-content-modern">
                                    <div class="kpi-number"><?php echo $stats['total_contenedores'] ?? 0; ?></div>
                                    <div class="kpi-text">
                                        <div class="kpi-label-main">TOTAL</div>
                                        <div class="kpi-label-sub">MONITOREADOS</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Main Dashboard Content -->
    <div class="container-fluid" style="background: #f8f9fa; padding-top: 30px;">
        <!-- Mapa y Panel de Navegación -->
        <div class="row mb-4">
            <!-- Mapa de Contenedores -->
            <div class="col-lg-6">
                <div class="map-card" style="height: 520px;">
                    <div class="card-header d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center">
                        <h6 class="mb-2 mb-sm-0"><i class="bi bi-geo-alt me-2"></i>Mapa de Contenedores</h6>
                        <div class="map-controls">
                            <button class="btn btn-success btn-sm me-2" onclick="calculateRoute()" title="Calcular Ruta Optimizada">
                                <i class="bi bi-signpost-2-fill me-1"></i>Ruta Inteligente
                            </button>
                            <button class="btn btn-outline-secondary btn-sm" onclick="refreshData()" title="Actualizar Datos">
                                <i class="bi bi-arrow-clockwise"></i>
                            </button>
                        </div>
                    </div>
                    <div class="card-body p-0">
                        <div id="map" class="map-display" style="height: 430px;"></div>
                    </div>
                    <div class="card-footer bg-light">
                        <div class="route-info d-flex flex-wrap gap-2 justify-content-center">
                            <span id="routeDistance" class="badge bg-success">-</span>
                            <span id="routeTime" class="badge bg-info">-</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Panel de Navegación estilo Waze -->
            <div class="col-lg-6">
                <div class="navigation-panel-card" style="height: 520px;">
                    <div class="card-header bg-gradient">
                        <h5 class="mb-0 text-white">
                            <i class="bi bi-signpost-2-fill me-2"></i>
                            Navegación Inteligente
                        </h5>
                        <small class="text-white-50">Ruta optimizada estilo Waze</small>
                    </div>
                    <div class="card-body p-0" style="height: 460px; overflow-y: auto;">
                        <div id="directionsPanel" class="p-3">
                            <div class="text-center text-muted py-5">
                                <i class="bi bi-signpost display-4 mb-3"></i>
                                <h6>Ruta no calculada</h6>
                                <p>Presiona "Ruta Inteligente" para generar la ruta optimizada</p>
                                <small class="text-muted">El sistema priorizará contenedores críticos (>70% llenos)</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Controls and Data Section -->
        <div class="row">
            <!-- Panel de Control -->
            <div class="col-lg-6 col-md-6 mb-4">
                <div class="control-panel-card h-100">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="bi bi-sliders me-2"></i>Panel de Control</h6>
                    </div>
                    <div class="card-body" style="padding: 25px;">
                        <div class="control-section">
                            <label class="control-label">Ordenamiento</label>
                            <div class="btn-group w-100" role="group">
                                <button class="btn btn-outline-success" onclick="sortBins('nivel_llenado')">
                                    <i class="bi bi-sort-numeric-down"></i> Por Nivel
                                </button>
                                <button class="btn btn-outline-info" onclick="sortBins('timestamp')">
                                    <i class="bi bi-clock"></i> Por Fecha
                                </button>
                            </div>
                        </div>
                        
                        <div class="control-section">
                            <label class="control-label">Estados del Sistema</label>
                            <div class="status-legend">
                                <div class="status-item">
                                    <span class="status-indicator bg-success"></span>
                                    <span>0-30% Óptimo</span>
                                </div>
                                <div class="status-item">
                                    <span class="status-indicator bg-warning"></span>
                                    <span>31-70% Monitoreo</span>
                                </div>
                                <div class="status-item">
                                    <span class="status-indicator bg-danger"></span>
                                    <span>71-100% Crítico</span>
                                </div>
                            </div>
                        </div>

                        <div class="control-section">
                            <label class="control-label">Configuración</label>
                            <div style="background: rgba(74, 124, 89, 0.02); padding: 15px; border-radius: 12px; border: 1px solid rgba(74, 124, 89, 0.08);">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" id="autoRefresh" onchange="toggleAutoRefresh()">
                                    <label class="form-check-label" for="autoRefresh" style="font-weight: 500; color: var(--giro-blue-dark);">
                                        <i class="bi bi-arrow-repeat me-2"></i>Actualización Automática
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div class="control-section">
                            <label class="control-label">Acciones del Sistema</label>
                            <form method="post" onsubmit="return confirm('¿Confirma el reinicio del sistema?')">
                                <input type="hidden" name="action" value="reset_data">
                                <button type="submit" class="btn btn-outline-danger w-100">
                                    <i class="bi bi-arrow-clockwise me-2"></i>Reiniciar Datos
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Lista de Contenedores -->
            <div class="col-lg-6 col-md-6 mb-4">
                <div class="data-table-card h-100">
                    <div class="card-header">
                        <h6 class="mb-0"><i class="bi bi-list-ul me-2"></i>Lista de Contenedores</h6>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-container">
                            <table class="table table-hover mb-0" id="binsTable">
                                <thead class="table-header">
                                    <tr>
                                        <th>Contenedor</th>
                                        <th>Nivel</th>
                                        <th>Estado</th>
                                        <th>Actualización</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php if (empty($bins_data)): ?>
                                    <tr>
                                        <td colspan="4" class="text-center empty-state py-5">
                                            <i class="bi bi-inbox display-4 text-muted d-block mb-2"></i>
                                            <p class="text-muted mb-1">No hay contenedores monitoreados</p>
                                            <small class="text-muted">Envía datos POST a receiver.php para comenzar</small>
                                        </td>
                                    </tr>
                                    <?php else: ?>
                                        <?php foreach ($bins_data as $bin): ?>
                                        <tr class="table-row">
                                            <td class="fw-semibold"><?php echo htmlspecialchars($bin['id']); ?></td>
                                            <td>
                                                <div class="level-display">
                                                    <div class="progress-mini">
                                                        <div class="progress-bar-mini <?php 
                                                            if ($bin['nivel_llenado'] <= 30) echo 'success';
                                                            elseif ($bin['nivel_llenado'] <= 70) echo 'warning';
                                                            else echo 'danger';
                                                        ?>" style="width: <?php echo $bin['nivel_llenado']; ?>%"></div>
                                                    </div>
                                                    <small><?php echo $bin['nivel_llenado']; ?>%</small>
                                                </div>
                                            </td>
                                            <td>
                                                <span class="badge <?php 
                                                    if ($bin['nivel_llenado'] <= 30) echo 'bg-success';
                                                    elseif ($bin['nivel_llenado'] <= 70) echo 'bg-warning';
                                                    else echo 'bg-danger';
                                                ?>">
                                                    <?php 
                                                        if ($bin['nivel_llenado'] <= 30) echo 'Bajo';
                                                        elseif ($bin['nivel_llenado'] <= 70) echo 'Medio';
                                                        else echo 'Alto';
                                                    ?>
                                                </span>
                                            </td>
                                            <td><small><?php echo date('H:i', strtotime($bin['timestamp'])); ?></small></td>
                                        </tr>
                                        <?php endforeach; ?>
                                    <?php endif; ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <footer class="footer bg-dark text-light py-4 mt-5">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-md-4 text-center">
                    <div class="logo-section">
                        <div class="logo-container mb-2">
                            <img src="https://i.postimg.cc/1tzXbbVC/Logo-UGM-alto-contraste-Blanco-01-tdz.png" 
                                 alt="Universidad Gabriela Mistral" 
                                 class="university-logo img-fluid"
                                 style="max-height: 60px; width: auto;">
                        </div>
                        <h6 class="mb-0 text-center">Universidad Gabriela Mistral</h6>
                        <small class="text-muted text-center d-block">UGM</small>
                    </div>
                </div>
                <div class="col-md-4 text-center">
                    <div class="logo-section">
                        <div class="logo-container mb-2">
                            <img src="https://i.postimg.cc/G21n65g0/Whats-App-Image-2025-08-13-at-12-04-27-PM.jpg" 
                                 alt="Dirección de Investigación y Doctorados - DID" 
                                 class="did-logo img-fluid"
                                 style="max-height: 60px; width: auto;">
                        </div>
                        <h6 class="mb-0 text-center">Dirección de Investigación</h6>
                        <small class="text-muted text-center d-block">y Doctorados - DID</small>
                    </div>
                </div>
                <div class="col-md-4 text-end">
                    <div class="footer-info">
                        <h6><i class="bi bi-recycle me-2"></i>GIRO</h6>
                        <p class="mb-1"><small>Sistema Inteligente de Recolección de Residuos</small></p>
                        <p class="mb-0"><small class="text-muted">Desarrollado para optimizar la gestión de residuos urbanos</small></p>
                        <div class="mt-2">
                            <small class="text-muted">© <?php echo date('Y'); ?> UGM - DID</small>
                        </div>
                    </div>
                </div>
            </div>
            <hr class="my-3 opacity-25">
            <div class="row">
                <div class="col-12 text-center">
                    <small class="text-muted">
                        Este sistema fue desarrollado como parte de un proyecto de investigación de la 
                        <strong>Universidad Gabriela Mistral</strong> bajo la supervisión de la 
                        <strong>Dirección de Investigación y Doctorados (DID)</strong>.
                    </small>
                </div>
            </div>
        </div>
    </footer>

    <!-- Animate.css CDN for animations -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
    
    <!-- Bootstrap 5 JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <!-- Google Maps API with required libraries (Free tier available) -->
    <?php if (getenv('GOOGLE_MAPS_API_KEY')): ?>
    <script src="https://maps.googleapis.com/maps/api/js?key=<?php echo getenv('GOOGLE_MAPS_API_KEY'); ?>&callback=initMap&libraries=geometry,places&loading=async" async defer></script>
    <?php else: ?>
    <!-- Alternative: OpenStreetMap with Leaflet (100% Free) -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        // Initialize OpenStreetMap as fallback
        window.useOpenStreetMap = true;
    </script>
    <?php endif; ?>
    <!-- Initialize bins data for JavaScript -->
    <script>
        // Pass PHP data to JavaScript
        window.binsData = <?php echo json_encode($bins_data); ?>;
        console.log('Datos de contenedores cargados:', window.binsData);
    </script>
    
    <!-- Custom JS -->
    <script src="assets/app.js"></script>
    
    <script>
        // Pass PHP data to JavaScript
        window.binsData = <?php echo json_encode($bins_data); ?>;
        console.log('Datos de contenedores cargados:', window.binsData);
        
        // Initialize map when page loads
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM cargado, inicializando mapa...');
            if (window.useOpenStreetMap) {
                // Wait for Leaflet to load
                setTimeout(initOpenStreetMap, 100);
            }
        });
    </script>
</body>
</html>
