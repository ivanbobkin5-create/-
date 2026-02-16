<?php
/**
 * CLOUD API FOR MEBELPLAN ERP (v2.5)
 * PostgreSQL SSL Connection Utility
 */

// 1. Настройка окружения
error_reporting(E_ALL);
ini_set('display_errors', 0); // Не выводим ошибки в тело ответа, чтобы не портить JSON

// Заголовки CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header('Content-Type: application/json; charset=utf-8');
header('X-MebelPlan-API: true'); // Флаг для dbService.ts

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

ob_start();

// 2. Конфигурация БД (TimeWeb Cloud PostgreSQL)
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

// 3. Проверка токена безопасности
$headers = array_change_key_case(getallheaders(), CASE_LOWER);
$auth = $headers['authorization'] ?? null;
if ($auth !== "Bearer " . $db_config['token']) {
    sendJson(['success' => false, 'message' => 'Unauthorized: Invalid API Token'], 403);
}

// 4. Подготовка SSL сертификата
// Используем временную директорию ОС, так как там всегда есть права на запись
$cert_path = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'tw_ca_root.crt';

if (!file_exists($cert_path) || filesize($cert_path) === 0) {
    $cert_data = @file_get_contents($db_config['ssl_cert']);
    if ($cert_data) {
        @file_put_contents($cert_path, $cert_data);
    } else {
        // Если не удалось скачать, пробуем создать пустой или использовать без проверки (не рекомендуется)
        @file_put_contents($cert_path, ""); 
    }
}

try {
    // 5. Подключение к PostgreSQL
    // sslmode=verify-full требует корректный sslrootcert
    $dsn = "pgsql:host={$db_config['host']};port={$db_config['port']};dbname={$db_config['dbname']};sslmode=verify-full;sslrootcert={$cert_path}";
    
    $pdo = new PDO($dsn, $db_config['user'], $db_config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    $action = $_GET['action'] ?? '';

    // Маршрутизация запросов
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if ($input && isset($input['action']) && $input['action'] === 'save') {
            // Создаем таблицу если нет
            $pdo->exec("CREATE TABLE IF NOT EXISTS woodplan_data (
                id INT PRIMARY KEY, 
                content TEXT, 
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )");
            
            $payload = json_encode($input['payload'], JSON_UNESCAPED_UNICODE);
            $stmt = $pdo->prepare("INSERT INTO woodplan_data (id, content) 
                                   VALUES (1, :content) 
                                   ON CONFLICT (id) DO UPDATE SET 
                                   content = EXCLUDED.content, 
                                   updated_at = CURRENT_TIMESTAMP");
            $stmt->execute(['content' => $payload]);
            sendJson(['success' => true, 'message' => 'Data saved successfully']);
        }
    } else {
        if ($action === 'test') {
            $ver = $pdo->query("SELECT version()")->fetchColumn();
            sendJson(['success' => true, 'message' => 'API Connected to Cloud DB', 'version' => $ver]);
        } elseif ($action === 'load') {
            $stmt = $pdo->query("SELECT content FROM woodplan_data WHERE id = 1");
            $row = $stmt->fetch();
            sendJson(['success' => true, 'payload' => $row ? json_decode($row['content'], true) : null]);
        } else {
            sendJson(['success' => false, 'message' => 'Unknown action'], 400);
        }
    }
} catch (PDOException $e) {
    sendJson(['success' => false, 'message' => 'Database Error: ' . $e->getMessage()], 500);
} catch (Exception $e) {
    sendJson(['success' => false, 'message' => 'System Error: ' . $e->getMessage()], 500);
}
