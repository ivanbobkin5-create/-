<?php
/**
 * API ДЛЯ МЕБЕЛЬПЛАН ERP
 * Поддержка PostgreSQL (TimeWeb Cloud) + SSL verify-full
 */

// 1. Принудительные заголовки CORS (всегда в самом начале)
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

// 3. Получение токена авторизации (улучшенный метод)
function getAuthorizationHeader() {
    $headers = null;
    if (isset($_SERVER['Authorization'])) {
        $headers = trim($_SERVER["Authorization"]);
    } else if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER["HTTP_AUTHORIZATION"]);
    } else if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER["REDIRECT_HTTP_AUTHORIZATION"]);
    } else if (function_exists('getallheaders')) {
        $allHeaders = getallheaders();
        if (isset($allHeaders['Authorization'])) {
            $headers = trim($allHeaders['Authorization']);
        } elseif (isset($allHeaders['authorization'])) {
            $headers = trim($allHeaders['authorization']);
        }
    }
    return $headers;
}

$authHeader = getAuthorizationHeader();
if (!$authHeader || $authHeader !== "Bearer " . $db_config['token']) {
    http_response_code(403);
    echo json_encode([
        'success' => false, 
        'message' => 'Доступ запрещен: неверный или отсутствует токен API.',
        'debug' => [
            'received' => $authHeader ? 'Token hidden' : 'No header',
            'method' => $_SERVER['REQUEST_METHOD']
        ]
    ]);
    exit;
}

// 4. Подготовка SSL сертификата
$cert_file = __DIR__ . '/root.crt';
if (!file_exists($cert_file)) {
    $cert_content = @file_get_contents($db_config['ssl_cert']);
    if ($cert_content) {
        file_put_contents($cert_file, $cert_content);
        chmod($cert_file, 0644);
    }
}

// 5. Функция подключения к БД
function getDbConnection($config, $cert) {
    $dsn = "pgsql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};sslmode=verify-full;sslrootcert={$cert}";
    return new PDO($dsn, $config['user'], $config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5
    ]);
}

// 6. Обработка действий
$action = $_GET['action'] ?? '';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['action']) && $input['action'] === 'save') {
            $pdo = getDbConnection($db_config, $cert_file);
            
            // Инициализация таблицы при необходимости
            $pdo->exec("CREATE TABLE IF NOT EXISTS woodplan_data (id INT PRIMARY KEY, content TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
            
            $payload = json_encode($input['payload'], JSON_UNESCAPED_UNICODE);
            $stmt = $pdo->prepare("INSERT INTO woodplan_data (id, content) VALUES (1, :content) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP");
            $stmt->execute(['content' => $payload]);
            
            echo json_encode(['success' => true]);
        }
    } else {
        if ($action === 'test') {
            // Тест связи пытается подключиться к БД
            try {
                $pdo = getDbConnection($db_config, $cert_file);
                $stmt = $pdo->query("SELECT version()");
                $version = $stmt->fetchColumn();
                echo json_encode([
                    'success' => true, 
                    'message' => 'Соединение с БД активно (verify-full)!',
                    'version' => $version
                ]);
            } catch (Exception $e) {
                echo json_encode(['success' => false, 'message' => 'Ошибка БД: ' . $e->getMessage()]);
            }
        } elseif ($action === 'load') {
            $pdo = getDbConnection($db_config, $cert_file);
            $stmt = $pdo->query("SELECT content FROM woodplan_data WHERE id = 1");
            $row = $stmt->fetch();
            echo json_encode([
                'success' => true, 
                'payload' => $row ? json_decode($row['content'], true) : null
            ]);
        }
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
