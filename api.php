<?php
/**
 * CLOUD API FOR MEBELPLAN ERP (v2.3)
 * PostgreSQL SSL verify-full
 */

// 1. Отключаем любой вывод ошибок в поток, чтобы не испортить JSON
error_reporting(0);
ini_set('display_errors', 0);

// 2. Устанавливаем заголовки сразу
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header('Content-Type: application/json; charset=utf-8');

// Обработка Preflight запроса
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Буферизация, чтобы очистить случайный мусор
ob_start();

// Конфигурация
$db_config = [
    'host'     => '9f0f9288b234fa7e684a9441.twc1.net',
    'port'     => '5432',
    'dbname'   => 'default_db',
    'user'     => 'gen_user',
    'pass'     => 'I;L6fAhV|SjsWE',
    'ssl_cert' => 'https://st.timeweb.com/cloud-static/ca.crt',
    'token'    => 'MebelPlan_2025_Secure'
];

function sendJson($data, $code = 200) {
    if (ob_get_length()) ob_clean(); 
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Проверка токена
function getRequestHeader($name) {
    $headers = array_change_key_case(getallheaders(), CASE_LOWER);
    return $headers[strtolower($name)] ?? null;
}

$auth = getRequestHeader('Authorization');
if ($auth !== "Bearer " . $db_config['token']) {
    sendJson(['success' => false, 'message' => 'Invalid API Token'], 403);
}

// Проверка расширения PDO
if (!extension_loaded('pdo_pgsql')) {
    sendJson(['success' => false, 'message' => 'PHP pdo_pgsql extension missing on server'], 500);
}

// Загрузка сертификата SSL
$cert_path = __DIR__ . '/root.crt';
if (!file_exists($cert_path)) {
    $cert_data = @file_get_contents($db_config['ssl_cert']);
    if ($cert_data) file_put_contents($cert_path, $cert_data);
}

try {
    $dsn = "pgsql:host={$db_config['host']};port={$db_config['port']};dbname={$db_config['dbname']};sslmode=verify-full;sslrootcert={$cert_path}";
    $pdo = new PDO($dsn, $db_config['user'], $db_config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5
    ]);

    $action = $_GET['action'] ?? '';

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if ($input && isset($input['action']) && $input['action'] === 'save') {
            $pdo->exec("CREATE TABLE IF NOT EXISTS woodplan_data (id INT PRIMARY KEY, content TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
            $payload = json_encode($input['payload'], JSON_UNESCAPED_UNICODE);
            $stmt = $pdo->prepare("INSERT INTO woodplan_data (id, content) VALUES (1, :content) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP");
            $stmt->execute(['content' => $payload]);
            sendJson(['success' => true]);
        }
    } else {
        if ($action === 'test') {
            $ver = $pdo->query("SELECT version()")->fetchColumn();
            sendJson(['success' => true, 'message' => 'Connected to Timeweb PostgreSQL', 'version' => $ver]);
        } elseif ($action === 'load') {
            $stmt = $pdo->query("SELECT content FROM woodplan_data WHERE id = 1");
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            sendJson(['success' => true, 'payload' => $row ? json_decode($row['content'], true) : null]);
        }
    }
} catch (Exception $e) {
    sendJson(['success' => false, 'message' => $e->getMessage()], 500);
}
