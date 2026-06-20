const express = require("express");
const app = express();
const mysql = require("mysql2");
const PORT = 3000;

// Middleware para parsear JSON
app.use(express.json());

// Crear pool de conexiones a MySQL
const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "caso_ot_db",
    charset: "utf8mb4",
});

console.log("Pool de conexiones a MySQL/MariaDB inicializado en caso_ot_db");

// Funciones auxiliares para agrupar respuestas
function formatServiceList(rows) {
  const serviceMap = {};
  rows.forEach((row) => {
    const idSrv = row.ID_SERVICIO.toString();
    if (!serviceMap[idSrv]) {
      serviceMap[idSrv] = {
        idService: idSrv,
        serviceName: row.NOM_SERVICIO,
        provisionList: [],
      };
    }
    if (row.ID_PRESTACION) {
      serviceMap[idSrv].provisionList.push({
        idProvision: row.ID_PRESTACION.toString(),
        provisionName: row.NOM_PRESTACION,
      });
    }
  });
  return Object.values(serviceMap);
}

function formatEquipmentList(rows) {
  const equipmentMap = {};
  rows.forEach((row) => {
    const idEq = row.ID_EQUIPO.toString();
    if (!equipmentMap[idEq]) {
      equipmentMap[idEq] = {
        idEquipment: idEq,
        equipmentName: row.NOM_EQUIPO,
        provisionList: [],
      };
    }
    if (row.ID_PRESTACION) {
      equipmentMap[idEq].provisionList.push({
        idProvision: row.ID_PRESTACION.toString(),
        provisionName: row.NOM_PRESTACION,
      });
    }
  });
  return Object.values(equipmentMap);
}

app.get("/", (req, res) => {
  res.send(
    `
    <h1>API de Sistema de Órdenes de Trabajo</h1>
    <p>Endpoints disponibles:</p>
    <ul>
        <li>GET /work-order-system/customer?id-customer=...</li>
        <li>GET /work-order-system/get-services?id-provision=... o id-service=...</li>
        <li>GET /work-order-system/get-equipment?id-provision=... o id-equipment=...</li>
    </ul>
    `,
  );
});

// ============================================================================
// SERVICIO # 1: listar cliente
// GET /work-order-system/customer?id-customer=32
// ============================================================================
app.get("/work-order-system/customer", (req, res) => {
  const idCustomer = req.query["id-customer"];

  if (!idCustomer) {
    return res.status(400).json({
      status: "error",
      code: 400,
      message: "Falta parámetro id-customer",
      data: {
        observation: "El parámetro query 'id-customer' es requerido.",
      },
    });
  }

  // 1. Obtener datos personales y estado del cliente
  db.query(
    `
        SELECT c.ID_CLIENTE, c.NOM_CLIENTE, c.APEPAT_CLIENTE, c.APEMAT_CLIENTE, c.RUT_CLIENTE, c.CORREO_CLIENTE, ec.NOM_ESTADO
        FROM CLIENTE c
        LEFT JOIN SITUACION_CLIENTE sc ON c.ID_CLIENTE = sc.ID_CLIENTE AND sc.FEC_HASTA IS NULL
        LEFT JOIN ESTADO_CLIENTE ec ON sc.ID_ESTADO_CLIENTE = ec.ID_ESTADO_CLIENTE
        WHERE c.ID_CLIENTE = ?
    `,
    [idCustomer],
    (err, customerRows) => {
      if (err) {
        return res.status(500).json({
          status: "error",
          code: 500,
          message: "Error interno del servidor",
          data: { observation: err.message },
        });
      }

      if (customerRows.length === 0) {
        return res.status(404).json({
          status: "error",
          code: 404,
          message: "Recurso no encontrado",
          data: {
            observation: "el cliente no existe ",
          },
        });
      }

      const customerInfo = customerRows[0];

      // 2. Obtener direcciones del cliente
      db.query(
        `
            SELECT d.CALLE, d.OBSERVACION, d.ID_TIPO_DIRECCION, com.NOM_COMUNA
            FROM DIRECCION d
            INNER JOIN COMUNA com ON d.ID_COMUNA = com.ID_COMUNA
            WHERE d.ID_CLIENTE = ?
        `,
        [idCustomer],
        (err, addressRows) => {
          if (err) {
            return res.status(500).json({
              status: "error",
              code: 500,
              message: "Error interno del servidor",
              data: { observation: err.message },
            });
          }

          let installationAddress = { street: "", comuna: "" };
          let billingAddress = { street: "", comuna: "" };

          addressRows.forEach((row) => {
            if (row.ID_TIPO_DIRECCION === 1) {
              installationAddress = {
                street:
                  row.CALLE + (row.OBSERVACION ? ` (${row.OBSERVACION})` : ""),
                comuna: row.NOM_COMUNA,
              };
            } else if (row.ID_TIPO_DIRECCION === 2) {
              billingAddress = {
                street:
                  row.CALLE + (row.OBSERVACION ? ` (${row.OBSERVACION})` : ""),
                comuna: row.NOM_COMUNA,
              };
            }
          });

          // 3. Obtener servicios activos (ID_ESTADO_ACTIVO = 2)
          db.query(
            `
                SELECT s.ID_SERVICIO, s.NOM_SERVICIO, p.ID_PRESTACION, p.NOM_PRESTACION
                FROM ACTIVO a
                INNER JOIN SERVICIO s ON a.ID_SERVICIO = s.ID_SERVICIO
                LEFT JOIN PRESTACION_SERVICIO ps ON s.ID_SERVICIO = ps.ID_SERVICIO
                LEFT JOIN PRESTACION p ON ps.ID_PRESTACION = p.ID_PRESTACION
                WHERE a.ID_CLIENTE = ? AND a.ID_ESTADO_ACTIVO = 2
            `,
            [idCustomer],
            (err, serviceRows) => {
              if (err) {
                return res.status(500).json({
                  status: "error",
                  code: 500,
                  message: "Error interno del servidor",
                  data: { observation: err.message },
                });
              }

              const serviceList = formatServiceList(serviceRows);

              // 4. Obtener equipos activos (ID_ESTADO_ACTIVO = 2)
              db.query(
                `
                    SELECT e.ID_EQUIPO, e.NOM_EQUIPO, p.ID_PRESTACION, p.NOM_PRESTACION
                    FROM ACTIVO a
                    INNER JOIN EQUIPO e ON a.ID_EQUIPO = e.ID_EQUIPO
                    LEFT JOIN PRESTACION_EQUIPO pe ON e.ID_EQUIPO = pe.ID_EQUIPO
                    LEFT JOIN PRESTACION p ON pe.ID_PRESTACION = p.ID_PRESTACION
                    WHERE a.ID_CLIENTE = ? AND a.ID_ESTADO_ACTIVO = 2
                `,
                [idCustomer],
                (err, equipmentRows) => {
                  if (err) {
                    return res.status(500).json({
                      status: "error",
                      code: 500,
                      message: "Error interno del servidor",
                      data: { observation: err.message },
                    });
                  }

                  const equipmentList = formatEquipmentList(equipmentRows);

                  res.json({
                    status: "success",
                    code: 200,
                    message: "Solicitud procesada correctamente",
                    data: {
                      customer: {
                        idCustomer: customerInfo.ID_CLIENTE.toString(),
                        name: customerInfo.NOM_CLIENTE,
                        lastName: customerInfo.APEPAT_CLIENTE,
                        motherMaidenName: customerInfo.APEMAT_CLIENTE,
                        dni: customerInfo.RUT_CLIENTE,
                        email: customerInfo.CORREO_CLIENTE,
                        status: customerInfo.NOM_ESTADO || "Sin Estado",
                        address: {
                          installationAddress,
                          billingAddress,
                        },
                      },
                      serviceList,
                      equipmentList,
                    },
                  });
                },
              );
            },
          );
        },
      );
    },
  );
});

// ============================================================================
// SERVICIO # 2: obtener lista de servicios
// GET /work-order-system/get-services
// ============================================================================
app.get("/work-order-system/get-services", (req, res) => {
  const idProvision = req.query["id-provision"];
  const idService = req.query["id-service"];

  if (idService) {
    db.query(
      "SELECT 1 FROM SERVICIO WHERE ID_SERVICIO = ? AND IND_VIGENCIA = TRUE",
      [idService],
      (err, verify) => {
        if (err) {
          return res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor",
            data: { observation: err.message },
          });
        }
        if (verify.length === 0) {
          return res.status(404).json({
            status: "error",
            code: 404,
            message: "Recurso no encontrado",
            data: {
              observation: " No hay servicios vigentes en el sistema",
            },
          });
        }

        db.query(
          `
                SELECT s.ID_SERVICIO, s.NOM_SERVICIO, p.ID_PRESTACION, p.NOM_PRESTACION
                FROM SERVICIO s
                LEFT JOIN PRESTACION_SERVICIO ps ON s.ID_SERVICIO = ps.ID_SERVICIO
                LEFT JOIN PRESTACION p ON ps.ID_PRESTACION = p.ID_PRESTACION
                WHERE s.ID_SERVICIO = ? AND s.IND_VIGENCIA = TRUE
            `,
          [idService],
          (err, rows) => {
            if (err) {
              return res.status(500).json({
                status: "error",
                code: 500,
                message: "Error interno del servidor",
                data: { observation: err.message },
              });
            }
            res.json({
              status: "success",
              code: 200,
              message: "Solicitud procesada correctamente",
              data: {
                serviceList: formatServiceList(rows),
              },
            });
          },
        );
      },
    );
  } else if (idProvision) {
    db.query(
      "SELECT 1 FROM PRESTACION WHERE ID_PRESTACION = ?",
      [idProvision],
      (err, verify) => {
        if (err) {
          return res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor",
            data: { observation: err.message },
          });
        }
        if (verify.length === 0) {
          return res.status(404).json({
            status: "error",
            code: 404,
            message: "Recurso no encontrado",
            data: {
              observation: " No hay servicios vigentes en el sistema",
            },
          });
        }

        db.query(
          `
                SELECT s.ID_SERVICIO, s.NOM_SERVICIO, p.ID_PRESTACION, p.NOM_PRESTACION
                FROM SERVICIO s
                INNER JOIN PRESTACION_SERVICIO ps ON s.ID_SERVICIO = ps.ID_SERVICIO
                INNER JOIN PRESTACION p ON ps.ID_PRESTACION = p.ID_PRESTACION
                WHERE s.IND_VIGENCIA = TRUE AND ps.ID_PRESTACION = ?
            `,
          [idProvision],
          (err, rows) => {
            if (err) {
              return res.status(500).json({
                status: "error",
                code: 500,
                message: "Error interno del servidor",
                data: { observation: err.message },
              });
            }
            res.json({
              status: "success",
              code: 200,
              message: "Solicitud procesada correctamente",
              data: {
                serviceList: formatServiceList(rows),
              },
            });
          },
        );
      },
    );
  } else {
    db.query(
      `
            SELECT s.ID_SERVICIO, s.NOM_SERVICIO, p.ID_PRESTACION, p.NOM_PRESTACION
            FROM SERVICIO s
            LEFT JOIN PRESTACION_SERVICIO ps ON s.ID_SERVICIO = ps.ID_SERVICIO
            LEFT JOIN PRESTACION p ON ps.ID_PRESTACION = p.ID_PRESTACION
            WHERE s.IND_VIGENCIA = TRUE
        `,
      (err, rows) => {
        if (err) {
          return res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor",
            data: { observation: err.message },
          });
        }
        if (rows.length === 0) {
          return res.status(404).json({
            status: "error",
            code: 404,
            message: "Recurso no encontrado",
            data: {
              observation: " No hay servicios vigentes en el sistema",
            },
          });
        }
        res.json({
          status: "success",
          code: 200,
          message: "Solicitud procesada correctamente",
          data: {
            serviceList: formatServiceList(rows),
          },
        });
      },
    );
  }
});

// ============================================================================
// SERVICIO # 3: obtener lista de equipos
// GET /work-order-system/get-equipment
// ============================================================================
app.get("/work-order-system/get-equipment", (req, res) => {
  const idProvision = req.query["id-provision"];
  const idEquipment = req.query["id-equipment"];

  if (idEquipment) {
    db.query(
      "SELECT 1 FROM EQUIPO WHERE ID_EQUIPO = ? AND IND_VIGENCIA = TRUE",
      [idEquipment],
      (err, verify) => {
        if (err) {
          return res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor",
            data: { observation: err.message },
          });
        }
        if (verify.length === 0) {
          return res.status(404).json({
            status: "error",
            code: 404,
            message: "Recurso no encontrado",
            data: {
              observation: " No hay equipos vigentes en el sistema",
            },
          });
        }

        db.query(
          `
                SELECT e.ID_EQUIPO, e.NOM_EQUIPO, p.ID_PRESTACION, p.NOM_PRESTACION
                FROM EQUIPO e
                LEFT JOIN PRESTACION_EQUIPO pe ON e.ID_EQUIPO = pe.ID_EQUIPO
                LEFT JOIN PRESTACION p ON pe.ID_PRESTACION = p.ID_PRESTACION
                WHERE e.ID_EQUIPO = ? AND e.IND_VIGENCIA = TRUE
            `,
          [idEquipment],
          (err, rows) => {
            if (err) {
              return res.status(500).json({
                status: "error",
                code: 500,
                message: "Error interno del servidor",
                data: { observation: err.message },
              });
            }
            res.json({
              status: "success",
              code: 200,
              message: "Solicitud procesada correctamente",
              data: {
                equipmentList: formatEquipmentList(rows),
              },
            });
          },
        );
      },
    );
  } else if (idProvision) {
    db.query(
      "SELECT 1 FROM PRESTACION WHERE ID_PRESTACION = ?",
      [idProvision],
      (err, verify) => {
        if (err) {
          return res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor",
            data: { observation: err.message },
          });
        }
        if (verify.length === 0) {
          return res.status(404).json({
            status: "error",
            code: 404,
            message: "Recurso no encontrado",
            data: {
              observation: " No hay equipos vigentes en el sistema",
            },
          });
        }

        db.query(
          `
                SELECT e.ID_EQUIPO, e.NOM_EQUIPO, p.ID_PRESTACION, p.NOM_PRESTACION
                FROM EQUIPO e
                INNER JOIN PRESTACION_EQUIPO pe ON e.ID_EQUIPO = pe.ID_EQUIPO
                INNER JOIN PRESTACION p ON pe.ID_PRESTACION = p.ID_PRESTACION
                WHERE e.IND_VIGENCIA = TRUE AND pe.ID_PRESTACION = ?
            `,
          [idProvision],
          (err, rows) => {
            if (err) {
              return res.status(500).json({
                status: "error",
                code: 500,
                message: "Error interno del servidor",
                data: { observation: err.message },
              });
            }
            res.json({
              status: "success",
              code: 200,
              message: "Solicitud procesada correctamente",
              data: {
                equipmentList: formatEquipmentList(rows),
              },
            });
          },
        );
      },
    );
  } else {
    db.query(
      `
            SELECT e.ID_EQUIPO, e.NOM_EQUIPO, p.ID_PRESTACION, p.NOM_PRESTACION
            FROM EQUIPO e
            LEFT JOIN PRESTACION_EQUIPO pe ON e.ID_EQUIPO = pe.ID_EQUIPO
            LEFT JOIN PRESTACION p ON pe.ID_PRESTACION = p.ID_PRESTACION
            WHERE e.IND_VIGENCIA = TRUE
        `,
      (err, rows) => {
        if (err) {
          return res.status(500).json({
            status: "error",
            code: 500,
            message: "Error interno del servidor",
            data: { observation: err.message },
          });
        }
        if (rows.length === 0) {
          return res.status(404).json({
            status: "error",
            code: 404,
            message: "Recurso no encontrado",
            data: {
              observation: " No hay equipos vigentes en el sistema",
            },
          });
        }
        res.json({
          status: "success",
          code: 200,
          message: "Solicitud procesada correctamente",
          data: {
            equipmentList: formatEquipmentList(rows),
          },
        });
      },
    );
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
