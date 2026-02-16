<?php
/**
 * СТАБИЛЬНЫЙ API ДЛЯ МЕБЕЛЬПЛАН ERP
 * Поддержка PostgreSQL (TimeWeb Cloud) + SSL verify-full
 */

// Отключаем вывод любых ошибок PHP в поток вывода (чтобы не портить JSON)
error_reporting(0);
ini_set('display_errors', 0);

// Очищаем буфер, если там что-то было
if (ob_get_length()) ob_clean();
ob_start();

// 1. Заголовки CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header('Content-Type: application/json; charset=utf-8');

// Обработка Preflight (OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

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

// 3. Функция получения заголовков
function getAuthHeader() {
    $headers = array_change_key_case(getallheaders(), CASE_LOWER);
    if (isset($headers['authorization'])) return trim($headers['authorization']);
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) return trim($_SERVER['HTTP_AUTHORIZATION']);
    if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) return trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    return null;
}

// 4. Проверка токена
$auth = getAuthHeader();
if ($auth !== "Bearer " . $db_config['token']) {
    http_response_code(403);
    echo json_encode([
        'success' => false, 
        'message' => 'Ошибка 403: Токен не совпадает или отсутствует.',
        'received_debug' => $auth ? 'Present' : 'Absent'
    ]);
    ob_end_flush();
    exit;
}

// 5. Подготовка SSL сертификата
$cert_file = __DIR__ . '/root.crt';
if (!file_exists($cert_file)) {
    // Используем альтернативный метод, если file_get_contents заблокирован
    $ch = curl_init($db_config['ssl_cert']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    $cert_content = curl_exec($ch);
    curl_close($ch);
    
    if ($cert_content) {
        file_put_contents($cert_file, $cert_content);
    }
}

// 6. Обработка действий
$action = $_GET['action'] ?? '';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['action']) && $input['action'] === 'save') {
            $dsn = "pgsql:host={$db_config['host']};port={$db_config['port']};dbname={$db_config['dbname']};sslmode=verify-full;sslrootcert={$cert_file}";
            $pdo = new PDO($dsn, $db_config['user'], $db_config['pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 5
            ]);
            
            $pdo->exec("CREATE TABLE IF NOT EXISTS woodplan_data (id INT PRIMARY KEY, content TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
            
            $payload = json_encode($input['payload'], JSON_UNESCAPED_UNICODE);
            $stmt = $pdo->prepare("INSERT INTO woodplan_data (id, content) VALUES (1, :content) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP");
            $stmt->execute(['content' => $payload]);
            
            echo json_encode(['success' => true]);
        }
    } else {
        if ($action === 'test') {
            // Тестовое подключение
            $dsn = "pgsql:host={$db_config['host']};port={$db_config['port']};dbname={$db_config['dbname']};sslmode=verify-full;sslrootcert={$cert_file}";
            $pdo = new PDO($dsn, $db_config['user'], $db_config['pass'], [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 3
            ]);
            $ver = $pdo->query("SELECT version()")->fetchColumn();
            echo json_encode([
                'success' => true, 
                'message' => 'Связь с PostgreSQL TimeWeb Cloud (verify-full) установлена!',
                'db_version' => $ver
            ]);
        } elseif ($action === 'load') {
            $dsn = "pgsql:host={$db_config['host']};port={$db_config['port']};dbname={$db_config['dbname']};sslmode=verify-full;sslrootcert={$cert_file}";
            $pdo = new PDO($dsn, $db_config['user'], $db_config['pass'], [PDO::ATTR_TIMEOUT => 5]);
            $stmt = $pdo->query("SELECT content FROM woodplan_data WHERE id = 1");
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode([
                'success' => true, 
                'payload' => $row ? json_decode($row['content'], true) : null
            ]);
        }
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Системная ошибка: ' . $e->getMessage()]);
}

ob_end_flush();
