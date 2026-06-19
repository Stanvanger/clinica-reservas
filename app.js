/**
 * app.js — Clínica Belleza · Sistema de reservas
 * Stack: Vanilla JS + Firebase Auth + Cloud Firestore (CDN)
 * Buenas prácticas: separación de responsabilidades, sin DOM spaghetti,
 * manejo de errores, feedback accesible con aria-live.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

/* ─── CONFIGURACIÓN FIREBASE ──────────────────────────────────────── */

const firebaseConfig = {
  apiKey:            "AIzaSyBb5HdgVBBD5Rf0kRxWN2YFBZqgRmJHXTQ",
  authDomain:        "mi-app-firebase-25939.firebaseapp.com",
  projectId:         "mi-app-firebase-25939",
  storageBucket:     "mi-app-firebase-25939.firebasestorage.app",
  messagingSenderId: "593083622594",
  appId:             "1:593083622594:web:4c89593180eb58a1a1075b"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ─── REFERENCIAS AL DOM ──────────────────────────────────────────── */

const seccionAuth    = document.getElementById("seccion-auth");
const seccionReserva = document.getElementById("seccion-reserva");
const seccionLista   = document.getElementById("seccion-lista");

const alertaAuth    = document.getElementById("alerta-auth");
const alertaReserva = document.getElementById("alerta-reserva");
const sesionInfo    = document.getElementById("sesion-info");
const formReserva   = document.getElementById("form-reserva");
const listaReservas = document.getElementById("lista-reservas");

/* ─── UTILIDADES ──────────────────────────────────────────────────── */

/**
 * Muestra un mensaje de feedback accesible en un elemento aria-live.
 * @param {HTMLElement} el    - Contenedor del mensaje
 * @param {string}      texto - Texto a mostrar
 * @param {'ok'|'error'} tipo - Tipo de alerta
 */
function mostrarAlerta(el, texto, tipo) {
  el.textContent = texto;
  el.className = `alert alert--${tipo}`;
  el.setAttribute("aria-live", "polite");
  // Ocultar automáticamente tras 5 segundos
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.removeAttribute("aria-live");
    el.textContent = "";
    el.className = "alert";
  }, 5000);
}

/**
 * Formatea una fecha ISO (YYYY-MM-DD) a formato legible en español.
 * @param {string} fechaISO
 * @returns {string} Ej: "30 jun 2026"
 */
function formatearFecha(fechaISO) {
  if (!fechaISO) return "";
  const [anio, mes, dia] = fechaISO.split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(dia)} ${meses[parseInt(mes) - 1]} ${anio}`;
}

/**
 * Traduce los códigos de error de Firebase Auth a mensajes en español.
 * @param {string} codigo
 * @returns {string}
 */
function mensajeError(codigo) {
  const errores = {
    "auth/user-not-found":       "No existe una cuenta con ese correo.",
    "auth/wrong-password":       "Contraseña incorrecta.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
    "auth/weak-password":        "La contraseña debe tener al menos 6 caracteres.",
    "auth/invalid-email":        "El formato del correo no es válido.",
    "auth/invalid-credential":   "Correo o contraseña incorrectos.",
    "auth/too-many-requests":    "Demasiados intentos. Espera un momento.",
  };
  return errores[codigo] || "Ha ocurrido un error. Inténtalo de nuevo.";
}

/* ─── VISTAS ──────────────────────────────────────────────────────── */

/** Muestra la sección de login y oculta las demás. */
function mostrarLogin() {
  seccionAuth.removeAttribute("hidden");
  seccionReserva.setAttribute("hidden", "");
  seccionLista.setAttribute("hidden", "");
}

/** Muestra el formulario y la lista, oculta el login. */
function mostrarApp(usuario) {
  seccionAuth.setAttribute("hidden", "");
  seccionReserva.removeAttribute("hidden");
  seccionLista.removeAttribute("hidden");
  sesionInfo.textContent = usuario.email;
}

/* ─── AUTH: LOGIN ─────────────────────────────────────────────────── */

document.getElementById("btnLogin").addEventListener("click", async () => {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    mostrarAlerta(alertaAuth, "Rellena el correo y la contraseña.", "error");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged se encarga del resto
  } catch (e) {
    mostrarAlerta(alertaAuth, mensajeError(e.code), "error");
  }
});

/* ─── AUTH: REGISTRO ──────────────────────────────────────────────── */

document.getElementById("btnRegistrar").addEventListener("click", async () => {
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    mostrarAlerta(alertaAuth, "Rellena el correo y la contraseña.", "error");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged se encarga del resto
  } catch (e) {
    mostrarAlerta(alertaAuth, mensajeError(e.code), "error");
  }
});

/* ─── AUTH: LOGOUT ────────────────────────────────────────────────── */

document.getElementById("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
});

/* ─── AUTH: ESTADO DE SESIÓN ──────────────────────────────────────── */

// Esta función se ejecuta automáticamente cuando cambia el estado de sesión:
// al hacer login, al hacer logout, y al cargar la página por primera vez.
let unsubscribeReservas = null; // Para cancelar el listener de Firestore al hacer logout

onAuthStateChanged(auth, (usuario) => {
  if (usuario) {
    mostrarApp(usuario);
    unsubscribeReservas = escucharReservas(usuario.uid);
  } else {
    mostrarLogin();
    // Cancelar el listener de Firestore para no dejar conexiones abiertas
    if (unsubscribeReservas) {
      unsubscribeReservas();
      unsubscribeReservas = null;
    }
    listaReservas.innerHTML = "";
  }
});

/* ─── FIRESTORE: GUARDAR RESERVA ──────────────────────────────────── */

formReserva.addEventListener("submit", async (e) => {
  e.preventDefault();

  const usuario  = auth.currentUser;
  const nombre   = document.getElementById("nombre").value.trim();
  const servicio = document.getElementById("servicio").value;
  const fecha    = document.getElementById("fecha").value;
  const hora     = document.getElementById("hora").value;

  // Validación manual antes de enviar a Firebase
  if (!nombre || !servicio || !fecha || !hora) {
    mostrarAlerta(alertaReserva, "Rellena todos los campos antes de confirmar.", "error");
    return;
  }

  // Evitar fechas pasadas
  const hoy = new Date().toISOString().split("T")[0];
  if (fecha < hoy) {
    mostrarAlerta(alertaReserva, "La fecha no puede ser anterior a hoy.", "error");
    return;
  }

  const btnReservar = document.getElementById("btnReservar");
  btnReservar.disabled = true;
  btnReservar.textContent = "Guardando…";

  try {
    // addDoc crea un documento nuevo con ID automático en la colección "reservas"
    await addDoc(collection(db, "reservas"), {
      nombre,
      servicio,
      fecha,
      hora,
      email:     usuario.email,
      uid:       usuario.uid,          // Para filtrar reservas por usuario
      creadoEn:  serverTimestamp()     // Timestamp del servidor, no del cliente
    });

    mostrarAlerta(alertaReserva, `Reserva confirmada: ${servicio} el ${formatearFecha(fecha)} a las ${hora}.`, "ok");
    formReserva.reset();

  } catch {
    mostrarAlerta(alertaReserva, "No se pudo guardar la reserva. Inténtalo de nuevo.", "error");
  } finally {
    btnReservar.disabled = false;
    btnReservar.textContent = "Confirmar reserva";
  }
});

/* ─── FIRESTORE: ESCUCHAR RESERVAS EN TIEMPO REAL ────────────────── */

/**
 * Suscribe al usuario a sus reservas en tiempo real.
 * Cada vez que Firestore cambia (nueva reserva, borrado), el DOM se actualiza solo.
 * Devuelve la función para cancelar la suscripción (importante para cleanup).
 *
 * @param {string} uid - ID del usuario autenticado
 * @returns {Function} unsubscribe
 */
function escucharReservas(uid) {
  // query() filtra documentos: solo los que tienen uid == el del usuario actual
  // orderBy() los ordena por fecha ascendente
  const q = query(
    collection(db, "reservas"),
    where("uid", "==", uid),
    orderBy("fecha", "asc")
  );

  // onSnapshot se ejecuta inmediatamente y cada vez que hay cambios
  return onSnapshot(q, (snapshot) => {
    listaReservas.innerHTML = "";

    if (snapshot.empty) {
      listaReservas.innerHTML = `
        <li class="empty-state" role="status">
          <p aria-hidden="true">🌿</p>
          <p>Aún no tienes reservas.<br>¡Reserva tu primera cita!</p>
        </li>
      `;
      return;
    }

    snapshot.forEach((documento) => {
      const r  = documento.data();
      const li = document.createElement("li");
      li.className = "reserva-item";
      li.setAttribute("aria-label", `Reserva de ${r.servicio} el ${formatearFecha(r.fecha)} a las ${r.hora}`);

      li.innerHTML = `
        <div>
          <p class="reserva-item__fecha">${formatearFecha(r.fecha)} · ${r.hora}</p>
          <p class="reserva-item__servicio">${r.servicio}</p>
          <p class="reserva-item__nombre">${r.nombre}</p>
        </div>
        <button
          class="btn btn--ghost btn--sm"
          type="button"
          aria-label="Cancelar reserva de ${r.servicio} el ${formatearFecha(r.fecha)}"
          data-id="${documento.id}"
        >
          Cancelar
        </button>
      `;

      listaReservas.appendChild(li);
    });

    // Delegar eventos de borrado en los botones recién creados
    listaReservas.querySelectorAll("[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => borrarReserva(btn.dataset.id, btn));
    });
  });
}

/* ─── FIRESTORE: BORRAR RESERVA ───────────────────────────────────── */

/**
 * Elimina un documento de Firestore por su ID.
 * @param {string}      id  - ID del documento
 * @param {HTMLElement} btn - Botón que disparó la acción (para feedback)
 */
async function borrarReserva(id, btn) {
  btn.disabled = true;
  btn.textContent = "Cancelando…";

  try {
    // doc() localiza el documento exacto dentro de la colección "reservas"
    await deleteDoc(doc(db, "reservas", id));
    // onSnapshot actualiza la lista automáticamente — no hace falta recargar
  } catch {
    btn.disabled = false;
    btn.textContent = "Cancelar";
    mostrarAlerta(alertaReserva, "No se pudo cancelar la reserva.", "error");
  }
}