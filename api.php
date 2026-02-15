<?php
/**
 * API для МебельПлан ERP (TimeWeb Cloud PostgreSQL)
 * Этот файл должен быть загружен на ваш хостинг.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// --- 1. ВАШИ ДАННЫЕ ПОДКЛЮЧЕНИЯ ---
$host = '9f0f9288b234fa7e684a9441.twc1.net'; 
$port = '5432';
$dbname = 'default_db';
$user = 'gen_user';
$pass = 'I;L6fAhV|SjsWE';

// Секретный токен для защиты (введите его в Настройках приложения)
$api_token = "MebelPlan_2025_Secure"; 

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

// Автоматическая загрузка SSL-сертификата TimeWeb
$cert_path = __DIR__ . '/root.crt';
if (!file_exists($cert_path)) {
    // Если сертификата нет, скачиваем его программно
    $cert_data = @file_get_contents('https://st.timeweb.com/cloud-static/ca.crt');
    if ($cert_data) {
        file_put_contents($cert_path, $cert_data);
    }
}

try {
    // Формируем DSN с обязательным SSL (verify-full как в psql)
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname;sslmode=verify-full;sslrootcert=$cert_path";
    
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 5 // Таймаут 5 секунд
    ]);

    // Создаем таблицу для хранения данных (одна строка с id=1 хранит всё состояние)
    $pdo->exec("CREATE TABLE IF NOT EXISTS woodplan_data (
        id INT PRIMARY KEY,
        content TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'Ошибка подключения к PostgreSQL: ' . $e->getMessage(),
        'hint' => 'Проверьте, разрешены ли внешние подключения в панели TimeWeb.'
    ]);
    exit;
}

// Проверка Bearer токена
$headers = getallheaders();
$auth_header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
if ($auth_header !== "Bearer $api_token") {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Ошибка авторизации: неверный токен API.']);
    exit;
}

$action = $_GET['action'] ?? '';

// --- ЛОГИКА ОБРАБОТКИ ---
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['action']) && $input['action'] === 'save') {
        $payload = json_encode($input['payload'], JSON_UNESCAPED_UNICODE);
        
        // UPSERT: вставляем или обновляем если id=1 уже есть
        $stmt = $pdo->prepare("
            INSERT INTO woodplan_data (id, content) 
            VALUES (1, :content) 
            ON CONFLICT (id) 
            DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP
        ");
        
        if ($stmt->execute(['content' => $payload])) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Ошибка сохранения в базу данных.']);
        }
    }
} else {
    if ($action === 'load') {
        $stmt = $pdo->query("SELECT content FROM woodplan_data WHERE id = 1");
        $row = $stmt->fetch();
        
        if ($row) {
            echo json_encode(['success' => true, 'payload' => json_decode($row['content'], true)]);
        } else {
            // Если база пуста, возвращаем начальную структуру
            echo json_encode(['success' => true, 'payload' => ['orders' => [], 'staff' => [], 'sessions' => [], 'shifts' => []]]);
        }
    } elseif ($action === 'test') {
        echo json_encode([
            'success' => true, 
            'message' => 'Связь с PostgreSQL TimeWeb установлена!',
            'db_name' => $dbname,
            'ssl' => file_exists($cert_path) ? 'Active' : 'Missing Cert'
        ]);
    }
}
