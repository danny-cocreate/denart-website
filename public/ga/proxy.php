<?php
/**
 * GA4 first-party proxy
 * Forwards /ga/gtag/js  → https://www.googletagmanager.com/gtag/js
 * Forwards /ga/g/collect → https://www.google-analytics.com/g/collect
 *
 * Bypasses Instagram in-app browser blocking of Google's analytics domains
 * by routing requests through denartny.com (first-party).
 */

$uri = $_SERVER['REQUEST_URI'];
$qs  = $_SERVER['QUERY_STRING'] ?? '';

// ── /ga/g/collect — GA4 measurement data ──────────────────────────────────
if (strpos($uri, '/ga/g/collect') !== false) {
    $target = 'https://www.google-analytics.com/g/collect' . ($qs !== '' ? '?' . $qs : '');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $body   = file_get_contents('php://input');

    $ch = curl_init($target);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }

    $fwd_headers = [];
    if (!empty($_SERVER['HTTP_USER_AGENT'])) {
        $fwd_headers[] = 'User-Agent: ' . $_SERVER['HTTP_USER_AGENT'];
    }
    if (!empty($_SERVER['HTTP_REFERER'])) {
        $fwd_headers[] = 'Referer: ' . $_SERVER['HTTP_REFERER'];
    }
    if (!empty($_SERVER['CONTENT_TYPE'])) {
        $fwd_headers[] = 'Content-Type: ' . $_SERVER['CONTENT_TYPE'];
    }
    if ($fwd_headers) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $fwd_headers);
    }

    curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    header('Access-Control-Allow-Origin: *');
    http_response_code($status ?: 204);
    exit;
}

// ── /ga/gtag/js — GA4 SDK script ──────────────────────────────────────────
if (strpos($uri, '/ga/gtag/js') !== false) {
    $target = 'https://www.googletagmanager.com/gtag/js' . ($qs !== '' ? '?' . $qs : '');

    $ch = curl_init($target);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    if (!empty($_SERVER['HTTP_USER_AGENT'])) {
        curl_setopt($ch, CURLOPT_USERAGENT, $_SERVER['HTTP_USER_AGENT']);
    }

    $script = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    header('Content-Type: application/javascript; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    http_response_code($status ?: 200);
    echo $script;
    exit;
}

http_response_code(404);
