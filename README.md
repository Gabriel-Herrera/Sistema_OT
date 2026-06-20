# Sistema_OT

Proyecto de gestión de órdenes de trabajo con Node.js, Express y MySQL.

## Descripción

API REST básica para consultar datos de clientes, servicios y equipos activos en un sistema de órdenes de trabajo.

El servidor utiliza:

- `express` para manejar rutas HTTP.
- `mysql2` para conectar con la base de datos MySQL/MariaDB.

## Requisitos

- Node.js 18+ recomendado.
- npm.
- Base de datos MySQL/MariaDB.

## Instalación

1. Clonar el repositorio.
2. Instalar dependencias:

```bash
npm install
```

3. Configurar la base de datos en `index.js` o usar variables de entorno.
4. Ejecutar el proyecto:

```bash
npm run dev
```

## Configuración de la base de datos

En `index.js` se usa un pool de conexiones con estos valores por defecto:

```js
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "caso_ot_db",
  charset: "utf8mb4",
});
```

Ajusta estos datos según tu entorno MySQL:

- `host`
- `user`
- `password`
- `database`

> Si prefieres, puedes reemplazar estos valores por variables de entorno para proteger credenciales.

## Rutas disponibles

### GET /

Página inicial con descripción de los endpoints.

### GET /work-order-system/customer

Consulta datos del cliente, direcciones, servicios y equipos activos.

Parámetros:

- `id-customer` (obligatorio)

Ejemplo:

```bash
curl "http://localhost:3000/work-order-system/customer?id-customer=32"
```

### GET /work-order-system/get-services

Devuelve la lista de servicios activos con sus prestaciones.

Parámetros opcionales:

- `id-service`
- `id-provision`

Ejemplos:

```bash
curl "http://localhost:3000/work-order-system/get-services"
curl "http://localhost:3000/work-order-system/get-services?id-service=10"
curl "http://localhost:3000/work-order-system/get-services?id-provision=5"
```

### GET /work-order-system/get-equipment

Devuelve la lista de equipos activos con sus prestaciones.

Parámetros opcionales:

- `id-equipment`
- `id-provision`

Ejemplos:

```bash
curl "http://localhost:3000/work-order-system/get-equipment"
curl "http://localhost:3000/work-order-system/get-equipment?id-equipment=12"
curl "http://localhost:3000/work-order-system/get-equipment?id-provision=5"
```

## Scripts

- `npm run dev`: inicia el servidor con `nodemon`.
- `npm test`: script de prueba por defecto.

## Notas

- El proyecto ya incluye `.gitignore` para ignorar `node_modules`.
- Asegúrate de tener la base de datos `caso_ot_db` creada y las tablas requeridas según las consultas de `index.js`.
