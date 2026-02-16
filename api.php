<?php
/**
 * CLOUD API FOR MEBELPLAN ERP (v2.7)
 * PostgreSQL SSL Connection Utility
 */

// 1. Подавляем вывод ошибок в тело ответа, но разрешаем логирование
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Заголовки CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Буферизация для чистого вывода JSON
ob_start();

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
    while (ob_get_level()) {
        ob_end_clean();
    }
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// 2. Проверка авторизации
$headers = array_change_key_case(getallheaders(), CASE_LOWER);
$auth = $headers['authorization'] ?? null;
if ($auth !== "Bearer " . $db_config['token']) {
    sendJson(['success' => false, 'message' => 'Unauthorized: Invalid Token'], 403);
}

// 3. Проверка наличия расширения PostgreSQL
if (!extension_loaded('pdo_pgsql')) {
    sendJson(['success' => false, 'message' => 'PHP Error: pdo_pgsql extension is not loaded on this server.'], 500);
}

// 4. Подготовка SSL сертификата
$cert_path = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'tw_ca_root.crt';
if (!file_exists($cert_path) || filesize($cert_path) === 0) {
    // Используем @, чтобы не выводить ошибку в поток, если скачивание запрещено
    $cert_data = @file_get_contents($db_config['ssl_cert']);
    if ($cert_data) {
        @file_put_contents($cert_path, $cert_data);
    }
}

try {
    // 5. Формирование DSN
    // Пытаемся использовать сертификат, если он есть
    $has_cert = file_exists($cert_path) && filesize($cert_path) > 0;
    $ssl_mode = $has_cert ? "verify-full" : "require";
    
    $dsn = "pgsql:host={$db_config['host']};port={$db_config['port']};dbname={$db_config['dbname']};sslmode={$ssl_mode}";
    if ($has_cert) {
        $dsn .= ";sslrootcert={$cert_path}";
    }
    
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
            sendJson(['success' => true, 'message' => 'Данные сохранены в Облако']);
        }
    } else {
        if ($action === 'test') {
            sendJson([
                'success' => true, 
                'message' => 'API работает. База подключена.',
                'debug' => [
                    'ssl_mode' => $ssl_mode,
                    'cert_found' => $has_cert,
                    'php_version' => PHP_VERSION
                ]
            ]);
        } elseif ($action === 'load') {
            $stmt = $pdo->query("SELECT content FROM woodplan_data WHERE id = 1");
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            sendJson(['success' => true, 'payload' => $row ? json_decode($row['content'], true) : null]);
        } else {
            sendJson(['success' => false, 'message' => 'Action not found'], 404);
        }
    }
} catch (PDOException $e) {
    sendJson(['success' => false, 'message' => 'Ошибка БД: ' . $e->getMessage()], 500);
} catch (Exception $e) {
    sendJson(['success' => false, 'message' => 'Системная ошибка: ' . $e->getMessage()], 500);
}