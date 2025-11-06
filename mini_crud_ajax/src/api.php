<?php

declare(strict_types=1);
/**
 * API del Mini-CRUD
 * Acciones admitidas: list | create | delete
 * Persistencia: archivo JSON (data.json) en el mismo directorio.
 * ...
 */
// 1) Todas las respuestas serán JSON UTF-8
header('Content-Type: application/json; charset=utf-8');

// --- FUNCIONES DE RESPUESTA HOMOGÉNEA ---

/**
 * Envía una respuesta de éxito con envoltura homogénea.
 */
function responder_json_exito(mixed $contenidoDatos = [], int $codigoHttp = 200): void
{
    http_response_code($codigoHttp);
    echo json_encode(
        ['ok' => true, 'data' => $contenidoDatos],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}
/**
 * Envía una respuesta de error con envoltura homogénea.
 */
function responder_json_error(string $mensajeError, int $codigoHttp = 400): void
{
    http_response_code($codigoHttp);
    echo json_encode(
        ['ok' => false, 'error' => $mensajeError],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

// --- FUNCIÓN AUXILIAR DE VALIDACIÓN ---

/**
 * Comprueba si ya existe un usuario con el email dado (comparación exacta).
 */
function existeEmailDuplicado(array $usuarios, string $emailNormalizado): bool {
    foreach ($usuarios as $u) {
        // Comprobamos que la clave existe y el valor es string antes de comparar
        if (isset($u['email']) && is_string($u['email']) && $u['email'] === $emailNormalizado) {
            return true;
        }
    }
    return false;
}

// 2) Ruta al archivo de persistencia y carga de datos
$rutaArchivoDatosJson = __DIR__ . '/data.json';
// 2.1) Si no existe, lo creamos con un array JSON vacío ([])
if (!file_exists($rutaArchivoDatosJson)) {
    file_put_contents($rutaArchivoDatosJson, json_encode([]) . "\n");
}
// 2.2) Cargar su contenido como array asociativo de PHP
$listaUsuarios = json_decode((string) file_get_contents($rutaArchivoDatosJson), true);
// 2.3) Si por cualquier motivo no es un array, lo normalizamos a []
if (!is_array($listaUsuarios)) {
    $listaUsuarios = [];
}

// 3) Método HTTP y acción
$metodoHttpRecibido = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$accionSolicitada = $_GET['action'] ?? $_POST['action'] ?? 'list';

// 4) LISTAR usuarios: GET /api.php?action=list
if ($metodoHttpRecibido === 'GET' && $accionSolicitada === 'list') {
    responder_json_exito($listaUsuarios); // 200 OK
}

// 5) CREAR usuario: POST /api.php?action=create
// Body JSON esperado: { "nombre": "...", "email": "..." }
if ($metodoHttpRecibido === 'POST' && $accionSolicitada === 'create') {
    $cuerpoBruto = (string) file_get_contents('php://input');
    $datosDecodificados = $cuerpoBruto !== '' ? (json_decode($cuerpoBruto, true) ?? []) : [];
    // Extraemos datos y normalizamos
    $nombreUsuarioNuevo = trim((string) ($datosDecodificados['nombre'] ?? $_POST['nombre'] ?? ''));
    $correoUsuarioNuevo = trim((string) ($datosDecodificados['email'] ?? $_POST['email'] ?? ''));
    $correoUsuarioNormalizado = mb_strtolower($correoUsuarioNuevo);
    
    // Validación mínima en servidor
    if ($nombreUsuarioNuevo === '' || $correoUsuarioNuevo === '') {
        responder_json_error('Los campos "nombre" y "email" son obligatorios.', 422);
    }
    if (!filter_var($correoUsuarioNuevo, FILTER_VALIDATE_EMAIL)) {
        responder_json_error('El campo "email" no tiene un formato válido.', 422);
    }
    // Límites razonables para este ejercicio
    if (mb_strlen($nombreUsuarioNuevo) > 60) {
        responder_json_error('El campo "nombre" excede los 60 caracteres.', 422);
    }
    if (mb_strlen($correoUsuarioNuevo) > 120) {
        responder_json_error('El campo "email" excede los 120 caracteres.', 422);
    }
    
    // Evitar duplicados por email
    if (existeEmailDuplicado($listaUsuarios, $correoUsuarioNormalizado)) {
        responder_json_error('Ya existe un usuario con ese email.', 409);
    }
    
    // Agregamos y persistimos (guardamos el email normalizado)
    $listaUsuarios[] = [
        'nombre' => $nombreUsuarioNuevo,
        'email' => $correoUsuarioNormalizado, // Guardamos el email normalizado
    ];
    
    file_put_contents(
        $rutaArchivoDatosJson,
        json_encode($listaUsuarios, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n"
    );
    responder_json_exito($listaUsuarios, 201);
}

// 6) ELIMINAR usuario: POST /api.php?action=delete
// Body JSON esperado: { "index": 0 }
if ($metodoHttpRecibido === 'POST' && $accionSolicitada === 'delete') {
    $cuerpoBruto = (string) file_get_contents('php://input');
    $datosDecodificados = $cuerpoBruto !== '' ? (json_decode($cuerpoBruto, true) ?? []) : [];
    
    // Extraer el índice a eliminar (prioridad JSON body)
    $indiceAEliminar = $datosDecodificados['index'] ?? $_POST['index'] ?? null;

    // 6.1) Validación de índice
    if (!is_numeric($indiceAEliminar) || $indiceAEliminar < 0) {
        responder_json_error('El índice de usuario a eliminar no es válido.', 422);
    }
    
    $indiceAEliminar = (int) $indiceAEliminar;
    
    // 6.2) Validación de que el índice existe en el array
    if (!isset($listaUsuarios[$indiceAEliminar])) {
        responder_json_error("El usuario en la posición {$indiceAEliminar} no existe.", 404);
    }

    // 6.3) Eliminar del array en memoria
    array_splice($listaUsuarios, $indiceAEliminar, 1);
    
    // 6.4) Reindexar el array (necesario tras array_splice si usamos índices numéricos)
    $listaUsuarios = array_values($listaUsuarios);

    // 6.5) Persistir en disco
    file_put_contents(
        $rutaArchivoDatosJson,
        json_encode($listaUsuarios, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n"
    );

    // 6.6) Devolver lista completa con 200 OK
    responder_json_exito($listaUsuarios, 200);
}

// 7) Manejo de acción no implementada o método incorrecto
// Esto asegura que cualquier otra combinación reciba un error 405 Method Not Allowed
if ($accionSolicitada !== 'list' && $accionSolicitada !== 'create' && $accionSolicitada !== 'delete') {
    responder_json_error("Acción '{$accionSolicitada}' no implementada.", 405);
} else {
    responder_json_error("Método HTTP '{$metodoHttpRecibido}' no permitido para la acción '{$accionSolicitada}'.", 405);
}