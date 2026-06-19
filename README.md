# Clínica Belleza — Sistema de Reservas Online

Sistema de reservas para clínicas de estética con panel de administración, autenticación de usuarios y base de datos en tiempo real. Construido con Vanilla JS y Firebase. Sin backend propio, sin frameworks, sin servidor que mantener.

---

## El problema

Las clínicas pequeñas gestionan sus citas por WhatsApp o teléfono. Eso significa que alguien tiene que estar disponible para responder, que los horarios se cruzan con facilidad, y que no existe ningún registro estructurado de qué cliente reservó qué servicio y cuándo.

El resultado directo es tiempo perdido, citas duplicadas y clientes que se van a la competencia porque nadie contestó a tiempo. Y cuando la clínica quiere revisar su agenda, no tiene un sistema centralizado: todo está disperso en conversaciones de WhatsApp o en una libreta.

---

## La solución

Dos interfaces distintas para dos usuarios distintos.

El cliente gestiona sus propias citas sin intermediarios. Se registra con su correo, elige servicio, fecha y hora, y la reserva queda guardada en la nube al instante. Puede consultar su historial y cancelar cuando necesite.

La clínica accede a un panel de administración donde ve todas las reservas de todos los clientes en una tabla ordenada por fecha, con estadísticas en tiempo real y filtros por día y semana. Puede cancelar cualquier cita desde el panel.

El sistema distingue automáticamente entre los dos roles al hacer login y redirige a cada usuario a su vista correspondiente.

---

## Stack técnico

| Capa | Tecnología | Decisión |
|---|---|---|
| Interfaz | HTML5 semántico + CSS custom properties | Sin frameworks — control total del DOM y los estilos |
| Lógica | Vanilla JavaScript ES Modules | Sin dependencias — código portable y fácil de auditar |
| Autenticación | Firebase Auth | Registro, login y gestión de sesión sin servidor propio |
| Base de datos | Cloud Firestore | NoSQL en tiempo real con sistema de roles por colección |

---

## Sistema de roles

Cada usuario tiene un documento en la colección `usuarios` de Firestore con un campo `rol`:

```
usuarios/
  ├── uid-del-paciente
  │     ├── email: "paciente@email.com"
  │     └── rol: "paciente"
  │
  └── uid-de-la-clinica
        ├── email: "clinica@belleza.com"
        └── rol: "admin"
```

Al hacer login, la app lee ese campo y decide qué mostrar. Si el rol es `admin`, redirige al panel de administración. Si es `paciente`, muestra el formulario de reservas personal. Un paciente que intente acceder directamente a `admin.html` ve una pantalla de acceso denegado.

---

## Decisiones técnicas relevantes

**`onAuthStateChanged` como única fuente de verdad del estado de sesión.** Toda la lógica de mostrar u ocultar vistas depende de este listener. Funciona al cargar la página, al hacer login y al hacer logout sin código adicional.

**`onSnapshot` en lugar de lecturas únicas.** Tanto la lista del paciente como la tabla del admin se suscriben a Firestore en tiempo real. Cualquier cambio actualiza el DOM automáticamente. El listener se cancela al cerrar sesión para evitar memory leaks.

**Filtrado por `uid` en la query del paciente.** Cada documento en Firestore almacena el `uid` del usuario que lo creó. La consulta filtra por ese campo, de forma que un usuario nunca puede ver ni modificar reservas ajenas, aunque conozca el ID del documento.

**Sin filtro de `uid` en el panel admin.** La query del administrador recupera todos los documentos de la colección `reservas` ordenados por fecha. La verificación del rol ocurre antes de ejecutar esa query — si el usuario no es admin, el código no llega a pedirle nada a Firestore.

---

## Estructura del proyecto

```
clinica-reservas/
├── index.html   — Interfaz del paciente: login, registro y gestión de citas
├── app.js       — Lógica del paciente: Auth + Firestore + sistema de roles
├── admin.html   — Panel de la clínica: tabla de reservas, stats y filtros
└── admin.js     — Lógica del admin: verificación de rol + todas las reservas
```

---

## Cómo ejecutarlo

```bash
git clone https://github.com/Stanvanger/clinica-reservas.git
cd clinica-reservas
```

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Activa Authentication con proveedor Correo electrónico/contraseña
3. Activa Firestore Database en modo de prueba
4. Sustituye el objeto `firebaseConfig` en `app.js` y `admin.js` con tus credenciales
5. Crea el usuario admin en Firebase Authentication
6. Crea su documento en Firestore: colección `usuarios`, ID = uid del admin, campos `email` y `rol: "admin"`
7. Abre `index.html` con Live Server (VS Code) o cualquier servidor local

---

## Accesibilidad

La interfaz cumple los criterios básicos de WCAG 2.1 nivel AA: skip link para navegación por teclado, todos los controles con `<label>` asociado, mensajes de error y confirmación con `aria-live="polite"`, foco visible en todos los elementos interactivos, soporte para `prefers-reduced-motion`.

---

## Autora

Carolina Quintero — Desarrollo Frontend  
[github.com/Stanvanger](https://github.com/Stanvanger) · [digitalhome.website](https://digitalhome.website)
