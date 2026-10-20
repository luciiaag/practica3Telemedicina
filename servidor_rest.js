
const express = require('express');
const jwt = require('jwt-simple');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Conexion con Supabase mediante variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clave = process.env.JWT_SECRET;

if (!supabaseUrl || !supabaseKey || !clave) {
    console.error('Faltan variables de entorno de Supabase o JWT');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

// Mostrar la aplicacion directamente desde la URL de Render
app.use(express.static('cliente_rest'));
app.use(express.json());

// Funcion para mostrar errores de la base de datos
function errorBD(res, error, mensaje) {
    console.error(mensaje, error);
    return res.status(500).json(mensaje);
}

// Comprobar que un identificador sea valido
function idValido(valor) {
    return /^\d+$/.test(String(valor)) && Number(valor) > 0;
}


// INICIO DE SESION

app.post('/api/gestores/login', async function(req, res) {

    const { login, password } = req.body || {};

    if (typeof login !== 'string' || typeof password !== 'string') {
        return res.status(403).json('Autenticacion incorrecta');
    }

    // Buscar gestor en Supabase
    const { data: gestores, error } = await supabase
        .from('gestores')
        .select('id')
        .eq('usuario', login)
        .eq('password', password)
        .limit(1);

    if (error) {
        return errorBD(res, error, 'Error al realizar la consulta');
    }

    if (gestores.length === 0) {
        return res.status(403).json('Autenticacion incorrecta');
    }

    const encontrado = gestores[0];

    // Crear token JWT
    const contenido = {
        usuario: encontrado.id,
        expira: Date.now() + 60 * 60 * 1000
    };

    const token = jwt.encode(contenido, clave);

    return res.status(200).json({
        id: encontrado.id,
        token: token
    });
});


// REGISTRAR GESTOR

app.post('/api/gestores', async function(req, res) {

    const gest = req.body || {};

    if (!gest.nombre || !gest.apellidos || !gest.usuario || !gest.password) {
        return res.status(404).json('No puede haber campos vacíos');
    }

    // Comprobar si existe el usuario
    const { data: gestores, error: errorBusqueda } = await supabase
        .from('gestores')
        .select('id')
        .eq('usuario', gest.usuario)
        .limit(1);

    if (errorBusqueda) {
        return errorBD(res, errorBusqueda, 'Error al realizar la consulta');
    }

    if (gestores.length > 0) {
        return res.status(409).json('Usuario ya existe');
    }

    // Insertar gestor
    const { data: insertado, error } = await supabase
        .from('gestores')
        .insert({
            nombre: gest.nombre,
            apellidos: gest.apellidos,
            usuario: gest.usuario,
            password: gest.password
        })
        .select('id, usuario')
        .single();

    if (error) {
        if (error.code === '23505') {
            return res.status(409).json('Usuario ya existe');
        }

        return errorBD(res, error, 'Error al realizar la insercion');
    }

    return res.status(201).json({
        id: insertado.id,
        usuario: insertado.usuario,
        password: gest.password
    });
});


// COMPROBAR TOKEN JWT

app.use('/api', function(req, res, next) {

    const autorizacion = req.headers.authorization;

    if (!autorizacion || !autorizacion.startsWith('Bearer ')) {
        return res.status(401).json('No se ha encontrado token');
    }

    let contenidoToken;

    try {
        contenidoToken = jwt.decode(autorizacion.substring(7), clave);
    }
    catch (error) {
        return res.status(401).json('El token es incorrecto');
    }

    if (!contenidoToken || !contenidoToken.usuario || !contenidoToken.expira) {
        return res.status(401).json('El formato del token no es adecuado');
    }

    if (contenidoToken.expira < Date.now()) {
        return res.status(401).json('El token ha expirado');
    }

    req.gestorId = contenidoToken.usuario;

    next();
});


// OBTENER UBICACIONES

app.get('/api/ubicaciones', async function(req, res) {

    const { data, error } = await supabase
        .from('ubicaciones')
        .select('*')
        .order('id');

    if (error) {
        return errorBD(res, error, 'Error al realizar la consulta');
    }

    return res.status(200).json(data);
});


// OBTENER CATEGORIAS

app.get('/api/categorias', async function(req, res) {

    const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .order('id');

    if (error) {
        return errorBD(res, error, 'Error al realizar la consulta');
    }

    return res.status(200).json(data);
});


// OBTENER MODELOS

app.get('/api/modelos', async function(req, res) {

    const { data, error } = await supabase
        .from('modelos')
        .select('*')
        .order('id');

    if (error) {
        return errorBD(res, error, 'Error al realizar la consulta');
    }

    return res.status(200).json(data);
});


// EDITAR GESTOR

app.put('/api/gestores/:id', async function(req, res) {

    const id = req.params.id;
    const { nombre, apellidos, usuario, password } = req.body || {};

    if (!idValido(id)) {
        return res.status(404).json('El gestor no existe');
    }

    if (!nombre || !apellidos || !usuario || !password) {
        return res.status(404).json('No puede haber campos vacíos');
    }

    // Comprobar que el gestor existe
    const { data: gestor, error: errorGestor } = await supabase
        .from('gestores')
        .select('id')
        .eq('id', id)
        .maybeSingle();

    if (errorGestor) {
        return errorBD(res, errorGestor, 'Error al realizar el select');
    }

    if (!gestor) {
        return res.status(404).json('El gestor no existe');
    }

    // Comprobar usuario duplicado
    const { data: otros, error: errorUsuario } = await supabase
        .from('gestores')
        .select('id')
        .eq('usuario', usuario)
        .neq('id', id)
        .limit(1);

    if (errorUsuario) {
        return errorBD(res, errorUsuario, 'Error al realizar el select');
    }

    if (otros.length > 0) {
        return res.status(409).json('Usuario ya existe');
    }

    // Actualizar datos
    const { error } = await supabase
        .from('gestores')
        .update({
            nombre: nombre,
            apellidos: apellidos,
            usuario: usuario,
            password: password
        })
        .eq('id', id);

    if (error) {
        if (error.code === '23505') {
            return res.status(409).json('Usuario ya existe');
        }

        return errorBD(res, error, 'Error al realizar la actualizacion');
    }

    return res.status(200).json('Gestor actualizado correctamente');
});


// OBTENER DATOS DE UN GESTOR

app.get('/api/gestores/:id', async function(req, res) {

    if (!idValido(req.params.id)) {
        return res.status(404).json('El gestor no existe');
    }

    const { data, error } = await supabase
        .from('gestores')
        .select('id, nombre, apellidos, usuario')
        .eq('id', req.params.id)
        .maybeSingle();

    if (error) {
        return errorBD(res, error, 'Error al realizar la consulta');
    }

    if (!data) {
        return res.status(404).json('El gestor no existe');
    }

    return res.status(200).json(data);
});


// OBTENER DATOS DE UN SANITARIO

app.get('/api/sanitarios/:id', async function(req, res) {

    if (!idValido(req.params.id)) {
        return res.status(404).json('El sanitario no existe');
    }

    const { data, error } = await supabase
        .from('sanitarios')
        .select('id, nombre, apellidos, usuario')
        .eq('id', req.params.id)
        .maybeSingle();

    if (error) {
        return errorBD(res, error, 'Error al realizar el select');
    }

    if (!data) {
        return res.status(404).json('El sanitario no existe');
    }

    return res.status(200).json(data);
});


// BUSCAR RECURSOS CON FILTROS

app.get('/api/recursos', async function(req, res) {

    const { categoria, modelo, ubicacion, estado } = req.query;

    let consulta = supabase
        .from('recurso')
        .select('*')
        .order('id');

    // Filtro por modelo
    if (modelo !== undefined && modelo !== '') {
        consulta = consulta.eq('modelo', modelo);
    }

    // Filtro por ubicacion
    if (ubicacion !== undefined && ubicacion !== '') {
        consulta = consulta.eq('ubicacion', ubicacion);
    }

    // Filtro por estado
    if (estado !== undefined && estado !== '') {
        consulta = consulta.eq('estado', estado);
    }

    // Filtro por categoria
    if (categoria !== undefined && categoria !== '') {

        const { data: modelos, error: errorModelos } = await supabase
            .from('modelos')
            .select('id')
            .eq('categoria', categoria);

        if (errorModelos) {
            return errorBD(res, errorModelos, 'Error al realizar el select');
        }

        if (modelos.length === 0) {
            return res.status(200).json([]);
        }

        consulta = consulta.in('modelo', modelos.map(m => m.id));
    }

    const { data, error } = await consulta;

    if (error) {
        return errorBD(res, error, 'Error al realizar la consulta');
    }

    return res.status(200).json(data);
});


// OBTENER UN RECURSO

app.get('/api/recursos/:id', async function(req, res) {

    if (!idValido(req.params.id)) {
        return res.status(404).json('El recurso no existe');
    }

    const { data, error } = await supabase
        .from('recurso')
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();

    if (error) {
        return errorBD(res, error, 'Error al realizar la consulta');
    }

    if (!data) {
        return res.status(404).json('El recurso no existe');
    }

    return res.status(200).json(data);
});


// CREAR RECURSO

app.post('/api/recursos', async function(req, res) {

    const { modelo, ubicacion, numero_serie, estado } = req.body || {};

    if (!modelo || !ubicacion || !numero_serie || estado === undefined) {
        return res.status(404).json('No puede haber campos vacíos');
    }

    const { data, error } = await supabase
        .from('recurso')
        .insert({
            modelo: modelo,
            ubicacion: ubicacion,
            numero_serie: numero_serie,
            estado: estado
        })
        .select('id')
        .single();

    if (error) {
        return errorBD(res, error, 'Error al realizar la insercion');
    }

    return res.status(201).json(data.id);
});


// EDITAR RECURSO

app.put('/api/recursos/:id', async function(req, res) {

    if (!idValido(req.params.id)) {
        return res.status(404).json('El recurso no existe');
    }

    // Comprobar que existe
    const { data: existente, error: errorBusqueda } = await supabase
        .from('recurso')
        .select('id')
        .eq('id', req.params.id)
        .maybeSingle();

    if (errorBusqueda) {
        return errorBD(res, errorBusqueda, 'Error al realizar el select');
    }

    if (!existente) {
        return res.status(404).json('El recurso no existe');
    }

    const { modelo, ubicacion, numero_serie, estado } = req.body || {};

    if (!modelo || !ubicacion || !numero_serie || estado === undefined) {
        return res.status(404).json('No puede haber campos vacíos');
    }

    const { error } = await supabase
        .from('recurso')
        .update({
            modelo: modelo,
            ubicacion: ubicacion,
            numero_serie: numero_serie,
            estado: estado
        })
        .eq('id', req.params.id);

    if (error) {
        return errorBD(res, error, 'Error al realizar la actualizacion');
    }

    return res.status(200).json('Recurso actualizado correctamente');
});


// BORRAR RECURSO

app.delete('/api/recursos/:id', async function(req, res) {

    if (!idValido(req.params.id)) {
        return res.status(404).json('Recurso no encontrado');
    }

    // Comprobar que existe
    const { data: existente, error: errorBusqueda } = await supabase
        .from('recurso')
        .select('id')
        .eq('id', req.params.id)
        .maybeSingle();

    if (errorBusqueda) {
        return errorBD(res, errorBusqueda, 'Error al realizar el select');
    }

    if (!existente) {
        return res.status(404).json('Recurso no encontrado');
    }

    // Borrar recurso
    const { error } = await supabase
        .from('recurso')
        .delete()
        .eq('id', req.params.id);

    if (error) {
        return errorBD(res, error, 'Error al realizar el borrado');
    }

    return res.status(200).json('Recurso borrado correctamente');
});


// FUNCION PARA OBTENER RESERVAS O RESEÑAS DE UN RECURSO

async function obtenerDatosRecurso(res, idRecurso, tabla) {

    if (!idValido(idRecurso)) {
        return res.status(404).json('Recurso no encontrado');
    }

    // Comprobar que existe el recurso
    const { data: recurso, error: errorRecurso } = await supabase
        .from('recurso')
        .select('id')
        .eq('id', idRecurso)
        .maybeSingle();

    if (errorRecurso) {
        return errorBD(res, errorRecurso, 'Error al realizar la consulta');
    }

    if (!recurso) {
        return res.status(404).json('Recurso no encontrado');
    }

    // Obtener datos de la tabla correspondiente
    const { data, error } = await supabase
        .from(tabla)
        .select('*')
        .eq('recurso', idRecurso)
        .order('id');

    if (error) {
        return errorBD(res, error, 'Error al realizar la consulta');
    }

    return res.status(200).json(data);
}


// OBTENER RESERVAS DE UN RECURSO

app.get('/api/recursos/:id/reservas', async function(req, res) {

    await obtenerDatosRecurso(res, req.params.id, 'reservas');

});


// OBTENER RESEÑAS DE UN RECURSO

app.get('/api/recursos/:id/resenyas', async function(req, res) {

    await obtenerDatosRecurso(res, req.params.id, 'resenyas');

});


// PUERTO DEL SERVIDOR

const puerto = process.env.PORT || 3000;

app.listen(puerto, '0.0.0.0', function() {
    console.log('Servidor REST escuchando en puerto ' + puerto);
});
