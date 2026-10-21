
/*contiene las funciones que van a hacer algo en el index, para conectar con el servidor
    eventos de botones, leer inputs, llamar a rest.js, pintar resultados
*/
var seccionActual = "login";
var gestorId = null;
var tokenGestor = null; 
//variable para el ws
var ws = null; //guarda la conexión ws del gestor

var categorias = [];
var modelos = [];
var ubicaciones = [];
var recursos = [];

var recursoActual = null;

function cambiarSeccion(seccion){
    document.getElementById(seccionActual).classList.remove("activa");
    document.getElementById(seccion).classList.add("activa");
    seccionActual=seccion;
}
//función para conectarse a WS
function conectarWSGestor(nombreGestor){
    //abre la conexión (mismo puerto que servidor_ws), y acepta protocolo avisos
    ws = new WebSocket("ws://localhost:4444/", "avisos");
    //cuando la conexión ya está abierta
    ws.onopen = function(){
        console.log("WebSocket gestor conectado");
        //el gestor se identifica 
        //esto es lo que va a recibir el servicor_ws como msg
        ws.send(JSON.stringify({
            operacion: "identificar",
            tipo:"gestor",
            id:gestorId,
            nombre: nombreGestor
        }));
    };
    ws.onmessage = function(event){
        var msg = JSON.parse(event.data);
        console.log("Mensaje WS recibido:", msg);
        /*
        if (msg.operacion === "aviso") {
            mostrarAvisoGestor(msg.texto);
        }
        */
        if (msg.operacion === "aviso") {
            mostrarAvisoGestor(msg);
        }
    };

    ws.onerror=function(error){
        console.log("Error en WebSocket gestor: " + error);
    }

    ws.onclose=function(){
        console.log("WebSocket gestor cerrado");
    }; 
}

function mostrarAvisoGestor(aviso){
    var tbody = document.querySelector("#tabla-avisos tbody");

    if(!tbody){
        alert("Aviso: " + aviso.texto);
        return;
    }

    var fila = document.createElement("tr");

    // aplica el color del aviso
    fila.className = aviso.color;

    fila.innerHTML =
        "<td>" + new Date(aviso.fecha).toLocaleString() + "</td>" +
        "<td>" + aviso.origen + "</td>" +
        "<td>" + aviso.texto + "</td>";

    tbody.appendChild(fila);
}

///// WS
function enviarAviso(aviso){
    if(ws && ws.readyState === WebSocket.OPEN){
        aviso.operacion = "aviso";
        ws.send(JSON.stringify(aviso));
    }
}

function entrar(){
    var usuario = document.getElementById("usuarioLogin").value;
    var contrasenya = document.getElementById("contrasenyaLogin").value;
    /**
     * "../api/gestor/login" --> llama al servidor y rest recibe respuesta y callback
     */
    rest.post("/api/gestores/login", {
        login: usuario, password: contrasenya
    }, function(estado, respuesta){
        //estado y respuesta del api del servidor
        if(estado===403){
            alert("Usuario o contraseña incorrectos");
            return;
        }
        if(estado===200){
            gestorId = respuesta.id;
            tokenGestor = respuesta.token;
            cargarDesplegables(); 
            obtenerReservasMinisterio();
            //respuesta del get en el servidor
            console.log(estado, "Login correcto", respuesta);
            //Pedir datos del gestor para poder mostrar la bienvenida con su nombre y apellidos
            rest.get("/api/gestores/" + gestorId, function(estado2, datos){
                if(estado2===200){
                    document.getElementById("bienvenida").textContent = "Bienvenido " + datos.nombre + " " + datos.apellidos;
                    //para identificar el gestor en WS con su nombre completo (antes solo se sabia el id)
                    conectarWSGestor(datos.nombre + " " + datos.apellidos);
                }
            });
            //cambia a menu-principal (clase del index.html)
            cambiarSeccion("menu-principal");
            return;
        }
        alert("Error inesperado: " + estado);
    })
}

//nuevo gestor
function registrarse(){
    //inicializa todos los datos vacíos para rellenarlos cuando se cambie la pantalla
    gestorId = null;
    document.getElementById("nombreDatos").value = "";
    document.getElementById("apellidosDatos").value = "";
    document.getElementById("usuarioDatos").value = "";
    document.getElementById("contrasenyaDatos").value = "";
    //cambia a pantalla para rellenar los datos para registrarse
    cambiarSeccion("datos-gestor");
}

//botón cancelar en datos-gestor
//si se ha llegado desde "registrarse", te lleva a la página de login
//si se ha llegado desde "editar datos", te lleva a la página de inicio
function cancelar(){
    if(gestorId){
        cambiarSeccion('menu-principal');
    }
    else{
        cambiarSeccion('login');
        document.getElementById("usuarioLogin").value = "";
        document.getElementById("contrasenyaLogin").value = "";
    }
}

//botón editar datos
function datosUsuario(){
    /*
    var usuario = document.getElementById("usuario").value;
    var nombre = document.getElementById("nombre").value;
    var apellidos = document.getElementById("apellidos").value;
    var contrasenya = document.getElementById("contrasenya").value;
    */
    if(!gestorId){
        alert("No hay sesión iniciada");
        return;
    }
    //no se puede poner /api/gestores/:id, por eso + gestorId, que se guarda el id de un gestor en el login
    rest.get("/api/gestores/" + gestorId, function(estado, respuesta){
        if(estado === 404){
            alert("EL gestor no existe");
            return;
        }
        if(estado === 200){
            //cambiar de sección a la
            cambiarSeccion("datos-gestor");
            console.log(estado, respuesta);
            document.getElementById("nombreDatos").value = respuesta.nombre;
            document.getElementById("apellidosDatos").value = respuesta.apellidos;
            document.getElementById("usuarioDatos").value = respuesta.usuario;
            return;
        }
        alert("Error inesperado: " + estado);
    });
}

//botón guardar (datos gestor)
function guardarDatos(){
    //.trim() elimina los espacios en blanco al principio y al final
    var nombre = document.getElementById("nombreDatos").value.trim();
    var apellidos = document.getElementById("apellidosDatos").value.trim();
    var usuario = document.getElementById("usuarioDatos").value.trim();
    var password = document.getElementById("contrasenyaDatos").value.trim();

    var datos = {nombre, apellidos, usuario, password};
    //comprobar que no haya campos vacíos
    if(!nombre||!apellidos||!usuario||!password){
        alert("No puede haber campos vacíos");
        return;
    }

    //si no existe gestor, se crea nuevo
    if(!gestorId){
        rest.post("/api/gestores", datos, function(estado, respuesta){
            //si hay algun campo vacío
            if(estado === 404){
                alert("No puede haber campos vacíos");
                return;
            }
            //si ya existe ese usuario 
            if(estado === 409){
                alert("Este usuario ya existe");
            }
            //si todo está correcto (no campos vacíos / no usuario igual)
            if(estado === 201){
                alert("Gestor creado con éxito");
                //va al inicio de sesión
                cambiarSeccion("login");
                //para que al cambiar al login ya aparezcan por defecto el usuario y contraseña que acaba de crear
                document.getElementById("usuarioLogin").value = respuesta.usuario;
                document.getElementById("contrasenyaLogin").value = respuesta.password;
                return;
            }
            alert("Error inesperado: " + estado);
        });
        return;
    }
    console.log("Guardando con gestorId =", gestorId, "datos =", datos);
    //si existe gestor, se actualizan los datos
    //no se puede poner /api/gestores/:id, por eso + gestorId, que se guarda el id de un gestor en el login
    rest.put("/api/gestores/" + gestorId, datos, function(estado, respuesta){
        if(estado === 404){
            alert("Gestor no existe");
            return;
        }

        if(estado === 409){
            alert("Este usuario ya existe");
            return;
        }

        if(estado === 200){
            alert("Datos actualizados");
            document.getElementById("bienvenida").textContent = "Bienvenido "+nombre + " "+ apellidos;
            cambiarSeccion("menu-principal");
            
            //document.getElementById("contrasenyaDatos") = respuesta.password;
            return;
        }
        alert("Error inesperado " + estado);
    });
}

//tras correcto inicio de sesión, para volver al acceso 
//para salir desde el inicio de la app al acceso
//se puede quitar esta función y directamente redirigir en el index.html
function salir(){
    //cerrar conexion
    if(ws){
        ws.close();
        ws=null;
    }
    // limpiamos la tabla de avisos al salir
    var tbodyAvisos = document.querySelector("#tabla-avisos tbody");
    if(tbodyAvisos){
        tbodyAvisos.innerHTML = "";
    }

    gestorId=null;
    tokenGestor = null;
    cambiarSeccion("login");
    document.getElementById("usuarioLogin").value = "";
    document.getElementById("contrasenyaLogin").value = "";
}

//para mostrar el listado de recursos en función de los filtros elegidos

function cargarDesplegables() {
    // Solicitar categorías desde el servidor
    rest.get("/api/categorias", function(estado, datos) {
        if (estado === 200) {
            // Variables originales (Búsqueda) y Nuevas (Ficha)
            var selCategoria = document.getElementById("categoriaSelect");
            var selCategoriaRecurso = document.getElementById("categoriaRecurso");

            var contenidoBusqueda = "<option value=''>Todos</option>";
            var contenidoFicha = "<option value=''>Seleccione...</option>";

            datos.forEach(function(categoria) {
                var opt = "<option value='" + categoria.id + "'>" + categoria.nombre + "</option>";
                contenidoBusqueda += opt;
                contenidoFicha += opt;
            });

            if (selCategoria) selCategoria.innerHTML = contenidoBusqueda;
            if (selCategoriaRecurso) selCategoriaRecurso.innerHTML = contenidoFicha;
        }
    });

    // Solicitar ubicaciones desde el servidor
    rest.get("/api/ubicaciones", function(estado, datos) {
        if (estado === 200) {
            // Variables originales (Búsqueda) y Nuevas (Ficha)
            var selUbicacion = document.getElementById("ubicacionSelect");
            var selUbicacionRecurso = document.getElementById("ubicacionRecurso");

            var contenidoBusqueda = "<option value=''>Todos</option>";
            var contenidoFicha = "<option value=''>Seleccione...</option>";

            datos.forEach(function(ubicacion) {
                var opt = "<option value='" + ubicacion.id + "'>" + ubicacion.nombre + "</option>";
                contenidoBusqueda += opt;
                contenidoFicha += opt;
            });

            if (selUbicacion) selUbicacion.innerHTML = contenidoBusqueda;
            if (selUbicacionRecurso) selUbicacionRecurso.innerHTML = contenidoFicha;
        }
    });

    // Solicitar modelos 
    rest.get("/api/modelos", function(estado, datos) {
        if (estado === 200) {
            var selModelo = document.getElementById("modeloSelect");
            var contenidoBusqueda = "<option value=''>Todos</option>";
            datos.forEach(function(modelo) {
                contenidoBusqueda += "<option value='" + modelo.id + "'>" + modelo.nombre + "</option>";
            });
            if (selModelo) selModelo.innerHTML = contenidoBusqueda;

            // El modelo de la FICHA se queda esperando a la categoría
            var selModeloRecurso = document.getElementById("modeloRecurso");
            if (selModeloRecurso) {
                selModeloRecurso.innerHTML = "<option value=''>Seleccione categoría primero</option>";
            }
        }
    });

    // Solicitar estados (manual) para el filtro de búsqueda
    var selEstado = document.getElementById("estadoSelect");
    if (selEstado) {
        selEstado.innerHTML = "<option value=''>Todos</option>" +
                              "<option value='0'>Operativo</option>" +
                              "<option value='1'>Defectuoso</option>" +
                              "<option value='2'>En mantenimiento</option>";
    }
}

function buscar() {
    var idCat = document.getElementById("categoriaSelect").value;
    var idMod = document.getElementById("modeloSelect").value;
    var idUbi = document.getElementById("ubicacionSelect").value; // Este es Planta 1, Planta 2...
    var idEst = document.getElementById("estadoSelect").value;

    // Crea la url con los parámetros de búsqueda, solo añadiendo los que tengan valor
    var url = "/api/recursos?categoria=" + idCat + 
              "&modelo=" + idMod + 
              "&ubicacion=" + idUbi + 
              "&estado=" + idEst;

    console.log("Buscando en URL:", url); // Esto te dirá en la consola qué estás enviando

    rest.get(url, function(status, data) {
        console.log("Respuesta del servidor:", status, data); 
        if (status === 200) {
            pintarTabla(data);
        }
    });
}
// Función para pintar la tabla con los recursos obtenidos

function pintarTabla(listaRecursos) {
    console.log("Intentando pintar recursos:", listaRecursos);
    
    var tabla = document.getElementById("tabla-recursos");
    var tbody = tabla.querySelector("tbody");
    tbody.innerHTML = ""; 

    if (!listaRecursos || listaRecursos.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center'>Sin resultados</td></tr>";
        return;
    }

    rest.get("/api/modelos", function(s1, modelos) {
        rest.get("/api/categorias", function(s2, categorias) {
            rest.get("/api/ubicaciones", function(s3, ubicaciones) {
                
                if (s1 === 200 && s2 === 200 && s3 === 200) {
                    listaRecursos.forEach(function(r) {
                        var modObj = modelos.find(m => m.id == r.modelo) || { nombre: "Desconocido", categoria: "" };
                        var catObj = categorias.find(c => c.id == modObj.categoria) || { nombre: "Desconocido" };
                        var ubiObj = ubicaciones.find(u => u.id == r.ubicacion) || { nombre: "Desconocido" };
                        
                        var estados = ["Operativo", "Defectuoso", "En mantenimiento"];
                        var textoEstado = estados[r.estado] || "---";

                        // 1. Creamos la fila
                        var fila = document.createElement("tr");

                        // 2. Construimos el contenido sumando los trozos uno a uno
                        var contenido = "";
                        contenido += "<td>" + r.numero_serie + "</td>";
                        contenido += "<td>" + catObj.nombre + "</td>";
                        contenido += "<td>" + modObj.nombre + "</td>";
                        contenido += "<td>" + ubiObj.nombre + "</td>";
                        contenido += "<td>" + textoEstado + "</td>";
                        contenido += "<td>";
                        
                        // Añadimos la celda con los dos botones
                        contenido +=   "<button onclick='abrirRecurso(" + r.id + ")'>Abrir</button>";
                        contenido +=   "<button onclick='borrarRecurso(" + r.id + ")'>Borrar</button>";
                        contenido += "</td>";

                        // 3. Metemos el texto dentro de la fila y la pegamos en la tabla
                        fila.innerHTML = contenido;
                        tbody.appendChild(fila);
                    });
                }
            });
        });
    });
}
var recursoActual = null;
function abrirRecurso(id) {
    if (!id) {
        // MODO AÑADIR
        recursoActual = null;
        document.getElementById("numSerieRecurso").value = "";
        document.getElementById("categoriaRecurso").value = "";
        document.getElementById("ubicacionRecurso").value = "";
        document.getElementById("estadoRecurso").value = "0";
        document.getElementById("modeloRecurso").innerHTML = "<option value=''>Seleccione categoría primero</option>";
        cambiarSeccion("nuevo-recurso");
    } else {
        // MODO EDITAR
        rest.get("/api/recursos/" + id, function(status, resp) {
            if (status === 200) {
                recursoActual = resp;
                document.getElementById("numSerieRecurso").value = resp.numero_serie;
                document.getElementById("ubicacionRecurso").value = resp.ubicacion;
                document.getElementById("estadoRecurso").value = resp.estado;
                cargarReservasFicha(id); // Carga las reservas de este recurso en la ficha
                cargarResenyasFicha(id); 
                // Para cargar la categoría y el modelo correctamente:
                rest.get("/api/modelos", function(s, modelos) {
                    var mod = modelos.find(m => String(m.id) === String(resp.modelo));
                    if (mod) {
                        document.getElementById("categoriaRecurso").value = mod.categoria;
                        // Forzamos la carga de modelos de esa categoría
                        actualizarModelos(mod.categoria, "modeloRecurso");
                        // Esperamos a que se llene el select para marcar el modelo actual
                        setTimeout(() => { 
                            document.getElementById("modeloRecurso").value = resp.modelo; 
                        }, 200);
                    }
                });
                cambiarSeccion("nuevo-recurso");
            }
        });
    }
}
function actualizarModelos(idCategoria, idSelect) {
    var selectModelos = document.getElementById(idSelect);
    
    // Si no hay categoría seleccionada, mostramos el mensaje de aviso
    if (!idCategoria || idCategoria === "") {
        //si es el select de la búsqueda --> que salgan todos
        if(idSelect === "modeloSelect") {
            rest.get("/api/modelos", function(status, listaCompleta) {
                if (status === 200) {
                    var html = "<option value=''>Todos</option>";
                    listaCompleta.forEach(function(modelo) {
                        html += "<option value='" + modelo.id + "'>" + modelo.nombre + "</option>";
                    });
                    selectModelos.innerHTML = html;
                }
            });
            return;
        }
        // si es el de la ficha --> mensaje normal
        selectModelos.innerHTML = "<option value=''>Seleccione categoría primero</option>";
        return;
    }

    // Pedimos todos los modelos al servidor (ruta /api/modelos de tu app.js)
    rest.get("/api/modelos", function(status, listaCompleta) {
        if (status === 200) {
            // Filtramos los modelos que pertenecen a la categoría elegida
            var filtrados = listaCompleta.filter(function(m) {
                return String(m.categoria) === String(idCategoria);
            });

            // Generamos las opciones del desplegable
            var html = "<option value=''>Seleccione modelo</option>";
            filtrados.forEach(function(modelo) {
                html += "<option value='" + modelo.id + "'>" + modelo.nombre + "</option>";
            });
            
            selectModelos.innerHTML = html;
        }
    });
}

function guardarRecurso() {
    // Recopilación de datos de la ficha
    var modelo = document.getElementById("modeloRecurso").value;
    var numero_serie = document.getElementById("numSerieRecurso").value.trim();
    var ubicacion = document.getElementById("ubicacionRecurso").value;
    var estado = document.getElementById("estadoRecurso").value;

    // Validación básica
    if (!modelo || !numero_serie || !ubicacion) {
        alert("Por favor, rellena los campos de modelo, serie y ubicación.");
        return;
    }

    var datos = {
        modelo: modelo,
        numero_serie: numero_serie,
        ubicacion: ubicacion,
        estado: estado
    };

    if (recursoActual) {
        // MODO EDITAR: Usamos el ID del recurso que abrimos
        rest.put("/api/recursos/" + recursoActual.id, datos, function(status) {
            if (status === 200) {
                alert("Recurso actualizado con éxito");
                cambiarSeccion("menu-principal");
                buscar(); // Refresca la tabla principal
            }
        });
    } else {
        // MODO CREAR: Nuevo recurso
        rest.post("/api/recursos", datos, function(status) {
            if (status === 201) {
                alert("Nuevo recurso creado");
                ///
                var categoriaSelect = document.getElementById("categoriaRecurso");
                var modeloSelect = document.getElementById("modeloRecurso");

                var nombreCategoria = categoriaSelect.options[categoriaSelect.selectedIndex].text;
                var nombreModelo = modeloSelect.options[modeloSelect.selectedIndex].text;

                enviarAviso({
                    tipoAviso: "creacion_recurso",
                    destino: "sanitario",
                    color: "aviso-azul",
                    texto: "SE HA CREADO UN NUEVO RECURSO " +
                        nombreCategoria.toUpperCase() +
                        " MODELO " + nombreModelo.toUpperCase() +
                        " CON CÓDIGO " + numero_serie
                });

                //enviarAviso("sanitario", "El gestor ha creado un nuevo recurso");
                cambiarSeccion("menu-principal");
                buscar();
            }
            else if (status === 404){
                alert("Error al crear el recurso");
                }
        });
    }
}

function nuevoRecurso(){
    recursoActual = null; 

    // 1. Limpiamos los textos
    document.getElementById("numSerieRecurso").value = "";
    
    // 2. Reseteamos los selects a la primera opción ("Seleccione...")
    document.getElementById("categoriaRecurso").value = "";
    document.getElementById("ubicacionRecurso").value = "";
    document.getElementById("estadoRecurso").value = "0"; 

    // 3. Importante: Dejamos el de modelos vacío hasta que elijan categoría
    var selModelo = document.getElementById("modeloRecurso");
    selModelo.innerHTML = "<option value=''>Seleccione categoría primero</option>";
    selModelo.value = "";

    // 4. Cambiamos la vista
    cambiarSeccion("nuevo-recurso");
}

function borrarRecurso(id) {
    // 1. Pedimos confirmación para evitar sustos
    if (confirm("¿Estás seguro de que quieres borrar este recurso?")) {
        // 2. Llamamos a la ruta DELETE que tienes en tu servidor
        rest.delete("/api/recursos/" + id, function(status, respuesta) {
            if (status === 200) {
                alert("Recurso borrado correctamente");
                // 3. Volvemos a buscar para que la tabla se actualice sola
                buscar(); 
            } else {
                alert("Error al borrar el recurso");
            }
        });
    }
}

function cargarReservasFicha(idRecurso) {
    // Buscar cuerpo de la tabla en el HTML para limpiarlo
    var tabla = document.getElementById("tabla-reservas");
    var tbody = tabla.querySelector("tbody");
    tbody.innerHTML = ""; // limpia la tabla antes de cargar los datos 

    // Se pide al servidor las reservas de este recurso específico
    rest.get("/api/recursos/" + idRecurso + "/reservas", function(status, reservas) {
        if (status === 200) {
            // recorrer cada reserva recibida en la lista de reservas
            reservas.forEach(function(r) {
                // Se obtiene el ID del sanitario de la reserva 
                var idSan = r.sanitario;

                // Se pide al servidor los datos de ese sanitario
                rest.get("/api/sanitarios/" + idSan, function(s, sanitario) {
                    var nombreSanitario;
                    if (s === 200) {
                        nombreSanitario = sanitario.nombre + " " + sanitario.apellidos;
                    } else {
                        nombreSanitario = "Sanitario desconocido";
                    }

                    // COLORES 
                    var claseColor = "";
                    var ahora = new Date();
                    var fInicio = new Date(r.fecha_inicio);

                    if (r.fecha_fin !== null && r.fecha_fin !== "") {
                        // Blanco --> reserva finalizada (tiene fecha fin)
                        claseColor = "reserva-blanca";
                    } 
                    else if (ahora >= fInicio) {
                        // Recurso ya está en uso (ya ha pasado la fecha de inicio)
                        var miliseg = ahora - fInicio;
                        var horasTranscurridas = miliseg / (1000 * 60 * 60);

                        if (horasTranscurridas > parseFloat(r.horas_estimadas)) {
                            // Rojo: en uso y superadas las horas
                            claseColor = "reserva-roja";
                        } else {
                            // Azul: en uso dentro del tiempo
                            claseColor = "reserva-azul";
                        }
                    } 
                    else {
                        // Verde: la fecha de inicio es futura
                        claseColor = "reserva-verde";
                    }

                    // Se construye la fila (tr) con los datos 
                    var fila = document.createElement("tr");
                    fila.className = claseColor; 

                    // IMPORTANTE: Al usar createElement("tr"), el innerHTML NO debe llevar etiquetas <tr> interiores
                    fila.innerHTML = 
                        "<td>" + nombreSanitario + "</td>" +        
                        "<td>" + r.horas_estimadas + "</td>" +       
                        "<td>" + r.fecha_peticion.replace('T', ' ') + "</td>" + 
                        "<td>" + (r.fecha_inicio ? r.fecha_inicio.replace('T', ' ') : "---") + "</td>" +
                        "<td>" + (r.fecha_fin ? r.fecha_fin.replace('T', ' ') : "---") + "</td>";

                    // Se añade la fila al cuerpo de la tabla
                    tbody.appendChild(fila);
                }); // Cierre del rest.get de sanitarios
            }); // Cierre del forEach
        } else {
            tbody.innerHTML = "<tr><td colspan='5'>No se han podido cargar las reservas</td></tr>";
        }
    });
}

function cargarResenyasFicha(idRecurso) {
    // Buscar cuerpo de la tabla en el HTML para limpiarlo
    var tabla = document.getElementById("tabla-resenyas");
    var tbody = tabla.querySelector("tbody");
    tbody.innerHTML = ""; // limpia la tabla antes de cargar los datos 

    // Se pide al servidor las reseñas de este recurso específico
    rest.get("/api/recursos/" + idRecurso + "/resenyas", function(status, resenyas) {
        console.log("URL reseñas:", "/api/recursos/" + idRecurso + "/resenyas", "status:", status, "data:", resenyas);
        if (status === 200) {
            // recorrer cada reseña recibida en la lista
            resenyas.forEach(function(res) {
                // Se obtiene el ID del sanitario de la reseña
                var idSan = res.sanitario;

                // Se pide al servidor los datos de ese sanitario
                rest.get("/api/sanitarios/" + idSan, function(s, sanitario) {
                    var nombreSanitario;
                    if (s === 200) {
                        nombreSanitario = sanitario.nombre + " " + sanitario.apellidos;
                    } else {
                        nombreSanitario = "Sanitario desconocido";
                    }

                    // Se construye la fila (tr) con los datos exactos de tu datos.js
                    var fila = document.createElement("tr");

                    // Rellenamos las 4 columnas: Fecha, Sanitario, Valoración y Comentario
                    // Usamos res.descripcion para el comentario según tu datos.js
                    fila.innerHTML = 
                        "<td>" + res.fecha.replace('T', ' ') + "</td>" +        
                        "<td>" + nombreSanitario + "</td>" +       
                        "<td>" + res.valor + "</td>" + 
                        "<td>" + res.descripcion + "</td>";

                    // Se añade la fila al cuerpo de la tabla
                    tbody.appendChild(fila);
                }); // Cierre rest.get sanitario
            }); // Cierre forEach
        } else {
            // Si no hay o falla, mensaje de error en las 4 columnas
            tbody.innerHTML = "<tr><td colspan='4'>No se han podido cargar las reseñas</td></tr>";
        }
    });
}

function comprobarFin(pendientes, hayErrores, todasReservas){

    if(pendientes === 0){

        if(hayErrores === false){
            console.log("Todas las reservas obtenidas:", todasReservas);
            // obtenemos la fehca actual 
            var hoy = new Date(); 
            var anio = hoy.getFullYear(); 
            var mes = String(hoy.getMonth() + 1).padStart(2, "0");
            var dia = String(hoy.getDate()).padStart(2, "0");

            var fechaActual = anio + "-" + mes + "-" + dia;

            // preparamos los datos para el Ministerio
            var datosMinisterio = {
                id_area: 15,
                fecha: fechaActual,
                datos: todasReservas
            };

            console.log("Datos preparados para el Ministerio:", datosMinisterio);
            
            
            // enviamos los datos al Ministerio
            var urlMinisterio = "https://undefined.ua.es/telemedicina/api/datos";

            rest.post(urlMinisterio, datosMinisterio, function(estado, respuesta){
                // comprueba que el ministerio han respondido correctamente.
                if(estado === 200 || estado === 201){
                    console.log("Respuesta del Ministerio:", respuesta);
                    alert("Reservas enviadas correctamente al Ministerio");
                    obtenerReservasMinisterio();
                }
                else{
                    console.log("Error al enviar los datos:", estado, respuesta);
                    alert("No se han podido enviar las reservas al Ministerio");
                }

            });



        }
        else{
            alert("Error al obtener algunas reservas");
        }

    }
}

// crea la funcion que se utilizara para el envio de los datos al servidor

function enviarReservasMinisterio(){
    // array donde se guardaran todas las reservas
    var todasReservas = [];

    // obtenemos todos los recursos
    rest.get("/api/recursos", function(estado, recursos){
        if(estado === 200){
            console.log("Recursos obtenidos:", recursos);

            // obtenemos todos los modelos
            rest.get("/api/modelos", function(estado4, modelos){
                if(estado4 === 200){
                    console.log("Modelos: ", modelos);

                    // obtenemos las categorias
                    rest.get("/api/categorias/", function(estado5, categorias){
                        if(estado5 === 200){
                            console.log("Categorias: ", categorias);

                            var pendientes = recursos.length;
                            var hayErrores = false;

                            // comprobamos si han terminado todas las peticiones 


                            // recorremos todos los recursos
                            for(var i = 0; i < recursos.length; i++){
                                let r = recursos[i];
                                var modBuscado = null;

                                // buscamos el modelo al que pertenece cada recurso
                                for(var k = 0; k < modelos.length; k++){
                                    var m = modelos[k];

                                    if(m.id == r.modelo){
                                        modBuscado = m;
                                        break; // deja de recorrer los modelos, pq ya se ha encontrado el modelo correspondiente del recurso
                                    }
                                }

                                console.log("Modelo del recurso: ", modBuscado);

                                // obtenemos la categoria del modelo del recurso
                                let catBuscada = null;

                                // comprobamos que se haya encontrado el modelo
                                if(modBuscado !== null){
                                    for(var l = 0; l < categorias.length; l++){
                                        var c = categorias[l];

                                        if(c.id == modBuscado.categoria){
                                            catBuscada = c;
                                            break;
                                        }
                                    }
                                }

                                // obtenemos las reservas de cada recurso
                                rest.get("/api/recursos/" + r.id + "/reservas", function(estado2, reservas){
                                    if(estado2 === 200){
                                        console.log("Reservas obtenidas: ", reservas);

                                        for(var j = 0; j < reservas.length; j++){
                                            let re = reservas[j];

                                            // comprobamos que los datos son correctos
                                            
                                            if(
                                                re.sanitario != null &&
                                                re.horas_estimadas != null &&
                                                Number.isFinite(Number(re.horas_estimadas)) &&
                                                Number(re.horas_estimadas) > 0 &&
                                                typeof re.fecha_peticion === "string" &&
                                                re.fecha_peticion.trim() !== "" &&
                                                !isNaN(Date.parse(re.fecha_peticion)) &&
                                                (re.fecha_inicio == null ||
                                                    (typeof re.fecha_inicio === "string" &&
                                                    !isNaN(Date.parse(re.fecha_inicio)))) &&
                                                (re.fecha_fin == null ||
                                                    (typeof re.fecha_fin === "string" &&
                                                    !isNaN(Date.parse(re.fecha_fin))))
                                            ){


                                                pendientes++;

                                                // obtenemos los datos del sanitario de la reserva
                                                rest.get("/api/sanitarios/" + re.sanitario, function(estado3, sanitario){
                                                    if(estado3 === 200){
                                                        console.log("Sanitario obtenido: ", sanitario);

                                                        if(sanitario != null &&
                                                            catBuscada != null &&
                                                            typeof sanitario.nombre === "string" &&
                                                            sanitario.nombre.trim() !== "" &&
                                                            typeof sanitario.apellidos === "string" &&
                                                            sanitario.apellidos.trim() !== "" &&
                                                            typeof catBuscada.nombre === "string" &&
                                                            catBuscada.nombre.trim() !== ""
                                                        ){
                                                            var dato = {
                                                                nombre: sanitario.nombre,
                                                                apellidos: sanitario.apellidos,
                                                                "categoría": catBuscada.nombre,
                                                                horas_estimadas: Number(re.horas_estimadas),
                                                                fec_pet: re.fecha_peticion,
                                                                fec_ini: re.fecha_inicio,
                                                                fecha_fin: re.fecha_fin
                                                            };

                                                            todasReservas.push(dato);
                                                        }
                                                    }

                                                    // la consulta del sanitario ha terminado
                                                    if(estado3 !== 200){
                                                        hayErrores = true;
                                                    }

                                                    pendientes--;
                                                    console.log("Peticiones pendientes: ", pendientes);
                                                    comprobarFin(pendientes, hayErrores, todasReservas);

                                                });
                                            }
                                        }
                                    }
                                    if(estado2 !== 200){
                                        hayErrores = true; 
                                    }       
                                    pendientes --; 
                                    console.log("Peticiones pendientes: ", pendientes); 
                                    comprobarFin(pendientes, hayErrores, todasReservas);
                                });
                            }

                            if(recursos.length === 0){
                                comprobarFin(pendientes, hayErrores, todasReservas);
                            }
                        }
                    });
                }
            });
        }
    });
}

// funcion que comprueba si una reserva recibida es válida 

// comprobamos que una reserva recibida del Ministerio sea válida
function reservaMinisterioValida(reserva){

    return reserva != null &&
        typeof reserva.nombre === "string" &&
        reserva.nombre.trim() !== "" &&
        typeof reserva.apellidos === "string" &&
        reserva.apellidos.trim() !== "" &&
        typeof reserva["categoría"] === "string" &&
        reserva["categoría"].trim() !== "" &&
        reserva.horas_estimadas != null &&
        Number.isFinite(Number(reserva.horas_estimadas)) &&
        Number(reserva.horas_estimadas) > 0 &&
        typeof reserva.fec_pet === "string" &&
        reserva.fec_pet.trim() !== "" &&
        !isNaN(Date.parse(reserva.fec_pet));
}




// funcion para obtener las reservas del ministerio 

function obtenerReservasMinisterio(){
    // URL del Ministerio 
     var urlMinisterio = "https://undefined.ua.es/telemedicina/api/datos";
    
    // obtenemos todos los datos del Ministerio
    rest.get(urlMinisterio, function(estado, respuesta){

        if(estado === 200){
            console.log("Datos recibidos del Ministerio:", respuesta);
            var ranking = {};
            // inicializamos las 18 áreas médicas con 0 reservas 
            for(var j = 1; j<= 18; j++ ){
                ranking[j] = 0; 
            }
            // recorremos todos los registros del Ministerio 
            for(var i = 0; i < respuesta.length; i++){
                var registro = respuesta[i]; 
                var area = registro.id_area; 
                if(Number.isInteger(Number(area)) && Number(area) >= 1 && Number(area) <= 18){
                    // si todavia no existe el área, se inicializa el contador 
                    if(ranking[area] === undefined){
                        ranking[area] = 0; 
                    }
                    // comprobamos que los datos sean un array antes de contar las reservas
                    if(Array.isArray(registro.datos)){

                        for(var k = 0; k < registro.datos.length; k++){

                            if(reservaMinisterioValida(registro.datos[k])){
                                ranking[area]++;
                            }
                        }
                    }
                }
            }
            console.log("Ranking de reservas por área:", ranking);
            // convertimos el ranking en un array 
            var ordenado = []; 
            for(var area in ranking){
                ordenado.push({
                    id_area: area, 
                    total: ranking[area]
                }); 
            }
            // ordenamos de mayor a menor número de reservas 
            ordenado.sort(function(a,b){
                return b.total - a.total; 
            }); 
            console.log("Ranking ordenado: ",ordenado);

            // obtenemos la tabla del ranking 
            var tbody = document.querySelector("#tabla-ranking tbody"); 
            // limpiamos la tabla antes de rellenarla 
            tbody.innerHTML = ""; 
            // nombres de las areas médicas 
            // nombres de las áreas médicas según el profesor
            var nombresAreas = [
                "",
                "Alergología",
                "Anestesiología",
                "Cardiología",
                "Cirugía General",
                "Dermatología",
                "Aparato Digestivo",
                "Endocrinología",
                "Ginecología",
                "Hematología",
                "Medicina Interna",
                "Neumología",
                "Neurología",
                "Oftalmología",
                "Oncología",
                "Pediatría",
                "Psiquiatría",
                "Traumatología",
                "Urología"
            ];
            // recorremos las áreas ordenadas 
            for(var i = 0; i<ordenado.length; i++){
                var area = ordenado[i]; 
                // creamos una fila para cada área 
                var fila = document.createElement("tr"); 

                fila.innerHTML =
                    "<td>" + (i + 1) + "</td>" +
                   "<td>" + (nombresAreas[area.id_area] || "Área desconocida (" + area.id_area + ")") + "</td>" +
                    "<td>" + area.total + "</td>";

                tbody.appendChild(fila);

            }
        }
        else{
            console.log("Error al obtener los datos:", estado, respuesta);
            alert("No se han podido obtener los datos del Ministerio");
        }

    });
}

// EJERICICIO 1 
function reservasTotalMinisterio(){
    var reservas = obtenerReservasMinisterio(); 

    var total = reservas.length; 

    return total; 

