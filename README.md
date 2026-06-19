## El problema

Las clínicas pequeñas gestionan sus citas por WhatsApp o teléfono. Eso significa que alguien tiene que estar disponible para responder, que los horarios se cruzan con facilidad, y que no existe ningún registro estructurado de qué cliente reservó qué servicio y cuándo.

El resultado directo es tiempo perdido, citas duplicadas y clientes que se van a la competencia porque nadie contestó a tiempo.

---

## La solución

Una aplicación web donde el cliente gestiona sus propias citas sin intermediarios. Se registra con su correo, elige servicio, fecha y hora, y la reserva queda guardada en la nube al instante. Puede consultar su historial y cancelar cuando necesite. La clínica deja de depender de que alguien esté al teléfono.

Cada usuario accede únicamente a sus propios datos. Las actualizaciones son en tiempo real: si se cancela una cita, desaparece de la lista sin recargar la página.

---

## Stack técnico

| Capa | Tecnología | Decisión |
|---|---|---|
| Interfaz | HTML5 semántico + CSS custom properties | Sin frameworks — control total del DOM y los estilos |
| Lógica | Vanilla JavaScript ES Modules | Sin dependencias — código portable y fácil de auditar |
| Autenticación | Firebase Auth | Registro, login y gestión de sesión sin servidor propio |
| Base de datos | Cloud Firestore | NoSQL en tiempo real con filtrado por usuario vía `uid` |

---

## Decisiones técnicas relevantes

**`onAuthStateChanged` como única fuente de verdad del estado de sesión.** En lugar de gestionar el estado del usuario manualmente, toda la lógica de mostrar u ocultar vistas depende de este listener. Funciona al cargar la página, al hacer login y al hacer logout sin código adicional.

**`onSnapshot` en lugar de lecturas únicas.** La lista de reservas se suscribe a Firestore en tiempo real. Cualquier cambio —nueva reserva, cancelación— actualiza el DOM automáticamente. El listener se cancela al cerrar sesión para evitar memory leaks.

**Filtrado por `uid` en la query.** Cada documento en Firestore almacena el `uid` del usuario que lo creó. La consulta filtra por ese campo, de forma que un usuario nunca puede ver ni modificar reservas ajenas, aunque conozca el ID del documento.

---

## Cómo ejecutarlo

```bash
git clone https://github.com/Stanvanger/clinica-reservas.git
cd clinica-reservas
```

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Activa Authentication con proveedor Correo electrónico/contraseña
3. Activa Firestore Database en modo de prueba
4. Sustituye el objeto `firebaseConfig` en `app.js` con tus credenciales
5. Abre `index.html` con Live Server (VS Code) o cualquier servidor local

---

## Accesibilidad

La interfaz cumple los criterios básicos de WCAG 2.1 nivel AA: skip link para navegación por teclado, todos los controles con `<label>` asociado, mensajes de error y confirmación con `aria-live="polite"`, foco visible en todos los elementos interactivos, soporte para `prefers-reduced-motion`.

---

## Estructura

```
clinica-reservas/
├── index.html   # Marcado semántico y sistema de estilos
└── app.js       # Lógica de autenticación y base de datos
```

## Autora
Carolina Quintero — Desarrollo Frontend  
[github.com/Stanvanger](https://github.com/Stanvanger) · [digitalhome.website](https://digitalhome.website)
