// -----------------------------------------------------------------------------
// Mini CRUD AJAX — Lado cliente (sin librerías)
// Archivo: /assets/js/main.js
// -----------------------------------------------------------------------------
/** URL absoluta o relativa del endpoint PHP (API del servidor) */
const URL_API_SERVIDOR = '/api.php';
/** Elementos de la interfaz que necesitamos manipular */
const nodoCuerpoTablaUsuarios = document.getElementById('tbody'); // <tbody> del listado
const nodoFilaEstadoVacio = document.getElementById('fila-estado-vacio'); // fila de “no hay datos”
const formularioAltaUsuario = document.getElementById('formCreate'); // <form> de alta
const nodoZonaMensajesEstado = document.getElementById('msg'); // <div> mensajes
const nodoBotonAgregarUsuario = document.getElementById('boton-agregar-usuario');
const nodoIndicadorCargando = document.getElementById('indicador-cargando');

// -----------------------------------------------------------------------------
// BLOQUE: Gestión de mensajes de estado (éxito / error)
// -----------------------------------------------------------------------------
function mostrarMensajeDeEstado(tipoEstado, textoMensaje) {
    nodoZonaMensajesEstado.className = tipoEstado; // .ok | .error | ''
    nodoZonaMensajesEstado.textContent = textoMensaje;
    if (tipoEstado !== '') {
        setTimeout(() => {
            nodoZonaMensajesEstado.className = '';
            nodoZonaMensajesEstado.textContent = '';
        }, 2000);
    }
}

// -----------------------------------------------------------------------------
// BLOQUE: Indicador de carga + bloqueo de botón
// -----------------------------------------------------------------------------
function activarEstadoCargando() {
    if (nodoBotonAgregarUsuario) nodoBotonAgregarUsuario.disabled = true;
    if (nodoIndicadorCargando) nodoIndicadorCargando.hidden = false;
}
function desactivarEstadoCargando() {
    if (nodoBotonAgregarUsuario) nodoBotonAgregarUsuario.disabled = false;
    if (nodoIndicadorCargando) nodoIndicadorCargando.hidden = true;
}

// -----------------------------------------------------------------------------
// BLOQUE: Sanitización de texto
// -----------------------------------------------------------------------------
function convertirATextoSeguro(entradaPosiblementePeligrosa) {
    return String(entradaPosiblementePeligrosa)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// -----------------------------------------------------------------------------
// BLOQUE: Renderizado del listado de usuarios
// -----------------------------------------------------------------------------
function renderizarTablaDeUsuarios(arrayUsuarios) {
    nodoCuerpoTablaUsuarios.innerHTML = '';
    // Mostrar u ocultar la fila de estado vacío según haya datos o no
    if (Array.isArray(arrayUsuarios) && arrayUsuarios.length > 0) {
        if (nodoFilaEstadoVacio) nodoFilaEstadoVacio.hidden = true;
    } else {
        if (nodoFilaEstadoVacio) nodoFilaEstadoVacio.hidden = false;
        return; // no hay filas que pintar
    }
    arrayUsuarios.forEach((usuario, posicionEnLista) => {
        const nodoFila = document.createElement('tr');
        nodoFila.innerHTML = `
            <td>${posicionEnLista + 1}</td>
            <td>${convertirATextoSeguro(usuario?.nombre ?? '')}</td>
            <td>${convertirATextoSeguro(usuario?.email ?? '')}</td>
            <td>
                <button
                    type="button"
                    data-posicion="${posicionEnLista}"
                    aria-label="Eliminar usuario ${posicionEnLista + 1}">
                    Eliminar
                </button>
            </td>
        `;
        nodoCuerpoTablaUsuarios.appendChild(nodoFila);
    });
}

// -----------------------------------------------------------------------------
// BLOQUE: Carga inicial y refresco del listado (GET list)
// -----------------------------------------------------------------------------
async function obtenerYMostrarListadoDeUsuarios() {
    try {
        const respuestaHttp = await fetch(`${URL_API_SERVIDOR}?action=list`);
        const cuerpoJson = await respuestaHttp.json();
        if (!cuerpoJson.ok) {
            throw new Error(cuerpoJson.error || 'No fue posible obtener el listado.');
        }
        renderizarTablaDeUsuarios(cuerpoJson.data);
    } catch (error) {
        mostrarMensajeDeEstado('error', error.message);
    }
}

// -----------------------------------------------------------------------------
// BLOQUE: Alta de usuario (POST create) sin recargar la página
// -----------------------------------------------------------------------------
formularioAltaUsuario?.addEventListener('submit', async (evento) => {
    // CORREGIDO: preventaDefault() a preventDefault()
    evento.preventDefault(); 
    const datosFormulario = new FormData(formularioAltaUsuario);
    const datosUsuarioNuevo = {
        nombre: String(datosFormulario.get('nombre') || '').trim(),
        email: String(datosFormulario.get('email') || '').trim(),
    };
    // Validación HTML5 rápida (por si el navegador no la lanza)
    if (!datosUsuarioNuevo.nombre || !datosUsuarioNuevo.email) {
        mostrarMensajeDeEstado('error', 'Los campos Nombre y Email son obligatorios.');
        return;
    }
    try {
        activarEstadoCargando();
        const respuestaHttp = await fetch(`${URL_API_SERVIDOR}?action=create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosUsuarioNuevo),
        });
        const cuerpoJson = await respuestaHttp.json();
        if (!cuerpoJson.ok) {
            throw new Error(cuerpoJson.error || 'No fue posible crear el usuario.');
        }
        renderizarTablaDeUsuarios(cuerpoJson.data);
        formularioAltaUsuario.reset();
        mostrarMensajeDeEstado('ok', 'Usuario agregado correctamente.');
    } catch (error) {
        mostrarMensajeDeEstado('error', error.message);
    } finally {
        desactivarEstadoCargando();
    }
});

// -----------------------------------------------------------------------------
// BLOQUE: Eliminación de usuario (POST delete) mediante delegación
// -----------------------------------------------------------------------------
nodoCuerpoTablaUsuarios?.addEventListener('click', async (evento) => {
    const nodoBotonEliminar = evento.target.closest('button[data-posicion]');
    if (!nodoBotonEliminar) return;
    const posicionUsuarioAEliminar = parseInt(nodoBotonEliminar.dataset.posicion, 10);
    if (!Number.isInteger(posicionUsuarioAEliminar)) return;
    if (!window.confirm('¿Deseas eliminar este usuario?')) return;
    try {
        const respuestaHttp = await fetch(`${URL_API_SERVIDOR}?action=delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: posicionUsuarioAEliminar }),
        });
        const cuerpoJson = await respuestaHttp.json();
        if (!cuerpoJson.ok) {
            throw new Error(cuerpoJson.error || 'No fue posible eliminar el usuario.');
        }
        renderizarTablaDeUsuarios(cuerpoJson.data);
        mostrarMensajeDeEstado('ok', 'Usuario eliminado correctamente.');
    } catch (error) {
        mostrarMensajeDeEstado('error', error.message);
    }
});
// -----------------------------------------------------------------------------
// BLOQUE: Inicialización de la pantalla
// -----------------------------------------------------------------------------
obtenerYMostrarListadoDeUsuarios();