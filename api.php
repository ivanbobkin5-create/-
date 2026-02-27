<?php
/** 
 * TEST FILE FOR MEBELPLAN 
 * Если вы видите этот текст в браузере, значит PHP НЕ ИСПОЛНЯЕТСЯ.
 */
header("Access-Control-Allow-Origin: *");
header('Content-Type: application/json');

// Простейший тест без зависимостей
if (isset($_GET['ping'])) {
    echo json_encode(["success" => true, "message" => "PHP_WORKS"]);
    exit;
}

// Если дошли сюда, значит пробуем основную логику
$db_config = [
    'host'     => '9f0f9288b234fa7e684a9441.twc1.net',
    'port'     => '5432',
    'dbname'   => 'default_db',
    'user'     => 'gen_user',
    'pass'     => 'I;L6fAhV|SjsWE',
    'token'    => 'MebelPlan_2025_Secure'
];

$headers = array_change_key_case(getallheaders(), CASE_LOWER);
$auth = $headers['authorization'] ?? '';

if ($auth !== "Bearer " . $db_config['token']) {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "Token error"]);
    exit;
}

if (!extension_loaded('pdo_pgsql')) {
    echo json_encode(["success" => false, "message" => "MISSING_PDO_PGSQL"]);
    exit;
}

try {
    $dsn = "pgsql:host={$db_config['host']};port={$db_config['port']};dbname={$db_config['dbname']}";
    $pdo = new PDO($dsn, $db_config['user'], $db_config['pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    echo json_encode(["success" => true, "message" => "DB_CONNECTED"]);
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => "DB_ERROR: " . $e->getMessage()]);
}
