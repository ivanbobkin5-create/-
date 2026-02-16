<?php
/**
 * СТАБИЛЬНЫЙ API ДЛЯ МЕБЕЛЬПЛАН ERP (v2.1)
 * PostgreSQL SSL verify-full
 */

// 1. Предварительная настройка вывода
error_reporting(0);
ini_set('display_errors', 0);

// Заголовки CORS должны быть отправлены ДО проверки токена и БД
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Стартуем буфер, чтобы перехватить любой случайный вывод
ob_start();

// 2. Конфигурация
$db_config = [
    'host'     => '9f0f9288b234fa7e684a9441.twc1.net',
    'port'     => '5432',
    'dbname'   => 'default_db',
    'user'     => 'gen_user',
    'pass'     => 'I;L6fAhV|SjsWE',
    'ssl_cert' => 'https://st.timeweb.com/cloud-static/ca.crt',
    'token'    => 'MebelPlan_2025_Secure'
];

// Вспомогательная функция для чистого выхода с JSON
function sendResponse($data, $code = 200) {
    if (ob_get_length()) ob_clean(); // Очищаем всё, что могло попасть в буфер
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// 3. Проверка авторизации
function getHeader($name) {
    $headers = array_change_key_case(getallheaders(), CASE_LOWER);
    return $headers[strtolower($name)] ?? $_SERVER['HTTP_' . strtoupper(str_replace('-', '_', $name))] ?? null;
}

$auth = getHeader('Authorization');
if ($auth !== "Bearer " . $db_config['token']) {
    sendResponse(['success' => false, 'message' => 'Ошибка 403: Неверный токен API.'], 403);
}

// 4. Подготовка драйвера и SSL
if (!extension_loaded('pdo_pgsql')) {
    sendResponse(['success' => false, 'message' => 'Критическая ошибка: Расширение pdo_pgsql не установлено на сервере.'], 500);
}

$cert_file = __DIR__ . '/root.crt';
if (!file_exists($cert_file)) {
    $cert_content = @file_get_contents($db_config['ssl_cert']);
    if (!$cert_content) {
        // Попытка через cURL если allow_url_fopen выключен
        $ch = curl_init($db_config['ssl_cert']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $cert_content = curl_exec($ch);
        curl_close($ch);
    }
    if ($cert_content) {
        file_put_contents($cert_file, $cert_content);
    }
}

// 5. Обработка действий
$action = $_GET['action'] ?? '';

try {
    // DSN для PostgreSQL с поддержкой verify-full
    $dsn = "pgsql:host={$db_config['host']};port={$db_config['port']};dbname={$db_config['dbname']};sslmode=verify-full;sslrootcert={$cert_file}";
    
    $pdo = new PDO($dsn, $db_config['user'], $db_config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['action']) && $input['action'] === 'save') {
            $pdo->exec("CREATE TABLE IF NOT EXISTS woodplan_data (id INT PRIMARY KEY, content TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
            $payload = json_encode($input['payload'], JSON_UNESCAPED_UNICODE);
            $stmt = $pdo->prepare("INSERT INTO woodplan_data (id, content) VALUES (1, :content) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP");
            $stmt->execute(['content' => $payload]);
            sendResponse(['success' => true]);
        }
    } else {
        if ($action === 'test') {
            $ver = $pdo->query("SELECT version()")->fetchColumn();
            sendResponse([
                'success' => true, 
                'message' => 'Соединение установлено (SSL verify-full)',
                'details' => ['version' => $ver, 'ssl' => 'active']
            ]);
        } elseif ($action === 'load') {
            $stmt = $pdo->query("SELECT content FROM woodplan_data WHERE id = 1");
            $row = $stmt->fetch();
            sendResponse([
                'success' => true, 
                'payload' => $row ? json_decode($row['content'], true) : null
            ]);
        }
    }
} catch (PDOException $e) {
    sendResponse(['success' => false, 'message' => 'Ошибка базы данных: ' . $e->getMessage()], 500);
} catch (Exception $e) {
    sendResponse(['success' => false, 'message' => 'Системная ошибка: ' . $e->getMessage()], 500);
}
