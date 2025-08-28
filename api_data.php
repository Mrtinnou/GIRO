<?php
// API Data Connector for GIRO® System
// Connects to FastAPI backend to get real-time container data

function getContainerDataFromAPI() {
    $api_url = 'http://localhost:8000/api/contenedores';
    
    try {
        $context = stream_context_create([
            'http' => [
                'timeout' => 5,
                'method' => 'GET',
                'header' => 'Content-Type: application/json'
            ]
        ]);
        
        $response = file_get_contents($api_url, false, $context);
        
        if ($response === false) {
            error_log("No se pudo conectar a la API FastAPI");
            return [];
        }
        
        $data = json_decode($response, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("Error decodificando JSON de la API: " . json_last_error_msg());
            return [];
        }
        
        return $data ?: [];
        
    } catch (Exception $e) {
        error_log("Error conectando a la API: " . $e->getMessage());
        return [];
    }
}

function getSystemStatistics() {
    $api_url = 'http://localhost:8000/api/estadisticas';
    
    try {
        $context = stream_context_create([
            'http' => [
                'timeout' => 5,
                'method' => 'GET',
                'header' => 'Content-Type: application/json'
            ]
        ]);
        
        $response = file_get_contents($api_url, false, $context);
        
        if ($response === false) {
            return [
                'total_contenedores' => 0,
                'contenedores_criticos' => 0,
                'contenedores_medios' => 0,
                'contenedores_bajos' => 0
            ];
        }
        
        $data = json_decode($response, true);
        return $data ?: [];
        
    } catch (Exception $e) {
        error_log("Error obteniendo estadísticas: " . $e->getMessage());
        return [
            'total_contenedores' => 0,
            'contenedores_criticos' => 0,
            'contenedores_medios' => 0,
            'contenedores_bajos' => 0
        ];
    }
}
?>