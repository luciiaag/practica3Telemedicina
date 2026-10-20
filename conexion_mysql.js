const mysql = require('mysql');
const database = {
    host : 'localhost',
    user : 'tele2026',
    password : '2026tele',
    database : 'practicas2026'
};

const conexion = mysql.createConnection(database);

conexion.connect(function (err) {
    if (err) {
        console.error('Error en la conexión de la base de datos:',err);
        process.exit();
    }
});

module.exports = conexion;