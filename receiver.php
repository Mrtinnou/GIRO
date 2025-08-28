<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Only POST method allowed']);
    exit();
}

// Get JSON input
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// If no JSON data, try to get from POST form data
if (!$data) {
    $data = $_POST;
}

// Validate required fields
$required_fields = ['id', 'lat', 'lng', 'nivel_llenado'];
$errors = [];

foreach ($required_fields as $field) {
    if (!isset($data[$field]) || $data[$field] === '') {
        $errors[] = "Field '$field' is required";
    }
}

// Validate data types and ranges
if (isset($data['lat']) && (!is_numeric($data['lat']) || $data['lat'] < -90 || $data['lat'] > 90)) {
    $errors[] = "Latitude must be a number between -90 and 90";
}

if (isset($data['lng']) && (!is_numeric($data['lng']) || $data['lng'] < -180 || $data['lng'] > 180)) {
    $errors[] = "Longitude must be a number between -180 and 180";
}

if (isset($data['nivel_llenado']) && (!is_numeric($data['nivel_llenado']) || $data['nivel_llenado'] < 0 || $data['nivel_llenado'] > 100)) {
    $errors[] = "Fill level must be a number between 0 and 100";
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['error' => 'Validation failed', 'details' => $errors]);
    exit();
}

// Add timestamp if not provided
if (!isset($data['timestamp'])) {
    $data['timestamp'] = date('Y-m-d H:i:s');
}

// Prepare data for storage
$bin_data = [
    'id' => (string)$data['id'],
    'lat' => (float)$data['lat'],
    'lng' => (float)$data['lng'],
    'nivel_llenado' => (int)$data['nivel_llenado'],
    'timestamp' => $data['timestamp']
];

// Load existing data
$file_path = 'datos.json';
$existing_data = [];

if (file_exists($file_path)) {
    $json_content = file_get_contents($file_path);
    if ($json_content !== false) {
        $existing_data = json_decode($json_content, true) ?: [];
    }
}

// Update or add new bin data
$updated = false;
foreach ($existing_data as $index => $existing_bin) {
    if ($existing_bin['id'] === $bin_data['id']) {
        $existing_data[$index] = $bin_data;
        $updated = true;
        break;
    }
}

if (!$updated) {
    $existing_data[] = $bin_data;
}

// Save data to JSON file
$json_result = json_encode($existing_data, JSON_PRETTY_PRINT);
if ($json_result === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to encode data']);
    exit();
}

$write_result = file_put_contents($file_path, $json_result, LOCK_EX);
if ($write_result === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save data to file']);
    exit();
}

// Return success response
http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => 'Data received and saved successfully',
    'data' => $bin_data
]);
?>
