# OttoBot

Aplicación web (React + TypeScript + Vite) para controlar un robot **Otto** por Bluetooth (Web Bluetooth API) usando una placa **ESP32**. Permite crear, guardar y reproducir coreografías de movimientos sincronizadas con música (YouTube o audio local).

![Otto Robot](src/assets/hero.png)

## Arquitectura

El proyecto tiene tres partes:

| Componente | Descripción | Tecnología |
|---|---|---|
| **Frontend** | App web servida por Nginx. Se conecta al robot vía Web Bluetooth y consume la API del backend para guardar coreografías. | React 19, Vite, TypeScript, Tailwind CSS, Radix UI |
| **Backend** | API REST que persiste las coreografías y resuelve la duración de vídeos de YouTube. | Node.js, Express, MySQL (`mysql2`) |
| **Firmware** | Sketch que corre en el ESP32 y ejecuta los comandos recibidos por Bluetooth moviendo los 4 servos del robot. | Arduino / ESP32Servo |

```
Navegador (Web Bluetooth) ──BLE──> ESP32 (arduino/otto-ble)
       │
       │ HTTP (/api)
       ▼
Nginx (frontend) ──proxy──> Backend (Express) ──> MySQL
```

## Estructura del repositorio

```
├── src/                  # Frontend (React)
│   ├── components/       # Pantallas: connect, choreography, library, play, bottom-nav
│   └── lib/ottoBluetooth.ts  # Cliente Web Bluetooth
├── backend/              # API REST (Express + MySQL)
│   └── src/
│       ├── index.ts      # Bootstrap del servidor
│       ├── routes.ts     # Endpoints /api/choreographies
│       └── db.ts         # Pool de conexión MySQL
├── mysql/                # init.sql y configuración de MySQL
├── arduino/otto-ble/     # Firmware del ESP32
├── Dockerfile            # Build del frontend (nginx)
├── backend/Dockerfile    # Build del backend
├── nginx.conf            # SPA + proxy /api -> backend
└── docker-compose.yml    # Orquestación completa (mysql + backend + frontend)
```

## Requisitos

- Node.js 22+ y npm
- Docker y Docker Compose (para desplegar todo junto)
- Una placa **ESP32** con 4 servos conectados a los pines **27, 26, 12 y 14**
- Chrome o Edge en escritorio (Web Bluetooth no está soportado en Firefox/Safari)
- La app debe servirse en **localhost o HTTPS**: Web Bluetooth está bloqueado en `file://` y en HTTP sin TLS

## Flashear el ESP32

1. Abre [arduino/otto-ble/otto-ble.ino](arduino/otto-ble/otto-ble.ino) en Arduino IDE.
2. Instala el paquete de placas ESP32 y la librería `ESP32Servo`.
3. Selecciona la placa ESP32 y el puerto correctos.
4. Sube el sketch.
5. (Opcional) Abre el Monitor Serie a 115200 baudios para probar comandos por USB.

El firmware expone un dispositivo BLE llamado **`Otto-BT-001`** y acepta estos comandos: `WALK_F`, `WALK_B`, `TURN_L`, `TURN_R`, `SHAKE`, `JUMP`, `MOONWALK`, `SPIN`, `TILT_L`, `TILT_R`, `STOMP`, `WIGGLE`, `BEEP`, `MELODY`, `PAUSE`, `FREEZE`, y `D` para la rutina "Smooth Criminal".

## Cómo montarlo (desarrollo local)

### 1. Frontend

```bash
npm install
npm run dev
```

Esto levanta Vite en `http://localhost:5173` (HTTPS no es necesario porque `localhost` ya es un contexto seguro para Web Bluetooth).

### 2. Backend

Necesita una instancia de MySQL accesible. Puedes levantar solo la base de datos con Docker:

```bash
docker compose up -d mysql
```

Luego, en `backend/`:

```bash
cd backend
npm install
npm run dev
```

Variables de entorno del backend (ver [backend/src/db.ts](backend/src/db.ts)):

| Variable | Descripción | Default en docker-compose |
|---|---|---|
| `DB_HOST` | Host de MySQL | `mysql` |
| `DB_PORT` | Puerto de MySQL | `3306` |
| `DB_USER` | Usuario | `otto` |
| `DB_PASSWORD` | Contraseña | `otto` |
| `DB_NAME` | Base de datos | `ottodance` |
| `PORT` | Puerto donde escucha la API | `3000` |

El backend espera a que MySQL esté disponible antes de arrancar (`waitForDb`) y expone:

- `GET /health` — healthcheck
- `GET /api/choreographies` — lista coreografías
- `POST /api/choreographies` — crea una coreografía
- `PUT /api/choreographies/:id` — actualiza una coreografía
- `DELETE /api/choreographies/:id` — elimina una coreografía
- `GET /api/choreographies/youtube-duration?url=...` — obtiene la duración de un vídeo de YouTube

### 3. Conectar el robot desde la web app

1. Con el ESP32 flasheado y encendido, abre la pantalla **Connect** en la app.
2. Pulsa **Connect Robot**.
3. Empareja con el dispositivo `Otto-BT-001`.
4. Crea una coreografía y pulsa **Play**.

## Despliegue con Docker Compose

El [docker-compose.yml](docker-compose.yml) levanta los tres servicios (MySQL, backend y frontend con Nginx) con un único comando:

```bash
docker compose up -d --build
```

Servicios y puertos expuestos:

| Servicio | Contenedor | Puerto host | Notas |
|---|---|---|---|
| `mysql` | `otto-mysql` | interno | datos persistidos en el volumen `mysql_data`, inicializado con [mysql/init.sql](mysql/init.sql) |
| `backend` | `otto-backend` | `3000` | espera a que MySQL pase el healthcheck |
| `ottobot` (frontend) | `ottobot` | `8080` → `80` | sirve el build de producción y hace proxy de `/api` al backend (ver [nginx.conf](nginx.conf)) |

Tras el despliegue, la app queda disponible en `http://<host>:8080`.

> **Importante:** Web Bluetooth exige un **contexto seguro** (HTTPS o `localhost`). Si vas a desplegar en un servidor accesible por red/dominio, coloca un reverse proxy con TLS (p. ej. Nginx/Caddy/Traefik con certificado) delante del puerto 8080, o sirve directamente por HTTPS. Sin TLS, el botón "Connect Robot" no funcionará fuera de `localhost`.

Para cambiar las credenciales de MySQL o el puerto expuesto, edita las variables de entorno en `docker-compose.yml` (mantén consistentes las variables `DB_*` entre el servicio `mysql` y `backend`).

### Parar y limpiar

```bash
docker compose down          # detiene los contenedores
docker compose down -v       # además borra el volumen de datos de MySQL
```

## Build de producción (sin Docker)

```bash
npm run build                  # genera dist/ (frontend)
cd backend && npm run build    # genera backend/dist/ (backend)
```

## Scripts disponibles

**Frontend** (`package.json`):

- `npm run dev` — servidor de desarrollo con HMR
- `npm run build` — type-check + build de producción a `dist/`
- `npm run lint` — ESLint
- `npm run preview` — sirve el build de `dist/` localmente

**Backend** (`backend/package.json`):

- `npm run dev` — servidor con recarga automática (`ts-node-dev`)
- `npm run build` — compila TypeScript a `dist/`
- `npm run start` — ejecuta el build compilado
