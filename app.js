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
  doc,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

/* ─── CONFIGURACIÓN ───────────────────────────────────────────────── */

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

/* ─── REFERENCIAS DOM ─────────────────────────────────────────────── */

const seccionAuth    = document.getElementById("seccion-auth");
const seccionReserva = document.getElementById("seccion-reserva");
const seccionLista   = document.getElementById("seccion-lista");
const alertaAuth     = document.getElementById("alerta-auth");
const alertaReserva  = document.getElementById("alerta-reserva");
const sesionInfo     = document.getElementById("sesion-info");
const formReserva    = document.getElementById("form-reserva");
const listaReservas  = document.getElementById("lista-reservas");

/* ─── UTILIDADES ──────────────────────────────────────────────────── */

function mostrarAlerta(el, texto, tipo) {
  el.textContent = texto;
  el.className = `alert alert--${tipo}`;
  el.setAttribute("aria-live", "polite");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.removeAttribute("aria-live");
    el.textContent = "";
    el.className = "alert";
  }, 5000);
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return "";
  const [anio, mes, dia] = fechaISO.split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(dia)} ${meses[parseInt(mes) - 1]} ${anio}`;
}

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

/* ─── ROL DEL USUARIO ─────────────────────────────────────────────── */

/**
 * Lee el documento del usuario en la colección "usuarios" de Firestore.
 * Si existe y tiene rol "admin", devuelve "admin".
 * Si no existe o tiene otro rol, devuelve "paciente".
 */
async function obtenerRol(uid) {
  const docRef  = doc(db, "usuarios", uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists() && docSnap.data().rol === "admin") {
    return "admin";
  }
  return "paciente";
}

/* ─── VISTAS ──────────────────────────────────────────────────────── */

function mostrarLogin() {
  seccionAuth.removeAttribute("hidden");
  seccionReserva.setAttribute("hidden", "");
  seccionLista.setAttribute("hidden", "");
}

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
    const resultado = await createUserWithEmailAndPassword(auth, email, password);

    // Al registrarse, guardamos su documento en "usuarios" con rol "paciente"
    await setDoc(doc(db, "usuarios", resultado.user.uid), {
      email: resultado.user.email,
      rol:   "paciente"
    });

  } catch (e) {
    mostrarAlerta(alertaAuth, mensajeError(e.code), "error");
  }
});

/* ─── AUTH: LOGOUT ────────────────────────────────────────────────── */

document.getElementById("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
});

/* ─── AUTH: ESTADO DE SESIÓN ──────────────────────────────────────── */

let unsubscribeReservas = null;

onAuthStateChanged(auth, async (usuario) => {
  if (usuario) {
    // Leer su rol en Firestore
    const rol = await obtenerRol(usuario.uid);

    if (rol === "admin") {
      // Si es admin, redirigir al panel de administración
      window.location.href = "admin.html";
      return;
    }

    // Si es paciente, mostrar la app normal
    mostrarApp(usuario);
    unsubscribeReservas = escucharReservas(usuario.uid);

  } else {
    mostrarLogin();
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

  if (!nombre || !servicio || !fecha || !hora) {
    mostrarAlerta(alertaReserva, "Rellena todos los campos antes de confirmar.", "error");
    return;
  }

  const hoy = new Date().toISOString().split("T")[0];
  if (fecha < hoy) {
    mostrarAlerta(alertaReserva, "La fecha no puede ser anterior a hoy.", "error");
    return;
  }

  const btnReservar = document.getElementById("btnReservar");
  btnReservar.disabled = true;
  btnReservar.textContent = "Guardando…";

  try {
    await addDoc(collection(db, "reservas"), {
      nombre,
      servicio,
      fecha,
      hora,
      email:    usuario.email,
      uid:      usuario.uid,
      creadoEn: serverTimestamp()
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

/* ─── FIRESTORE: ESCUCHAR RESERVAS DEL PACIENTE ──────────────────── */

function escucharReservas(uid) {
  const q = query(
    collection(db, "reservas"),
    where("uid", "==", uid),
    orderBy("fecha", "asc")
  );

  return onSnapshot(q, (snapshot) => {
    listaReservas.innerHTML = "";

    if (snapshot.empty) {
      listaReservas.innerHTML = `
        <li class="empty-state" role="status">
          <p>Aún no tienes reservas. ¡Reserva tu primera cita!</p>
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

    listaReservas.querySelectorAll("[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => borrarReserva(btn.dataset.id, btn));
    });
  });
}

/* ─── FIRESTORE: BORRAR RESERVA ───────────────────────────────────── */

async function borrarReserva(id, btn) {
  btn.disabled = true;
  btn.textContent = "Cancelando…";
  try {
    await deleteDoc(doc(db, "reservas", id));
  } catch {
    btn.disabled = false;
    btn.textContent = "Cancelar";
    mostrarAlerta(alertaReserva, "No se pudo cancelar la reserva.", "error");
  }
}