<?php
/**
 * ФИНАЛЬНЫЙ API ДЛЯ МЕБЕЛЬПЛАН ERP
 * СУБД: PostgreSQL (TimeWeb Cloud)
 */

// 1. Настройки CORS и заголовки
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// 2. Данные подключения из вашего запроса
$db_config = [
    'host'     => '9f0f9288b234fa7e684a9441.twc1.net',
    'port'     => '5432',
    'dbname'   => 'default_db',
    'user'     => 'gen_user',
    'pass'     => 'I;L6fAhV|SjsWE',
    'ssl_cert' => 'https://st.timeweb.com/cloud-static/ca.crt',
    'token'    => 'MebelPlan_2025_Secure' // Этот токен должен быть в настройках приложения
];

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

// 3. Работа с SSL сертификатом
$cert_file = __DIR__ . '/root.crt';
if (!file_exists($cert_file)) {
    $cert_content = @file_get_contents($db_config['ssl_cert']);
    if ($cert_content) {
        file_put_contents($cert_file, $cert_content);
    }
}

// 4. Подключение к базе данных
try {
    $dsn = "pgsql:host={$db_config['host']};port={$db_config['port']};dbname={$db_config['dbname']};sslmode=verify-full;sslrootcert={$cert_file}";
    
    $pdo = new PDO($dsn, $db_config['user'], $db_config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 10
    ]);

    // Инициализация таблицы
    $pdo->exec("CREATE TABLE IF NOT EXISTS woodplan_data (
        id INT PRIMARY KEY,
        content TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка БД: ' . $e->getMessage()]);
    exit;
}

// 5. Проверка авторизации
$headers = getallheaders();
$auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
if ($auth !== "Bearer " . $db_config['token']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Ошибка авторизации: неверный токен API.']);
    exit;
}

// 6. Обработка запросов
$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['action']) && $input['action'] === 'save') {
        $payload = json_encode($input['payload'], JSON_UNESCAPED_UNICODE);
        
        // UPSERT (INSERT or UPDATE)
        $stmt = $pdo->prepare("
            INSERT INTO woodplan_data (id, content) 
            VALUES (1, :content) 
            ON CONFLICT (id) 
            DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP
        ");
        
        if ($stmt->execute(['content' => $payload])) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Ошибка при сохранении данных']);
        }
    }
} else {
    // GET запросы
    if ($action === 'load') {
        $stmt = $pdo->query("SELECT content FROM woodplan_data WHERE id = 1");
        $row = $stmt->fetch();
        
        if ($row) {
            echo json_encode(['success' => true, 'payload' => json_decode($row['content'], true)]);
        } else {
            // Начальное состояние если данных нет
            echo json_encode(['success' => true, 'payload' => [
                'orders' => [], 
                'staff' => [], 
                'sessions' => [], 
                'shifts' => []
            ]]);
        }
    } elseif ($action === 'test') {
        echo json_encode([
            'success' => true, 
            'message' => 'Соединение с PostgreSQL TimeWeb Cloud активно!',
            'details' => [
                'db' => $db_config['dbname'],
                'ssl' => file_exists($cert_file) ? 'Verified' : 'Error loading cert',
                'server_time' => date('Y-m-d H:i:s')
            ]
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Неизвестное действие']);
    }
}
