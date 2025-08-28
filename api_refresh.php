<?php
// Simple refresh endpoint
header('Content-Type: application/json');
echo json_encode(['status' => 'ok', 'message' => 'Datos actualizados']);
?>