
const express = require("express");
const jwt = require("jwt-simple");
const { createClient } = require("@supabase/supabase-js");

const app = express();

// CONEXION CON SUPABASE
// URL y clave publica de TU proyecto, como en el ejemplo del profesor

const supabaseUrl = "https://jhrpvknlxprkivnimyxh.supabase.co";
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// CLAVE PARA LOS TOKENS JWT
var clave = "miSecretoMasOscuro";

// CONFIGURACION DEL SERVIDOR

app.use(express.json());

// Mostrar directamente la aplicacion al abrir Render
app.use(express.static("cliente_rest"));

// Mantener tambien la ruta original
app.use("/appCliente", express.static("cliente_rest"));


// FUNCIONES AUXILIARES

function errorBD(res, error, mensaje) {
    console.log(mensaje, error);
    return res.status(500).json(mensaje);
}

function idValido(valor) {
    return /^\d+$/.test(String(valor)) && Number(valor) > 0;
}


// LOGIN DE GESTORES

app.post("/api/gestores/login", async function(req, res) {

    var { login, password } = req.body || {};

    if (!login || !password) {
        return res.status(403).json("Autenticacion incorrecta");
    }

    // Comprobar el usuario y la contraseña en Supabase
    const { data: gestores, error } = await supabase
        .from("gestores")
        .select("id")
        .eq("usuario", login)
        .eq("password", password)
        .limit(1);

    if (error) {
        return errorBD(res, error, "Error al realizar la consulta");
    }

    if (gestores.length === 0) {
        return res.status(403).json("Autenticacion incorrecta");
    }

    var encontrado = gestores[0];

    // Crear token JWT
    var contenido = {
        usuario: encontrado.id,
        expira: Date.now() + 60 * 60 * 1000
    };

    var token = jwt.encode(contenido, clave);

    return res.status(200).json({
        id: encontrado.id,
        token: token
    });
});


// REGISTRAR UN NUEVO GESTOR

app.post("/api/gestores", async function(req, res) {

    var gest = req.body || {};

    if (!gest.nombre || !gest.apellidos ||
        !gest.usuario || !gest.password) {
        return res.status(404).json("No puede haber campos vacíos");
    }

    // Comprobar si ya existe el usuario
    const { data: gestores, error: errorBusqueda } = await supabase
        .from("gestores")
        .select("id")
        .eq("usuario", gest.usuario);

    if (errorBusqueda) {
        return errorBD(res, errorBusqueda, "Error al realizar la consulta");
    }

    if (gestores.length > 0) {
        return res.status(409).json("Usuario ya existe");
    }

    // Insertar gestor
    const { data, error } = await supabase
        .from("gestores")
        .insert({
            nombre: gest.nombre,
            apellidos: gest.apellidos,
            usuario: gest.usuario,
            password: gest.password
        })
        .select("id, usuario")
        .single();

    if (error) {
        if (error.code === "23505") {
            return res.status(409).json("Usuario ya existe");
        }

        return errorBD(res, error, "Error al realizar la insercion");
    }

    return res.status(201).json({
        id: data.id,
        usuario: data.usuario,
        password: gest.password
    });
});


// COMPROBAR EL TOKEN JWT
// Las rutas siguientes necesitan un token valido

app.use("/api", function(req, res, next) {

    var autorizacion = req.headers.authorization;

    if (!autorizacion || !autorizacion.startsWith("Bearer ")) {
        return res.status(401).json("No se ha encontrado token");
    }

    var token = autorizacion.substring(7);
    var contenidoToken;

    try {
        contenidoToken = jwt.decode(token, clave);
    }
    catch(error) {
        return res.status(401).json("El token es incorrecto");
    }

    if (!contenidoToken ||
        !contenidoToken.usuario ||
        !contenidoToken.expira) {
        return res.status(401).json("El formato del token no es adecuado");
    }

    if (contenidoToken.expira < Date.now()) {
        return res.status(401).json("El token ha expirado");
    }

    req.gestorId = contenidoToken.usuario;

    next();
});


// OBTENER UBICACIONES

app.get("/api/ubicaciones", async function(req, res) {

    const { data, error } = await supabase
        .from("ubicaciones")
        .select("*")
        .order("id");

    if (error) {
        return errorBD(res, error, "Error al realizar la consulta");
    }

    return res.status(200).json(data);
});


// OBTENER CATEGORIAS

app.get("/api/categorias", async function(req, res) {

    const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .order("id");

    if (error) {
        return errorBD(res, error, "Error al realizar la consulta");
    }

    return res.status(200).json(data);
});


// OBTENER MODELOS

app.get("/api/modelos", async function(req, res) {

    const { data, error } = await supabase
        .from("modelos")
        .select("*")
        .order("id");

    if (error) {
        return errorBD(res, error, "Error al realizar la consulta");
    }

    return res.status(200).json(data);
});


// ACTUALIZAR DATOS DE UN GESTOR

app.put("/api/gestores/:id", async function(req, res) {

    var id = req.params.id;
    var { nombre, apellidos, usuario, password } = req.body || {};

    if (!idValido(id)) {
        return res.status(404).json("El gestor no existe");
    }

    if (!nombre || !apellidos || !usuario || !password) {
        return res.status(404).json("No puede haber campos vacíos");
    }

    // Comprobar si existe el gestor
    const { data: gestor, error: errorGestor } = await supabase
        .from("gestores")
        .select("id")
        .eq("id", id)
        .maybeSingle();

    if (errorGestor) {
        return errorBD(res, errorGestor, "Error al realizar el select");
    }

    if (!gestor) {
        return res.status(404).json("El gestor no existe");
    }

    // Comprobar que ningun otro gestor tiene ese usuario
    const { data: otros, error: errorUsuario } = await supabase
        .from("gestores")
        .select("id")
        .eq("usuario", usuario)
        .neq("id", id);

    if (errorUsuario) {
        return errorBD(res, errorUsuario, "Error al realizar el select");
    }

    if (otros.length > 0) {
        return res.status(409).json("Usuario ya existe");
    }

    // Actualizar gestor
    const { error } = await supabase
        .from("gestores")
        .update({
            nombre: nombre,
            apellidos: apellidos,
            usuario: usuario,
            password: password
        })
        .eq("id", id);

    if (error) {
        if (error.code === "23505") {
            return res.status(409).json("Usuario ya existe");
        }

        return errorBD(res, error, "Error al realizar la actualizacion");
    }

    return res.status(200).json("Gestor actualizado correctamente");
});


// OBTENER DATOS DE UN GESTOR
// No devolver su contraseña

app.get("/api/gestores/:id", async function(req, res) {

    var id = req.params.id;

    if (!idValido(id)) {
        return res.status(404).json("El gestor no existe");
    }

    const { data, error } = await supabase
        .from("gestores")
        .select("id, nombre, apellidos, usuario")
        .eq("id", id)
        .maybeSingle();

    if (error) {
        return errorBD(res, error, "Error al realizar la consulta");
    }

    if (!data) {
        return res.status(404).json("El gestor no existe");
    }

    return res.status(200).json(data);
});


// OBTENER DATOS DE UN SANITARIO
// No devolver su contraseña

app.get("/api/sanitarios/:id", async function(req, res) {

    var id = req.params.id;

    if (!idValido(id)) {
        return res.status(404).json("El sanitario no existe");
    }

    const { data, error } = await supabase
        .from("sanitarios")
        .select("id, nombre, apellidos, usuario")
        .eq("id", id)
        .maybeSingle();

    if (error) {
        return errorBD(res, error, "Error al realizar el select");
    }

    if (!data) {
        return res.status(404).json("El sanitario no existe");
    }

    return res.status(200).json(data);
});


// OBTENER RECURSOS CON FILTROS

app.get("/api/recursos", async function(req, res) {

    var idCategoria = req.query.categoria;
    var idModelo = req.query.modelo;
    var idUbicacion = req.query.ubicacion;
    var idEstado = req.query.estado;

    var consulta = supabase
        .from("recurso")
        .select("*")
        .order("id");

    // FILTRO POR MODELO
    if (idModelo !== undefined && idModelo !== "") {
        consulta = consulta.eq("modelo", idModelo);
    }

    // FILTRO POR UBICACION
    if (idUbicacion !== undefined && idUbicacion !== "") {
        consulta = consulta.eq("ubicacion", idUbicacion);
    }

    // FILTRO POR ESTADO
    if (idEstado !== undefined && idEstado !== "") {
        consulta = consulta.eq("estado", idEstado);
    }

    // FILTRO POR CATEGORIA
    if (idCategoria !== undefined && idCategoria !== "") {

        const { data: modelos, error: errorModelos } = await supabase
            .from("modelos")
            .select("id")
            .eq("categoria", idCategoria);

        if (errorModelos) {
            return errorBD(res, errorModelos, "Error al realizar el select");
        }

        if (modelos.length === 0) {
            return res.status(200).json([]);
        }

        var idsModelos = modelos.map(function(modelo) {
            return modelo.id;
        });

        consulta = consulta.in("modelo", idsModelos);
    }

    const { data, error } = await consulta;

    if (error) {
        return errorBD(res, error, "Error al realizar la consulta");
    }

    return res.status(200).json(data);
});


// OBTENER UN RECURSO POR ID

app.get("/api/recursos/:id", async function(req, res) {

    var id = req.params.id;

    if (!idValido(id)) {
        return res.status(404).json("El recurso no existe");
    }

    const { data, error } = await supabase
        .from("recurso")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (error) {
        return errorBD(res, error, "Error al realizar la consulta");
    }

    if (!data) {
        return res.status(404).json("El recurso no existe");
    }

    return res.status(200).json(data);
});


// CREAR UN NUEVO RECURSO

app.post("/api/recursos", async function(req, res) {

    var { modelo, ubicacion, numero_serie, estado } = req.body || {};

    if (!modelo || !ubicacion || !numero_serie ||
        estado === undefined) {
        return res.status(404).json("No puede haber campos vacíos");
    }

    const { data, error } = await supabase
        .from("recurso")
        .insert({
            modelo: modelo,
            ubicacion: ubicacion,
            numero_serie: numero_serie,
            estado: estado
        })
        .select("id")
        .single();

    if (error) {
        return errorBD(res, error, "Error al realizar la insercion");
    }

    return res.status(201).json(data.id);
});


// ACTUALIZAR UN RECURSO

app.put("/api/recursos/:id", async function(req, res) {

    var id = req.params.id;

    if (!idValido(id)) {
        return res.status(404).json("El recurso no existe");
    }

    // Comprobar que existe el recurso
    const { data: recurso, error: errorRecurso } = await supabase
        .from("recurso")
        .select("id")
        .eq("id", id)
        .maybeSingle();

    if (errorRecurso) {
        return errorBD(res, errorRecurso, "Error al realizar el select");
    }

    if (!recurso) {
        return res.status(404).json("El recurso no existe");
    }

    var { modelo, ubicacion, numero_serie, estado } = req.body || {};

    if (!modelo || !ubicacion || !numero_serie ||
        estado === undefined) {
        return res.status(404).json("No puede haber campos vacíos");
    }

    const { error } = await supabase
        .from("recurso")
        .update({
            modelo: modelo,
            ubicacion: ubicacion,
            numero_serie: numero_serie,
            estado: estado
        })
        .eq("id", id);

    if (error) {
        return errorBD(res, error, "Error al realizar la actualizacion");
    }

    return res.status(200).json("Recurso actualizado correctamente");
});


// BORRAR UN RECURSO

app.delete("/api/recursos/:id", async function(req, res) {

    var id = req.params.id;

    if (!idValido(id)) {
        return res.status(404).json("Recurso no encontrado");
    }

    // Comprobar que existe el recurso
    const { data: recurso, error: errorRecurso } = await supabase
        .from("recurso")
        .select("id")
        .eq("id", id)
        .maybeSingle();

    if (errorRecurso) {
        return errorBD(res, errorRecurso, "Error al realizar el select");
    }

    if (!recurso) {
        return res.status(404).json("Recurso no encontrado");
    }

    // Eliminar recurso
    const { error } = await supabase
        .from("recurso")
        .delete()
        .eq("id", id);

    if (error) {
        return errorBD(res, error, "Error al realizar el borrado");
    }

    return res.status(200).json("Recurso borrado correctamente");
});


// FUNCION PARA OBTENER RESERVAS O RESEÑAS DE UN RECURSO

async function obtenerDatosRecurso(res, idRecurso, tabla) {

    if (!idValido(idRecurso)) {
        return res.status(404).json("Recurso no encontrado");
    }

    // Comprobar que el recurso existe
    const { data: recurso, error: errorRecurso } = await supabase
        .from("recurso")
        .select("id")
        .eq("id", idRecurso)
        .maybeSingle();

    if (errorRecurso) {
        return errorBD(res, errorRecurso, "Error al realizar la consulta");
    }

    if (!recurso) {
        return res.status(404).json("Recurso no encontrado");
    }

    // Consultar la tabla indicada
    const { data, error } = await supabase
        .from(tabla)
        .select("*")
        .eq("recurso", idRecurso)
        .order("id");

    if (error) {
        return errorBD(res, error, "Error al realizar la consulta");
    }

    return res.status(200).json(data);
}


// OBTENER RESERVAS DE UN RECURSO

app.get("/api/recursos/:id/reservas", async function(req, res) {

    await obtenerDatosRecurso(res, req.params.id, "reservas");

});


// OBTENER RESEÑAS DE UN RECURSO

app.get("/api/recursos/:id/resenyas", async function(req, res) {

    await obtenerDatosRecurso(res, req.params.id, "resenyas");

});


// INICIAR EL SERVIDOR REST

var puerto = process.env.PORT || 3000;

app.listen(puerto, "0.0.0.0", function() {
    console.log("Servidor REST iniciado en el puerto " + puerto);
});
