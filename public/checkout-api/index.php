<?php
/**
 * Same-origin proxy for checkout.denartny.com/api.
 * The checkout widget is hosted on denartny.com; checkout API CORS headers are
 * invalid (duplicate Access-Control-Allow-Origin), so the widget must call
 * this first-party path instead.
 */

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204);
    exit;
}

$uri = $_SERVER['REQUEST_URI'] ?? '';
$path = preg_replace('#^/checkout-api#', '', parse_url($uri, PHP_URL_PATH) ?? '');
$path = '/' . ltrim($path, '/');
$qs = $_SERVER['QUERY_STRING'] ?? '';
$target = 'https://checkout.denartny.com/api' . $path . ($qs !== '' ? '?' . $qs : '');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$body = file_get_contents('php://input');

$ch = curl_init($target);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 20);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

$fwd_headers = ['Accept: application/json'];
if (!empty($_SERVER['HTTP_USER_AGENT'])) {
    $fwd_headers[] = 'User-Agent: ' . $_SERVER['HTTP_USER_AGENT'];
}
if (!empty($_SERVER['CONTENT_TYPE'])) {
    $fwd_headers[] = 'Content-Type: ' . $_SERVER['CONTENT_TYPE'];
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $fwd_headers);

if ($method === 'POST' || $method === 'PUT' || $method === 'PATCH') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

header('Content-Type: ' . ($contentType ?: 'application/json'));
http_response_code($status ?: 502);
echo $response === false ? json_encode(['status' => 'error', 'detail' => 'Proxy failed']) : $response;
