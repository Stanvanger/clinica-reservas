import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  deleteDoc
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

const seccionAdmin          = document.getElementById("seccion-admin");
const seccionAccesoDenegado = document.getElementById("seccion-acceso-denegado");
const adminEmail            = document.getElementById("admin-email");
const tablaBody             = document.getElementById("tabla-body");
const alertaAdmin           = document.getElementById("alerta-admin");

/* ─── UTILIDADES ──────────────────────────────────────────────────── */

function formatearFecha(fechaISO) {
  if (!fechaISO) return "";
  const [anio, mes, dia] = fechaISO.split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(dia)} ${meses[parseInt(mes) - 1]} ${anio}`;
}

function mostrarAlerta(texto) {
  alertaAdmin.textContent = texto;
  alertaAdmin.className = "alert alert--error";
  alertaAdmin.setAttribute("aria-live", "polite");
  clearTimeout(alertaAdmin._timer);
  alertaAdmin._timer = setTimeout(() => {
    alertaAdmin.removeAttribute("aria-live");
    alertaAdmin.textContent = "";
    alertaAdmin.className = "alert";
  }, 5000);
}

/* ─── FILTROS ─────────────────────────────────────────────────────── */

// Guardamos todas las reservas para filtrar sin volver a pedir a Firestore
let todasLasReservas = [];
let filtroActivo = "todas";

function aplicarFiltro(reservas) {
  const hoy = new Date().toISOString().split("T")[0];

  // Calcular inicio y fin de la semana actual
  const ahora    = new Date();
  const diaSemana = ahora.getDay() === 0 ? 6 : ahora.getDay() - 1; // lunes = 0
  const inicioSemana = new Date(ahora);
  inicioSemana.setDate(ahora.getDate() - diaSemana);
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(inicioSemana.getDate() + 6);

  const inicioStr = inicioSemana.toISOString().split("T")[0];
  const finStr    = finSemana.toISOString().split("T")[0];

  if (filtroActivo === "hoy") {
    return reservas.filter(r => r.fecha === hoy);
  }
  if (filtroActivo === "semana") {
    return reservas.filter(r => r.fecha >= inicioStr && r.fecha <= finStr);
  }
  return reservas; // "todas"
}

/* ─── RENDERIZAR TABLA ────────────────────────────────────────────── */

function renderizarTabla(reservas) {
  tablaBody.innerHTML = "";

  const filtradas = aplicarFiltro(reservas);

  if (filtradas.length === 0) {
    tablaBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          No hay reservas para este filtro.
        </td>
      </tr>
    `;
    return;
  }

  filtradas.forEach(({ id, datos }) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <strong>${formatearFecha(datos.fecha)}</strong><br>
        <span style="color:var(--color-muted); font-size:.85rem">${datos.hora}</span>
      </td>
      <td>${datos.nombre}</td>
      <td><span class="badge-servicio">${datos.servicio}</span></td>
      <td style="color:var(--color-muted); font-size:.85rem">${datos.email}</td>
      <td>
        <button
          class="btn-borrar-admin"
          type="button"
          data-id="${id}"
          aria-label="Cancelar reserva de ${datos.nombre} el ${formatearFecha(datos.fecha)}"
        >
          Cancelar
        </button>
      </td>
    `;
    tablaBody.appendChild(tr);
  });

  // Eventos de borrado
  tablaBody.querySelectorAll(".btn-borrar-admin").forEach(btn => {
    btn.addEventListener("click", () => borrarReserva(btn.dataset.id, btn));
  });
}

/* ─── STATS ───────────────────────────────────────────────────────── */

function actualizarStats(reservas) {
  const hoy = new Date().toISOString().split("T")[0];

  const ahora     = new Date();
  const diaSemana = ahora.getDay() === 0 ? 6 : ahora.getDay() - 1;
  const inicioSemana = new Date(ahora);
  inicioSemana.setDate(ahora.getDate() - diaSemana);
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(inicioSemana.getDate() + 6);
  const inicioStr = inicioSemana.toISOString().split("T")[0];
  const finStr    = finSemana.toISOString().split("T")[0];

  document.getElementById("stat-total").textContent  = reservas.length;
  document.getElementById("stat-hoy").textContent    = reservas.filter(r => r.datos.fecha === hoy).length;
  document.getElementById("stat-semana").textContent = reservas.filter(r => r.datos.fecha >= inicioStr && r.datos.fecha <= finStr).length;
}

/* ─── FIRESTORE: ESCUCHAR TODAS LAS RESERVAS ─────────────────────── */

function escucharTodasLasReservas() {
  // Sin filtro de uid — la clínica ve TODAS las reservas
  const q = query(collection(db, "reservas"), orderBy("fecha", "asc"));

  return onSnapshot(q, (snapshot) => {
    todasLasReservas = snapshot.docs.map(d => ({ id: d.id, datos: d.data() }));
    actualizarStats(todasLasReservas);
    renderizarTabla(todasLasReservas);
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
    mostrarAlerta("No se pudo cancelar la reserva.");
  }
}

/* ─── FILTROS: EVENTOS ────────────────────────────────────────────── */

document.querySelectorAll(".filtro-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filtro-btn").forEach(b => b.classList.remove("activo"));
    btn.classList.add("activo");
    filtroActivo = btn.dataset.filtro;
    renderizarTabla(todasLasReservas);
  });
});

/* ─── LOGOUT ──────────────────────────────────────────────────────── */

document.getElementById("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

/* ─── AUTH: VERIFICAR QUE ES ADMIN ───────────────────────────────── */

let unsubscribe = null;

onAuthStateChanged(auth, async (usuario) => {
  if (!usuario) {
    // Sin sesión — volver al login
    window.location.href = "index.html";
    return;
  }

  // Verificar rol en Firestore
  const docSnap = await getDoc(doc(db, "usuarios", usuario.uid));

  if (!docSnap.exists() || docSnap.data().rol !== "admin") {
    // No es admin — mostrar acceso denegado
    seccionAccesoDenegado.removeAttribute("hidden");
    return;
  }

  // Es admin — mostrar panel
  adminEmail.textContent = usuario.email;
  seccionAdmin.removeAttribute("hidden");
  unsubscribe = escucharTodasLasReservas();
});