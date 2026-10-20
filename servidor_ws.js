
const { WebSocketServer, WebSocket } = require('ws');
const { createClient } = require('@supabase/supabase-js');

// CONEXION CON TU SUPABASE
const supabaseUrl = 'https://jhrpvknlxprkivnimyxh.supabase.co';
const supabaseKey = 'sb_publishable_LTdxPUTHYsaXAP0qjDtmRQ_S1tIxsWU';
const supabase = createClient(supabaseUrl, supabaseKey);

// SERVIDOR WEBSOCKET
const puerto = 4444;
const wsServer = new WebSocketServer({ port: puerto });

// Lista de clientes conectados
const clientes = [];

wsServer.on('connection', function(connection) {

    const cliente = {
        connection: connection,
        tipo: null,
        id: null,
        nombre: null
    };

    clientes.push(cliente);

    console.log('Cliente conectado. Ahora son:', clientes.length);

    // RECIBIR MENSAJES
    connection.on('message', async function(datos) {

        let msg;

        try {
            msg = JSON.parse(datos.toString());
        } catch (error) {
            console.log('Mensaje WebSocket no valido:', error.message);
            return;
        }

        switch (msg.operacion) {

            // IDENTIFICAR CLIENTE
            case 'identificar':

                cliente.tipo = msg.tipo;
                cliente.id = msg.id;
                cliente.nombre = msg.nombre;

                console.log(
                    'Se ha identificado:',
                    cliente.tipo,
                    cliente.id,
                    cliente.nombre
                );

                enviarAlCliente(cliente, {
                    operacion: 'identificado',
                    texto: 'Conectado como ' + cliente.tipo
                });

                break;

            // ENVIAR AVISO
            case 'aviso':

                const aviso = {
                    operacion: 'aviso',
                    origen: cliente.nombre,
                    texto: msg.texto,
                    fecha: new Date(),
                    color: msg.color,
                    tipoAviso: msg.tipoAviso,
                    idRecurso: msg.idRecurso
                };

                // Avisos rojos para sanitarios con reserva activa
                if (msg.destino === 'sanitarios_recurso') {

                    await enviarAvisoSanitariosConReservaActiva(
                        msg.idRecurso,
                        aviso
                    );

                } else {

                    // Avisos normales a gestores o sanitarios
                    enviarAviso(msg.destino, aviso);
                }

                break;
        }
    });

    // DESCONEXION
    connection.on('close', function() {

        console.log('Cliente desconectado');

        const indice = clientes.indexOf(cliente);

        if (indice !== -1) {
            clientes.splice(indice, 1);
        }

        // Notificar al resto
        for (const otro of clientes) {

            enviarAlCliente(otro, {
                operacion: 'salir',
                quien: cliente.nombre
            });
        }
    });

    connection.on('error', function(error) {
        console.log('Error en WebSocket:', error.message);
    });
});


// ENVIAR UN MENSAJE A UN CLIENTE

function enviarAlCliente(cliente, mensaje) {

    if (cliente.connection.readyState === WebSocket.OPEN) {
        cliente.connection.send(JSON.stringify(mensaje));
    }
}


// ENVIAR AVISO A GESTORES O SANITARIOS

function enviarAviso(destino, aviso) {

    for (const cliente of clientes) {

        if (cliente.tipo === destino) {
            enviarAlCliente(cliente, aviso);
        }
    }
}


// AVISO A SANITARIOS CON RESERVA ACTIVA
// Consulta SUPABASE en lugar de MYSQL

async function enviarAvisoSanitariosConReservaActiva(idRecurso, aviso) {

    if (!/^\d+$/.test(String(idRecurso))) {
        console.log('ID de recurso no valido');
        return;
    }

    // Buscar reservas iniciadas y que todavia no han finalizado
    const { data: reservasActivas, error } = await supabase
        .from('reservas')
        .select('sanitario')
        .eq('recurso', Number(idRecurso))
        .not('fecha_inicio', 'is', null)
        .is('fecha_fin', null);

    if (error) {
        console.log('Error al consultar reservas activas:', error);
        return;
    }

    // Obtener los sanitarios afectados
    const sanitariosAfectados = new Set(
        reservasActivas.map(r => String(r.sanitario))
    );

    // Enviar solo a los sanitarios con reserva activa
    for (const cliente of clientes) {

        if (
            cliente.tipo === 'sanitario' &&
            sanitariosAfectados.has(String(cliente.id))
        ) {
            enviarAlCliente(cliente, aviso);
        }
    }
}

console.log('Servidor de WebSocket iniciado en puerto:', puerto);
