
//var conexion = require("./conexion_mysql.js")
var express = require("express");
var app = express();
var jwt = require('jwt-simple');
var clave = 'miSecretoMasOscuro'; // clave para codificar / decodificar el token

// importar el cliente de Supabase 
const { createClient } = require('@supabase/supabase-js');

// configurar la conexion 
const supabaseUrl = 'https://jhrpvknlxprkivnimyxh.supabase.co';
const supabaseKey = 'sb_publishable_LTdxPUTHYsaXAP0qjDtmRQ_S1tIxsWU';
const supabase = createClient(supabaseUrl, supabaseKey);


//cuando alguien se conecta a /appCliente, se le manda lo que hay en la carpeta "cliente"
app.use(express.static("cliente_rest"));
app.use(express.json());


app.post("/api/gestores/login", function(req,res){
    var {login, password} = req.body;
    
    var sql = "SELECT * FROM gestores WHERE usuario = '" 
        + login + "' AND password = '" 
        + password + "'";

    conexion.query(sql, function(err,gestores){
        if(err){
            console.log("Error al realizar el select", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        else{
            if(gestores.length === 0){  
                return res.status(403).json("Autenticacion incorrecta");
            }
            var encontrado = gestores[0]; 
            // creamos el contenido del token 
            var contenido = {
                usuario: encontrado.id, // identifica al gestor que ha iniciado sesión
                expira: Date.now() + 60 * 60 * 1000 // expira dentro de 1 hora (en ms)
            };
            // generamos el token JWT utilizando la clave secreta
            var token = jwt.encode(contenido, clave);
            // devolvemos el ID del gestor y su token 
            return res.status(200).json({id: encontrado.id, token: token});
        }
    }); 
});



app.post("/api/gestores", function(req,res){

    var gest = req.body; 

    if(!gest.nombre || !gest.apellidos || !gest.usuario || !gest.password){
        return res.status(404).json("No puede haber campos vacíos");
    }

    // Comprobamos si el usuario existe 
    var sqlBusqueda = "SELECT * FROM gestores WHERE usuario = '" + gest.usuario + "'";

    conexion.query(sqlBusqueda, function(err, gestores){

        if(err){
            console.log("Error al realizar el select", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        else{

            // Si hay un gestor con ese nombre de usuario
            if(gestores.length > 0){
                return res.status(409).json("Usuario ya existe");
            }
            else{

                var sql = "INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES ('"
                    + gest.nombre + "','"
                    + gest.apellidos + "','"
                    + gest.usuario + "','"
                    + gest.password + "')";

                conexion.query(sql, function(err, resultado){

                    if(err){
                        console.log("Error al realizar el insert", err);
                        return res.status(500).json("Error al realizar la insercion");
                    }
                    else{
                        return res.status(201).json(resultado.insertId);
                    }

                });
            }
        }

    });

});

// comprobamos el token antes de acceder a los servicios privados
app.use("/api", function(req, res, next){

    // obtenemos el token de la cabecera Authorization
    var autorizacion = req.headers.authorization; // recibe el token que enviar rest.js

    if(!autorizacion || !autorizacion.startsWith("Bearer ")){
        return res.status(401).json("No se ha encontrado token");
    }

    var token = autorizacion.substring(7);

    // decodificamos el token
    var contenidoToken;

    try{
        contenidoToken = jwt.decode(token, clave);
    }
    catch(error){
        return res.status(401).json("El token es incorrecto");
    }

    // comprobamos que tiene el formato correcto
    if(!contenidoToken || !contenidoToken.usuario || !contenidoToken.expira){
        return res.status(401).json("El formato del token no es adecuado");
    }

    // comprobamos que no haya caducado
    if(contenidoToken.expira < Date.now()){
        return res.status(401).json("El token ha expirado");
    }

    // el token es correcto y permite continuar
    next();
});


//Obtiene array de todas las ubicaciones
app.get("/api/ubicaciones", function(req, res){
    var sql = "SELECT * FROM ubicaciones"; 
    conexion.query(sql, function(err, ubicaciones){
        if(err){
            console.log("Error al realizar la select", err); 
            res.status(500).json("Error al realizar la consulta");
        }
        else{
            console.log("Ubicaciones:", ubicaciones); 
            res.status(200).json(ubicaciones);
        }
    });
});

//obtiene array categorias
app.get("/api/categorias", function(req, res){
    var sql = "SELECT * FROM categorias"; 
    conexion.query(sql, function(err, categorias){
        if(err){
            console.log("Error al realizar el select", err); 
            res.status(500).json("Error al realizar la consulta"); 
        }
        else{
            res.status(200).json(categorias);
        }
    })
});

//obtiene array con todos los modelos
app.get("/api/modelos", function(req, res){
    var sql = "SELECT * FROM modelos"; 
    conexion.query(sql, function(err, modelos){
        if(err){
            console.log("Error al realizar el select", err);
            res.status(500).json("Error al realizar la consulta"); 

        }
        else{
            res.status(200).json(modelos);
        }
    })
    
});

app.put("/api/gestores/:id", function(req,res){

    var id = req.params.id; 
    var nombre = req.body.nombre; 
    var apellidos = req.body.apellidos; 
    var usuario = req.body.usuario; 
    var password = req.body.password; 

    // Comprobamos que los campos no estén vacíos
    if(!nombre || !apellidos || !usuario || !password){
        return res.status(404).json("No puede haber campos vacíos");
    }

    // Comprobamos que el gestor existe
    var sqlBuscado = "SELECT * FROM gestores WHERE id = " + id; 

    conexion.query(sqlBuscado, function(err, gestores){

        if(err){
            return res.status(500).json("Error al realizar el select");
        }
        else{

            if(gestores.length === 0){  
                return res.status(404).json("El gestor no existe");
            }

            // Comprobamos que no hay otro gestor con el mismo nombre de usuario
            var sqlGestor = "SELECT * FROM gestores WHERE usuario = '" 
                + usuario + "' AND id <> " + id; 

            conexion.query(sqlGestor, function(err, gestoresUsuario){ 

                if(err){
                    return res.status(500).json("Error al realizar el select");
                }
                else{

                    if(gestoresUsuario.length > 0){
                        return res.status(409).json("Usuario ya existe");
                    }

                    // Actualizamos los datos del gestor
                    var sql = "UPDATE gestores SET nombre = '"
                        + nombre + "', apellidos = '"
                        + apellidos + "', usuario = '"
                        + usuario + "', password = '"
                        + password + "' WHERE id = " + id;
                    
                    conexion.query(sql, function(err, resultado){

                        if(err){
                            return res.status(500).json("Error al realizar la actualizacion");
                        }
                        else{
                            return res.status(200).json("Gestor actualizado correctamente");
                        }

                    });
                }
            });
        }
    });
});


//Obtiene un objeto con los datos de un gestor (no devolver contraseña)
app.get("/api/gestores/:id", function(req,res){
    //primero, leer el id del gestor que queremos devolver datos
    var id = Number(req.params.id);
    var sql = "SELECT * FROM gestores WHERE id = " + id;
    conexion.query(sql, function(err,gestores){
        if(err){
            console.log("Error al realizar el select " + err); 
            res.status(500).json("Error al realizar la consulta");
        }
        else{
            if(gestores.length === 0){
                return res.status(404).json("El gestor no existe"); 
            }
            var gest = gestores[0]; 
            var salida = {
                id: gest.id, 
                nombre:gest.nombre,
                apellidos:gest.apellidos, 
                usuario: gest.usuario
            }; 
            return res.status(200).json(salida);
            
        }
    })
});

// obtiene un objeto con los datos de un sanitario (NO devolver código de acceso)
app.get("/api/sanitarios/:id", function(req,res){

    var id = Number(req.params.id); 
    var sql = "SELECT * FROM sanitarios WHERE id = " + id; 

    conexion.query(sql, function(err, sanitarios){

        if(err){
            console.log("Error al realizar el select", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        else{
            if(sanitarios.length === 0){
                return res.status(404).json("El sanitario no existe"); 
            }

            var san = sanitarios[0];

            var salida = {
                id: san.id,
                nombre: san.nombre, 
                apellidos: san.apellidos, 
                usuario: san.usuario
            };

            return res.status(200).json(salida);
        }

    });

});


app.get("/api/recursos", function (req, res) {

    // Recogemos los filtros de la URL
    var idCategoria = req.query.categoria;
    var idModelo = req.query.modelo;
    var idUbicacion = req.query.ubicacion;
    var idEstado = req.query.estado;

    // Empezamos con la consulta básica
    var sql = "SELECT * FROM recurso";

    // Sirve para saber si ya hemos puesto WHERE
    var hayFiltro = false;


    // FILTRO POR MODELO
    if(idModelo && idModelo !== ""){

        sql += " WHERE modelo = " + idModelo;

        hayFiltro = true;
    }


    // FILTRO POR UBICACIÓN
    if(idUbicacion && idUbicacion !== ""){

        if(hayFiltro){
            sql += " AND ubicacion = " + idUbicacion;
        }
        else{
            sql += " WHERE ubicacion = " + idUbicacion;

            hayFiltro = true;
        }
    }


    // FILTRO POR ESTADO
    if(idEstado !== undefined && idEstado !== ""){

        if(hayFiltro){
            sql += " AND estado = " + idEstado;
        }
        else{
            sql += " WHERE estado = " + idEstado;

            hayFiltro = true;
        }
    }


    // Ejecutamos la consulta de recursos
    conexion.query(sql, function(err, recursos){

        if(err){
            console.log("Error al realizar el select", err);

            return res.status(500).json("Error al realizar la consulta");
        }


        // Si NO se ha indicado categoría,
        // devolvemos directamente los recursos encontrados
        if(!idCategoria || idCategoria === ""){

            return res.status(200).json(recursos);
        }


        // Si SÍ se ha indicado categoría,
        // buscamos los modelos que pertenecen a esa categoría
        var sqlModelos = "SELECT * FROM modelos WHERE categoria = " + idCategoria;

        conexion.query(sqlModelos, function(err, modelos){

            if(err){
                console.log("Error al realizar el select", err);

                return res.status(500).json("Error al realizar la consulta");
            }


            // Filtramos los recursos
            // Comprobamos si el modelo del recurso está entre
            // los modelos que pertenecen a la categoría elegida
            var filtrados = recursos.filter(function(rec){

                return modelos.some(function(mod){

                    return String(mod.id) === String(rec.modelo);

                });

            });


            // Devolvemos los recursos ya filtrados por categoría
            return res.status(200).json(filtrados);

        });

    });

});


app.get("/api/recursos/:id", function(req,res){
    // Leer el id del recurso que queremos devolver datos
    var id = (req.params.id);
    var sql = "SELECT * FROM recurso WHERE id = " +id; 
    conexion.query(sql, function(err,recursos){
        if(err){
            console.log("Error al realizar el select", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        else{
            if(recursos.length === 0){
                return res.status(404).json("El recurso no existe");
            }
            var rec = recursos[0]; 
            var salida = {
                id: rec.id, 
                modelo: rec.modelo, 
                ubicacion: rec.ubicacion, 
                numero_serie:rec.numero_serie,
                estado: rec.estado
            }
            return res.status(200).json(salida);
        }
    })
});



app.post("/api/recursos", function(req,res){
    // Leemos los datos del body 

    var modelo = req.body.modelo; 
    var ubicacion = req.body.ubicacion; 
    var numero_serie = req.body.numero_serie; 
    var estado = req.body.estado; 

    // comprobamso que los datos no estén vacios. 

    if(!modelo || !ubicacion || !numero_serie || estado === undefined){ 
        return res.status(404).json("No puede haber campos vacíos");
    }

   var sql = "INSERT INTO recurso (modelo, ubicacion, numero_serie, estado) VALUES ('"
        + modelo + "','"
        + ubicacion + "','"
        + numero_serie + "','"
        + estado + "')";
    
    conexion.query(sql, function (err, resultado) {
        if (err) {
            console.log("Error al realizar el insert", err);
            res.status(500).json("Error al realizar la insercion");
        } else {
            res.status(201).json(resultado.insertId);
        }
    });
});



app.put("/api/recursos/:id", function(req,res){

    var id = req.params.id; 

    // Buscamos el recurso
    var sqlRec = "SELECT * FROM recurso WHERE id = " + id; 

    conexion.query(sqlRec, function(err, recurso){

        if(err){
            return res.status(500).json("Error al realizar el select"); 
        }
        else{

            if(recurso.length === 0){
                return res.status(404).json("El recurso no existe");
            }

            var modelo = req.body.modelo; 
            var ubicacion = req.body.ubicacion; 
            var numero_serie = req.body.numero_serie; 
            var estado = req.body.estado; 

            // Comprobamos que no haya campos vacíos
            if(!modelo || !ubicacion || !numero_serie || estado === undefined){
                return res.status(404).json("No puede haber campos vacíos");
            }

            // Actualizamos el recurso
            var sql = "UPDATE recurso SET modelo = '"
                + modelo + "', ubicacion = '"
                + ubicacion + "', numero_serie = '"
                + numero_serie + "', estado = '"
                + estado + "' WHERE id = " + id;

            conexion.query(sql, function(err, resultado){

                if(err){
                    return res.status(500).json("Error al realizar la actualización");
                }
                else{
                    return res.status(200).json("Recurso actualizado correctamente");
                }

            });
        }

    });

});


app.delete("/api/recursos/:id", function(req,res){
    var id = req.params.id; 

    // comprobamos que el recurso existe

    var sqlBuscado = "SELECT * FROM recurso WHERE id = " + id; 
    conexion.query(sqlBuscado, function(err,recurso){
        if(err){
            return res.status(500).json("Error al realizar el select");
        }
        else{   
            if(recurso.length === 0){
                return res.status(404).json("Recurso no encontrado");  
            }
            // si el recurso existe, lo borramos 
            var sql = "DELETE FROM recurso WHERE id =" + id; 
            conexion.query(sql, function(err, resultado){

            if(err){
                return res.status(500).json("Error al realizar el borrado");
            }
            else{
                return res.status(200).json("Recurso borrado correctamente");
            }

        });
        }
    })
})


app.get("/api/recursos/:id/reservas", function(req,res){

    var idRecurso = req.params.id;

    var sqlRecurso = "SELECT * FROM recurso WHERE id = " + idRecurso;

    conexion.query(sqlRecurso, function(err, recurso){

        if(err){
            return res.status(500).json("Error al realizar la consulta");
        }

        if(recurso.length === 0){
            return res.status(404).json("Recurso no encontrado");
        }

        var sql = "SELECT * FROM reservas WHERE recurso = " + idRecurso;

        conexion.query(sql, function(err, reservas){

            if(err){
                return res.status(500).json("Error al realizar la consulta");
            }
            else{
                return res.status(200).json(reservas);
            }

        });

    });

});

// Obtiene las reseñas de un recurso 
app.get("/api/recursos/:id/resenyas", function(req,res){

    var idRecurso = req.params.id;

    var sqlRecurso = "SELECT * FROM recurso WHERE id = " + idRecurso;

    conexion.query(sqlRecurso, function(err, recurso){

        if(err){
            return res.status(500).json("Error al realizar la consulta");
        }

        if(recurso.length === 0){
            return res.status(404).json("Recurso no encontrado");
        }

        var sql = "SELECT * FROM resenyas WHERE recurso = " + idRecurso;

        conexion.query(sql, function(err, resenyas){

            if(err){
                return res.status(500).json("Error al realizar la consulta");
            }
            else{
                return res.status(200).json(resenyas);
            }

        });

    });

});




//puerto por el que escucha
app.listen(3000); 
