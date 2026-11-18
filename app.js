"use strict";
const $ = (s, r = document) => r.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const DAYS = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
  ],
  MON = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
const PAL = [
  "#3f8f7b",
  "#d9822b",
  "#5b7fd1",
  "#c24d6e",
  "#8a6bbf",
  "#6aa84f",
  "#d4a72c",
  "#2f9fb5",
  "#b5651d",
  "#7a8b99",
  "#e0607e",
  "#4c9a2a",
];
let S = { weeks: {}, groups: [], territories: [], view: null },
  cur,
  curView = "salidas",
  maps = [],
  fm,
  M,
  grp,
  sel = null,
  dr = null,
  ed = null,
  lyr = {},
  fitted = false;

/* ---- admin ---- */
const isAdmin = () => localStorage.getItem("admin") === "1";
const setAdmin = (v) => {
  if (v) localStorage.setItem("admin", "1");
  else localStorage.removeItem("admin");
  location.reload();
};
const EDIT_ACTS = [
  "addout",
  "editout",
  "dupout",
  "delout",
  "up",
  "down",
  "cpday",
  "docp",
  "bulk",
  "tools",
  "cp1",
  "cpn",
  "cpm",
  "cpf",
  "newg",
  "editg",
  "delg",
  "newt",
  "editt",
  "delt",
  "newm",
  "draw",
  "vedit",
  "rmgeo",
  "undo",
  "fin",
  "cdr",
  "sved",
  "ced",
  "exp",
  "imp",
];

/* ---- jsonbin ---- */
const JSONBIN_ID = "6afd0d71ffd5d16053ca2246";
const JSONBIN_KEY =
  "$2a$10$/jt6fO/U71TfMoElGEs8suPiR78r0vDXtsq.aQy4qp/wDien3llZq";
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_ID}/latest`;

/* ---- fechas ---- */
const iso = (d) =>
  d.getFullYear() +
  "-" +
  String(d.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(d.getDate()).padStart(2, "0");
const parse = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addD = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const mon = (d) =>
  addD(
    new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    -((d.getDay() + 6) % 7),
  );
const fmt = (d) => d.getDate() + " de " + MON[d.getMonth()],
  cap = (s) => s[0].toUpperCase() + s.slice(1);
function weeksOf(y, m) {
  const f = new Date(y, m, 1);
  m = f.getMonth();
  let w = mon(f);
  if (addD(w, 3).getMonth() !== m) w = addD(w, 7);
  const r = [];
  while (addD(w, 3).getMonth() === m) {
    r.push(w);
    w = addD(w, 7);
  }
  return r;
}
const refM = () => {
  const r = addD(cur, 3);
  return [r.getFullYear(), r.getMonth()];
};

/* ---- almacenamiento (IndexedDB local) ---- */
const idb = () =>
  new Promise((res, rej) => {
    const r = indexedDB.open("salidas-territorios", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const kv = async (mode, fn) => {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction("kv", mode),
      q = fn(t.objectStore("kv"));
    t.oncomplete = () => res(q.result);
    t.onerror = () => rej(t.error);
  });
};

/* ---- cargar y guardar con JSONBin ---- */
async function load() {
  try {
    const res = await fetch(JSONBIN_URL, {
      headers: { "X-Master-Key": JSONBIN_KEY },
    });
    if (res.ok) {
      const responseData = await res.json();
      // JSONBin envuelve los datos en "record" cuando pedimos /latest
      const data = responseData.record;

      if (data && data.weeks && data.territories) {
        S = norm(data);
        await kv("readwrite", (o) => o.put(S, "state"));
        return;
      }
    }
  } catch (e) {
    console.warn("Fallo al leer de la nube, usando local.");
  }
  try {
    const s = await kv("readonly", (o) => o.get("state"));
    if (s) S = norm(s);
  } catch (e) {
    toast("No se pudo leer el almacenamiento del navegador");
  }
}

let tm;
const save = () => {
  clearTimeout(tm);
  tm = setTimeout(async () => {
    try {
      await kv("readwrite", (o) => o.put(S, "state"));
    } catch (e) {
      toast("Error al guardar localmente");
    }
    if (isAdmin()) {
      try {
        // Para guardar usamos la URL base, sin el /latest
        const putUrl = `https://api.jsonbin.io/v3/b/${JSONBIN_ID}`;
        await fetch(putUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Master-Key": JSONBIN_KEY,
          },
          body: JSON.stringify(S),
        });
      } catch (e) {
        toast("Error al sincronizar con la nube");
      }
    }
  }, 200);
};

/* ---- utilidades ---- */
const T = (id) => S.territories.find((t) => t.id === id),
  uid = () =>
    Date.now().toString(36) +
    (uid.n = (uid.n || 0) + 1).toString(36) +
    Math.random().toString(36).slice(2, 5);
const sorted = () =>
  [...S.territories].sort((a, b) =>
    a.code.localeCompare(b.code, "es", { numeric: true }),
  );
const clone = (o) => JSON.parse(JSON.stringify(o)),
  close = () => {
    const d = $("#dlg");
    d.open && d.close();
  };
const toast = (m) => {
  const t = $("#toast");
  t.textContent = m;
  t.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("on"), 2800);
};
function modal(html, init, cls) {
  const d = $("#dlg");
  d.className = cls || "";
  d.innerHTML = html;
  d.showModal();
  init && init(d);
  return d;
}
const tiles = (m) =>
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(m);
const sty = (t, s) => ({
  color: t.color,
  weight: s ? 5 : 3,
  fillColor: t.color,
  fillOpacity: s ? 0.45 : 0.25,
});
const toGeo = (t, p) => {
  const c = p.map((x) => [+x.lng.toFixed(6), +x.lat.toFixed(6)]);
  return {
    type: "Feature",
    properties: { id: t.id, code: t.code },
    geometry: { type: "Polygon", coordinates: [[...c, c[0]]] },
  };
};
const ring = (t) =>
  t.geo.geometry.coordinates[0].slice(0, -1).map((c) => L.latLng(c[1], c[0]));
const readImg = (f) =>
  new Promise((res, rej) => {
    const im = new Image(),
      u = URL.createObjectURL(f);
    im.onload = () => {
      const s = Math.min(1, 900 / Math.max(im.width, im.height)),
        c = document.createElement("canvas");
      c.width = im.width * s;
      c.height = im.height * s;
      const x = c.getContext("2d");
      x.fillStyle = "#fff";
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      res(c.toDataURL("image/jpeg", 0.78));
    };
    im.onerror = rej;
    im.src = u;
  });
function mkMap(el, t, full) {
  const m = L.map(el, {
    zoomControl: full,
    dragging: full,
    scrollWheelZoom: full,
    doubleClickZoom: full,
    touchZoom: full,
    boxZoom: false,
    keyboard: full,
  });
  tiles(m);
  m.attributionControl.setPrefix(false);
  const g = L.geoJSON(t.geo, { style: sty(t) }).addTo(m);
  m.fitBounds(g.getBounds(), { padding: [14, 14] });
  return m;
}

/* ---- navegación ---- */
function go(v) {
  if (dr) endDraw();
  if (ed) endEdit();
  curView = v;
  ["salidas", "grupos", "terr", "mapa"].forEach(
    (k) => ($("#v-" + k).hidden = k !== v),
  );
  document
    .querySelectorAll("#nav button")
    .forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  render(v);
}
function render(v) {
  v = v || curView;
  ({ salidas: rSal, grupos: rGrp, terr: rTerr, mapa: rMap })[v]();
}
$("#nav").onclick = (e) => {
  const v = e.target.dataset.v;
  v && go(v);
};

/* ---- SALIDAS ---- */
const eachOut = (f) =>
  Object.values(S.weeks).forEach((w) =>
    Object.values(w).forEach((a) => a.forEach(f)),
  );
const usage = (k, id) => {
  let n = 0;
  eachOut((o) => {
    if (o[k] === id) n++;
  });
  return n;
};
const G = (id) => S.groups.find((g) => g.id === id),
  gcol = (g) =>
    PAL[[...g.id].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];
const dayArr = (k, i, mk) => {
  let w = S.weeks[k];
  if (!w) {
    if (!mk) return [];
    w = S.weeks[k] = {};
  }
  return w[i] || (mk ? (w[i] = []) : []);
};
const sortDay = (a) =>
  a.sort((x, y) => (x.time || "99:99").localeCompare(y.time || "99:99"));
const cloneDay = (a) => a.map((o) => ({ ...o, id: uid() })),
  cloneWeek = (w) => {
    const r = {};
    for (const i in w) r[i] = cloneDay(w[i]);
    return r;
  };
function norm(s) {
  const d = { weeks: {}, groups: [], territories: [], view: null, ...s };
  for (const k in d.weeks) {
    const w = d.weeks[k];
    for (const i in w) {
      const v = w[i];
      w[i] = Array.isArray(v)
        ? v.map((o) => (o.id ? o : { ...o, id: uid() }))
        : Object.values(v).some(Boolean)
          ? [{ id: uid(), group: "", ...v }]
          : [];
    }
  }
  return d;
}
function fixRefs() {
  eachOut((o) => {
    if (o.group && !G(o.group)) o.group = "";
    if (o.terr && !T(o.terr)) o.terr = "";
  });
}
const row = (i, v) =>
  v ? `<p class="r"><span>${i}</span><span>${esc(v)}</span></p>` : "";
const mapBlock = (t) =>
  t.geo
    ? `<div class="mini" data-t="${t.id}"></div><div class="ma"><button class="ib" data-act="full" data-t="${t.id}">⛶ Pantalla completa</button><button class="ib" data-act="tomap" data-t="${t.id}">Mapa maestro</button></div>`
    : `<p class="mut">Este territorio aún no tiene límites. <a href="#" data-act="tomap" data-t="${t.id}">Dibujarlos en el mapa maestro</a></p>`;
function outCard(o, i, j, len) {
  const g = G(o.group),
    t = T(o.terr),
    d = `data-i="${i}" data-o="${o.id}"`;
  return `<article class="card out" style="--c:${t ? t.color : "#c9d3d0"}"><div class="oh"><span class="tm">${esc(o.time) || "—"}</span>${len > 1 ? `<span class="num">${j + 1}/${len}</span>` : ""}</div>
${isAdmin() ? `<div class="ma"><button class="ib" data-act="editout" ${d}>✎ Editar</button><button class="ib" data-act="dupout" ${d} title="Duplicar">⧉ Duplicar</button><button class="ib" data-act="delout" ${d} title="Eliminar">🗑</button><button class="ib" data-act="up" ${d} ${j ? "" : "disabled"} title="Subir">▲</button><button class="ib" data-act="down" ${d} ${j < len - 1 ? "" : "disabled"} title="Bajar">▼</button></div>` : ""}
${row("📍", o.place)}${row("🧭", o.addr)}${row("👤", o.captain)}
<div class="tags">${g ? `<span class="tag" style="--c:${gcol(g)}">${esc(g.name)}</span>` : '<span class="tag off">Sin grupo</span>'}${t ? `<span class="tag" style="--c:${t.color}">${esc(t.code)} · ${esc(t.name)}</span>` : '<span class="tag off">Sin territorio</span>'}</div>
${row("ℹ️", o.info)}${t ? mapBlock(t) : '<p class="mut">No se ha seleccionado ningún territorio.</p>'}</article>`;
}
function rSal() {
  maps.forEach((m) => m.remove());
  maps = [];
  if (!cur) cur = mon(new Date());
  const k = iso(cur),
    [y, mo] = refM(),
    ws = weeksOf(y, mo),
    today = iso(new Date());
  $("#v-salidas").innerHTML =
    `<div class="bar"><h2>Salidas de predicación</h2><div class="ma"><button class="ib" data-act="today">Hoy</button>${isAdmin() ? `<button class="ib" data-act="bulk">✎ Editar mes</button><button class="btn" data-act="tools">⧉ Copiar semana</button>` : ""}</div></div>
<div class="nv"><button class="ib" data-act="pm">‹</button><b>${cap(MON[mo])} ${y}</b><button class="ib" data-act="nm">›</button></div>
<div class="weeks">${ws.map((w) => `<button class="wk ${iso(w) === k ? "on" : ""}" data-act="wk" data-d="${iso(w)}">${w.getDate()}–${addD(w, 6).getDate()}</button>`).join("")}</div>
<div class="nv"><button class="ib" data-act="pw">‹ Anterior</button><span>Semana del ${fmt(cur)} al ${fmt(addD(cur, 6))}</span><button class="ib" data-act="nw">Siguiente ›</button></div>
${DAYS.map((n, i) => {
  const d = addD(cur, i),
    a = dayArr(k, i);
  return `<section class="day ${iso(d) === today ? "today" : ""}"><div class="dh"><div><b>${n}</b> <small>${fmt(d)}</small>${a.length > 1 ? `<span class="cnt">${a.length} salidas</span>` : ""}</div>${isAdmin() ? `<div class="ma"><button class="btn" data-act="addout" data-i="${i}">＋ Salida</button><button class="ib" data-act="cpday" data-i="${i}">⧉ Copiar día</button></div>` : ""}</div>${a.length ? `<div class="outs">${a.map((o, j) => outCard(o, i, j, a.length)).join("")}</div>` : '<p class="mut">Sin salidas</p>'}</section>`;
}).join("")}`;
  document.querySelectorAll(".mini").forEach((el) => {
    const t = T(el.dataset.t),
      m = mkMap(el, t, false);
    m.on("click", () => fullMap(t.id));
    maps.push(m);
  });
}
const mv = (n) => {
  const [y, m] = refM();
  cur = weeksOf(y, m + n)[0];
  rSal();
};
function fullMap(id) {
  const t = T(id);
  modal(
    `<div class="mh"><b>${esc(t.code)} · ${esc(t.name)}</b><div class="ma"><button class="ib" data-act="tomap" data-t="${id}">Abrir mapa maestro</button><button class="ib" data-act="close">Cerrar</button></div></div><div id="fmap"></div>`,
    (d) => {
      setTimeout(() => {
        fm = mkMap($("#fmap"), t, true);
      }, 0);
      d.onclose = () => {
        fm && fm.remove();
        fm = null;
      };
    },
    "wide",
  );
}
const done = (m) => {
  save();
  close();
  rSal();
  m && toast(m);
};
const gOpts = (sel0, extra) =>
  `<option value="">${extra || "— Sin grupo —"}</option>${extra ? '<option value="-">— Quitar grupo —</option>' : ""}` +
  S.groups
    .map(
      (g) =>
        `<option value="${g.id}" ${sel0 === g.id ? "selected" : ""}>${esc(g.name)}</option>`,
    )
    .join("");
const tOpts = (sel0, extra) =>
  `<option value="">${extra || "— Sin territorio —"}</option>${extra ? '<option value="-">— Quitar territorio —</option>' : ""}` +
  sorted()
    .map(
      (t) =>
        `<option value="${t.id}" ${sel0 === t.id ? "selected" : ""}>${esc(t.code)} · ${esc(t.name)}</option>`,
    )
    .join("");
function editOut(i, id) {
  const k = iso(cur),
    o = id ? dayArr(k, i).find((x) => x.id === id) : null,
    c = o || {};
  modal(
    `<form class="f" id="fo"><h3>${o ? "Editar" : "Nueva"} salida · ${DAYS[i]} ${fmt(addD(cur, i))}</h3>
<label>Horario<input type="time" name="time" value="${esc(c.time)}"></label>
<label>Punto de encuentro<input name="place" value="${esc(c.place)}"></label>
<label>Ubicación o dirección<input name="addr" value="${esc(c.addr)}"></label>
<label>Capitán / responsable<input name="captain" value="${esc(c.captain)}"></label>
<label>Grupo<select name="group">${gOpts(c.group)}</select></label>
<label>Territorio<select name="terr">${tOpts(c.terr)}</select></label>
<label>Información adicional (opcional)<textarea name="info">${esc(c.info)}</textarea></label>
<div class="ma"><button class="btn">Guardar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></div></form>`,
    () => {
      $("#fo").onsubmit = (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.target)),
          a = dayArr(k, i, true);
        if (o) Object.assign(o, v);
        else a.push({ id: uid(), ...v });
        sortDay(a);
        done("Salida guardada");
      };
    },
  );
}
function copyDay(i) {
  modal(`<div class="f"><h3>Copiar ${DAYS[i].toLowerCase()} (${fmt(addD(cur, i))})</h3><p class="mut">Se copian todas las salidas del día con identificadores nuevos.</p>
<label>Destino<select id="cdt">${DAYS.map((n, j) => (j !== i ? `<option value="${j}">${n} de esta semana</option>` : "")).join("")}<option value="m">Todos los ${DAYS[i].toLowerCase()} del mes (otras semanas)</option></select></label>
<label>Modo<select id="cdm"><option value="a">Agregar a las salidas existentes</option><option value="r">Reemplazar las salidas del destino</option></select></label>
<div class="ma"><button class="btn" data-act="docp" data-i="${i}">Copiar</button><button class="btn ghost" data-act="close">Cancelar</button></div></div>`);
}
function doCopyDay(i) {
  const src = dayArr(iso(cur), i),
    dst = $("#cdt").value,
    rep = $("#cdm").value === "r",
    [y, m] = refM();
  const tg =
    dst === "m"
      ? weeksOf(y, m)
          .filter((w) => iso(w) !== iso(cur))
          .map((w) => [w, i])
      : [[cur, +dst]];
  tg.forEach(([w, j]) => {
    const a = dayArr(iso(w), j, true);
    if (rep) a.length = 0;
    a.push(...cloneDay(src));
    sortDay(a);
  });
  done("Día copiado");
}
function tools() {
  modal(`<div class="f"><h3>Copiar semana</h3><p class="mut">Se copian todas las salidas de la semana del ${fmt(cur)} y se reemplaza la semana de destino.</p>
<button class="btn" data-act="cp1">Copiar a la semana siguiente</button>
<div class="inl"><button class="btn" data-act="cpn">Repetir en las próximas</button><input id="n" type="number" min="1" max="52" value="4"><span>semanas</span></div>
<button class="btn" data-act="cpm">Copiar a todas las semanas del mes</button>
<div class="inl"><button class="btn" data-act="cpf">Traer otra semana</button><input id="df" type="date"></div>
<button class="btn ghost" data-act="close">Cerrar</button></div>`);
}
const cpTo = (l) => {
  if (!confirm("Las semanas de destino serán reemplazadas. ¿Continuar?"))
    return;
  l.forEach((w) => (S.weeks[iso(w)] = cloneWeek(S.weeks[iso(cur)] || {})));
  done("Semana copiada");
};
function bulk() {
  const [y, m] = refM();
  modal(
    `<form class="f" id="fb"><h3>Editar ${MON[m]} ${y}</h3><p class="mut">Modifica las salidas existentes del mes que coincidan con el filtro. Solo se cambian los campos que completes.</p>
<div class="two2"><label>Día<select name="day"><option value="">Todos</option>${DAYS.map((n, i) => `<option value="${i}">${n}</option>`).join("")}</select></label><label>Horario actual (filtro)<input type="time" name="ftime"></label></div>
<label>Nuevo horario<input type="time" name="time"></label><label>Nuevo punto de encuentro<input name="place"></label><label>Nueva dirección<input name="addr"></label><label>Nuevo capitán<input name="captain"></label>
<label>Grupo<select name="group">${gOpts("", "— No cambiar —")}</select></label><label>Territorio<select name="terr">${tOpts("", "— No cambiar —")}</select></label>
<div class="ma"><button class="btn">Aplicar al mes</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></div></form>`,
    () => {
      $("#fb").onsubmit = (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.target)),
          hit = [];
        weeksOf(y, m).forEach((w) =>
          DAYS.forEach((_, j) => {
            if (v.day !== "" && +v.day !== j) return;
            const a = dayArr(iso(w), j);
            a.forEach((o) => {
              if (!v.ftime || o.time === v.ftime) hit.push([o, a]);
            });
          }),
        );
        if (!hit.length) return toast("Ninguna salida coincide con el filtro");
        if (
          !confirm(
            `Se modificarán ${hit.length} salida(s) de ${MON[m]}. ¿Continuar?`,
          )
        )
          return;
        hit.forEach(([o]) => {
          ["time", "place", "addr", "captain"].forEach((f) => {
            if (v[f]) o[f] = v[f];
          });
          ["group", "terr"].forEach((f) => {
            if (v[f]) o[f] = v[f] === "-" ? "" : v[f];
          });
        });
        new Set(hit.map((h) => h[1])).forEach(sortDay);
        done(hit.length + " salida(s) modificadas");
      };
    },
  );
}

/* ---- GRUPOS ---- */
function rGrp() {
  $("#v-grupos").innerHTML =
    `<div class="bar"><h2>Grupos</h2>${isAdmin() ? `<button class="btn" data-act="newg">＋ Nuevo grupo</button>` : ""}</div><div class="grid">${
      S.groups.length
        ? [...S.groups]
            .sort((a, b) =>
              a.name.localeCompare(b.name, "es", { numeric: true }),
            )
            .map((g) => {
              const n = usage("group", g.id);
              return `<article class="card g" style="--c:${gcol(g)}"><div class="tt"><span class="dot"></span><b>${esc(g.name)}</b></div>${g.desc ? `<p>${esc(g.desc)}</p>` : '<p class="mut">Sin descripción</p>'}<p class="mut">${n ? `Asignado a ${n} salida${n > 1 ? "s" : ""}` : "Sin salidas asignadas"}</p>${isAdmin() ? `<div class="ma"><button class="ib" data-act="editg" data-g="${g.id}">✎ Editar</button><button class="ib" data-act="delg" data-g="${g.id}">🗑 Eliminar</button></div>` : ""}</article>`;
            })
            .join("")
        : '<p class="mut">Todavía no hay grupos. Creá el primero.</p>'
    }</div>`;
}
function grpForm(id) {
  const g = id ? G(id) : null,
    v = g || {};
  modal(
    `<form class="f" id="fg"><h3>${g ? "Editar" : "Nuevo"} grupo</h3><label>Nombre del grupo<input name="name" required value="${esc(v.name)}"></label><label>Descripción<textarea name="desc">${esc(v.desc)}</textarea></label><div class="ma"><button class="btn">Guardar</button><button type="button" class="btn ghost" data-act="close">Cancelar</button></div></form>`,
    () => {
      $("#fg").onsubmit = (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target)),
          o = { name: f.name.trim(), desc: f.desc.trim() };
        if (g) Object.assign(g, o);
        else S.groups.push({ id: uid(), ...o });
        save();
        close();
        render();
      };
    },
  );
}
function delG(id) {
  const g = G(id),
    n = usage("group", id);
  if (
    !confirm(
      n
        ? `El grupo “${g.name}” está asignado a ${n} salida(s). Si lo eliminás, esas salidas quedarán sin grupo. ¿Continuar?`
        : `¿Eliminar el grupo “${g.name}”?`,
    )
  )
    return;
  S.groups = S.groups.filter((x) => x.id !== id);
  eachOut((o) => {
    if (o.group === id) o.group = "";
  });
  save();
  render();
}

/* ---- TERRITORIOS ---- */
function rTerr() {
  const wk = S.weeks[iso(cur || (cur = mon(new Date())))] || {};
  $("#v-terr").innerHTML =
    `<div class="bar"><h2>Territorios</h2>${isAdmin() ? `<button class="btn" data-act="newt">＋ Nuevo territorio</button>` : ""}</div><div class="grid">${
      S.territories.length
        ? sorted()
            .map((t) => {
              const u = DAYS.map((n, i) =>
                (wk[i] || []).some((o) => o.terr === t.id) ? n.slice(0, 3) : "",
              ).filter(Boolean);
              return `<article class="card t" style="--c:${t.color}">${t.img ? `<img class="ti" src="${t.img}" alt="">` : `<div class="ti ph">${esc(t.code)}</div>`}<div class="tc"><div class="tt"><span class="chip">${esc(t.code)}</span><b>${esc(t.name)}</b></div>${t.desc ? `<p>${esc(t.desc)}</p>` : ""}${t.info ? `<p class="mut">${esc(t.info)}</p>` : ""}${u.length ? `<p class="mut">Esta semana: ${u.join(", ")}</p>` : ""}<div class="ma"><button class="ib" data-act="tomap" data-t="${t.id}">${t.geo ? "Ver en el mapa" : "Dibujar límites"}</button>${isAdmin() ? `<button class="ib" data-act="editt" data-t="${t.id}">✎ Editar</button>` : ""}</div></div></article>`;
            })
            .join("")
        : '<p class="mut">Todavía no hay territorios. Creá el primero.</p>'
    }</div>`;
}
function terrForm(id, after) {
  const t = id ? T(id) : null,
    v = t || {};
  let img = v.img || "";
  modal(
    `<form class="f" id="ft"><h3>${t ? "Editar" : "Nuevo"} territorio</h3>
<div class="two"><label>Número o código<input name="code" required value="${esc(v.code)}"></label><label>Color<input type="color" name="color" value="${v.color || PAL[S.territories.length % PAL.length]}"></label></div>
<label>Nombre<input name="name" required value="${esc(v.name)}"></label>
<label>Fotografía o imagen<input type="file" id="fi" accept="image/*"></label><div id="pv">${img ? `<img src="${img}" alt="">` : ""}</div><div><button type="button" class="ib" id="noimg" ${img ? "" : "hidden"}>Quitar imagen</button></div>
<label>Descripción<textarea name="desc">${esc(v.desc)}</textarea></label><label>Información adicional<textarea name="info">${esc(v.info)}</textarea></label>
<div class="ma"><button class="btn">Guardar</button>${t ? `<button type="button" class="btn danger" data-act="delt" data-t="${t.id}">Eliminar</button>` : ""}<button type="button" class="btn ghost" data-act="close">Cancelar</button></div></form>`,
    () => {
      $("#fi").onchange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          img = await readImg(f);
          $("#pv").innerHTML = `<img src="${img}" alt="">`;
          $("#noimg").hidden = false;
        } catch {
          toast("No se pudo leer la imagen");
        }
      };
      $("#noimg").onclick = () => {
        img = "";
        $("#pv").innerHTML = "";
        $("#noimg").hidden = true;
      };
      $("#ft").onsubmit = (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target)),
          o = {
            code: f.code.trim(),
            name: f.name.trim(),
            color: f.color,
            desc: f.desc.trim(),
            info: f.info.trim(),
            img,
          };
        let n = t;
        if (t) {
          Object.assign(t, o);
          if (t.geo) t.geo.properties.code = o.code;
        } else {
          n = { id: uid(), geo: null, ...o };
          S.territories.push(n);
        }
        save();
        close();
        after && after(n);
        render();
      };
    },
  );
}
function delT(id) {
  const t = T(id),
    n = usage("terr", id);
  if (
    !confirm(
      `¿Eliminar el territorio ${t.code}${t.geo ? " y sus límites del mapa" : ""}?${n ? ` Está asignado a ${n} salida(s), que quedarán sin territorio.` : ""}`,
    )
  )
    return;
  S.territories = S.territories.filter((x) => x.id !== id);
  eachOut((o) => {
    if (o.terr === id) o.terr = "";
  });
  if (sel === id) sel = null;
  save();
  close();
  render();
}

/* ---- MAPA MAESTRO ---- */
function initMap() {
  if (M) return;
  M = L.map("map").setView(S.view?.c || [-34.6, -64], S.view?.z || 5);
  tiles(M);
  grp = L.layerGroup().addTo(M);
  M.on("moveend", () => {
    S.view = { c: [M.getCenter().lat, M.getCenter().lng], z: M.getZoom() };
    save();
  });
  M.on("click", (e) => {
    if (dr) addPt(e.latlng);
  });
  M.on("dblclick", () => {
    if (dr) {
      dr.pts.pop();
      finishDraw();
    }
  });
  M.on("locationerror", () => toast("No se pudo obtener tu ubicación"));
}
function rMap() {
  initMap();
  panel();
  setTimeout(() => {
    M.invalidateSize();
    paint();
    if (sel && lyr[sel]) fit(sel);
    else if (!fitted) {
      fitted = true;
      const b = L.featureGroup(Object.values(lyr));
      if (Object.keys(lyr).length)
        M.fitBounds(b.getBounds(), { padding: [30, 30] });
    }
  }, 60);
}
function paint() {
  grp.clearLayers();
  lyr = {};
  S.territories.forEach((t) => {
    if (!t.geo || ed?.id === t.id) return;
    const l = L.geoJSON(t.geo, { style: sty(t, t.id === sel) }).addTo(grp);
    l.bindTooltip(esc(t.code), {
      permanent: true,
      direction: "center",
      className: "lbl",
    });
    l.on("click", (e) => {
      if (dr || ed) return;
      L.DomEvent.stopPropagation(e);
      pick(t.id);
    });
    lyr[t.id] = l;
  });
}
const fit = (id) =>
  lyr[id] &&
  M.fitBounds(lyr[id].getBounds(), { padding: [30, 30], maxZoom: 18 });
function pick(id) {
  sel = id;
  paint();
  panel();
  fit(id);
}
function panel() {
  const t = T(sel);
  $("#panel").innerHTML =
    `<div class="ma" style="margin:0">${isAdmin() ? `<button class="btn" data-act="newm">＋ Nuevo territorio</button>` : ""}<button class="ib" data-act="loc">📍 Ubicarme</button></div>
${t ? `<div class="card det" style="--c:${t.color}">${t.img ? `<img class="ti" src="${t.img}" alt="">` : ""}<div class="tc"><div class="tt"><span class="chip">${esc(t.code)}</span><b>${esc(t.name)}</b></div>${t.desc ? `<p>${esc(t.desc)}</p>` : ""}${t.info ? `<p class="mut">${esc(t.info)}</p>` : ""}${isAdmin() ? `<div class="ma"><button class="btn" data-act="draw">${t.geo ? "Redibujar límites" : "Dibujar límites"}</button>${t.geo ? '<button class="ib" data-act="vedit">Editar vértices</button><button class="ib" data-act="rmgeo">Quitar límites</button>' : ""}<button class="ib" data-act="editt" data-t="${t.id}">✎ Ficha</button></div>` : ""}</div></div>` : '<p class="mut">Tocá un territorio en el mapa o en la lista para ver su información.</p>'}
<div class="list">${sorted()
      .map(
        (t) =>
          `<button class="li ${t.id === sel ? "on" : ""}" data-act="pick" data-t="${t.id}"><i style="background:${t.color}"></i><b>${esc(t.code)}</b> ${esc(t.name)}${t.geo ? "" : "<small>sin límites</small>"}</button>`,
      )
      .join("")}</div>`;
}
function bar() {
  const b = $("#bar");
  b.hidden = !(dr || ed);
  b.innerHTML = dr
    ? '<span>Dibujando: tocá el mapa para marcar vértices. Doble toque o “Terminar” para cerrar el polígono.</span><button class="ib" data-act="undo">Deshacer</button><button class="btn" data-act="fin">Terminar</button><button class="ib" data-act="cdr">Cancelar</button>'
    : ed
      ? '<span>Arrastrá los vértices · tocá un vértice para borrarlo · tocá un punto medio para agregar uno.</span><button class="btn" data-act="sved">Guardar</button><button class="ib" data-act="ced">Cancelar</button>'
      : "";
}
function startDraw(id) {
  if (dr || ed) return;
  sel = id;
  dr = {
    id,
    pts: [],
    ln: L.polyline([], { color: "#222", dashArray: "5 5" }).addTo(M),
    dots: L.layerGroup().addTo(M),
  };
  M.doubleClickZoom.disable();
  M.getContainer().style.cursor = "crosshair";
  paint();
  panel();
  bar();
}
function addPt(ll) {
  dr.pts.push(ll);
  dr.ln.setLatLngs(dr.pts);
  L.circleMarker(ll, {
    radius: 5,
    color: "#222",
    fillColor: "#fff",
    fillOpacity: 1,
    interactive: false,
  }).addTo(dr.dots);
}
function undoPt() {
  if (!dr.pts.length) return;
  dr.pts.pop();
  dr.dots.removeLayer(dr.dots.getLayers().pop());
  dr.ln.setLatLngs(dr.pts);
}
function endDraw() {
  dr.ln.remove();
  dr.dots.remove();
  dr = null;
  M.doubleClickZoom.enable();
  M.getContainer().style.cursor = "";
  bar();
}
function finishDraw() {
  if (dr.pts.length < 3) return toast("Marcá al menos 3 puntos");
  const t = T(dr.id);
  t.geo = toGeo(t, dr.pts);
  save();
  endDraw();
  paint();
  panel();
  fit(t.id);
}
function startEdit(id) {
  if (dr || ed) return;
  ed = { id, pts: ring(T(id)), g: L.layerGroup().addTo(M) };
  paint();
  drawEd();
  bar();
}
function drawEd() {
  const e = ed,
    t = T(e.id);
  e.g.clearLayers();
  e.poly = L.polygon(e.pts, sty(t, true)).addTo(e.g);
  e.pts.forEach((p, i) => {
    const n = e.pts[(i + 1) % e.pts.length],
      mp = L.latLng((p.lat + n.lat) / 2, (p.lng + n.lng) / 2);
    L.marker(mp, { icon: L.divIcon({ className: "mid", iconSize: [12, 12] }) })
      .addTo(e.g)
      .on("click", () => {
        e.pts.splice(i + 1, 0, mp);
        drawEd();
      });
  });
  e.pts.forEach((p, i) =>
    L.marker(p, {
      draggable: true,
      icon: L.divIcon({ className: "vx", iconSize: [18, 18] }),
    })
      .addTo(e.g)
      .on("drag", (ev) => {
        e.pts[i] = ev.latlng;
        e.poly.setLatLngs(e.pts);
      })
      .on("dragend", () => setTimeout(drawEd, 0))
      .on("click", () => {
        if (e.pts.length > 3) {
          e.pts.splice(i, 1);
          drawEd();
        } else toast("Se necesitan al menos 3 vértices");
      }),
  );
}
function endEdit() {
  ed.g.remove();
  ed = null;
  paint();
  panel();
  bar();
}

/* ---- respaldo ---- */
const cnt = (d) => {
  let n = 0;
  Object.values(d.weeks).forEach((w) =>
    Object.values(w).forEach((a) => (n += a.length)),
  );
  return `${n} salidas, ${d.groups.length} grupos, ${d.territories.length} territorios`;
};
function exp() {
  const b = new Blob(
      [
        JSON.stringify({
          app: "salidas-territorios",
          version: 2,
          exportado: new Date().toISOString(),
          datos: S,
        }),
      ],
      { type: "application/json" },
    ),
    a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = "respaldo-salidas-" + iso(new Date()) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$("#imp").onchange = async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  try {
    const j = JSON.parse(await f.text()),
      d = j.datos || j;
    if (
      !Array.isArray(d.territories) ||
      typeof d.weeks !== "object" ||
      !d.weeks
    )
      throw 0;
    const n = norm(d);
    if (
      !confirm(
        `Vas a REEMPLAZAR los datos actuales (${cnt(S)}) por los del respaldo (${cnt(n)}). No se puede deshacer. Si no tenés un respaldo de lo actual, cancelá y exportalo primero. ¿Continuar?`,
      )
    )
      return;
    if (dr) endDraw();
    if (ed) endEdit();
    S = n;
    fixRefs();
    save();
    sel = null;
    fitted = false;
    render();
    toast("Respaldo restaurado");
  } catch {
    toast("El archivo no es un respaldo válido");
  }
};

/* ---- eventos ---- */
const fo = (b) => {
  const a = dayArr(iso(cur), +b.dataset.i);
  return [a, a.findIndex((o) => o.id === b.dataset.o)];
};
const A = {
  addout: (b) => editOut(+b.dataset.i),
  editout: (b) => editOut(+b.dataset.i, b.dataset.o),
  dupout: (b) => {
    const [a, j] = fo(b);
    a.splice(j + 1, 0, { ...a[j], id: uid() });
    done("Salida duplicada");
  },
  delout: (b) => {
    const [a, j] = fo(b);
    if (confirm("¿Eliminar esta salida?")) {
      a.splice(j, 1);
      done("Salida eliminada");
    }
  },
  up: (b) => {
    const [a, j] = fo(b);
    if (j > 0) {
      [a[j - 1], a[j]] = [a[j], a[j - 1]];
      done();
    }
  },
  down: (b) => {
    const [a, j] = fo(b);
    if (j >= 0 && j < a.length - 1) {
      [a[j + 1], a[j]] = [a[j], a[j + 1]];
      done();
    }
  },
  cpday: (b) => copyDay(+b.dataset.i),
  docp: (b) => doCopyDay(+b.dataset.i),
  bulk,
  tools,
  full: (b) => fullMap(b.dataset.t),
  close,
  tomap: (b) => {
    close();
    sel = b.dataset.t;
    go("mapa");
  },
  today: () => {
    cur = mon(new Date());
    rSal();
  },
  pm: () => mv(-1),
  nm: () => mv(1),
  wk: (b) => {
    cur = parse(b.dataset.d);
    rSal();
  },
  pw: () => {
    cur = addD(cur, -7);
    rSal();
  },
  nw: () => {
    cur = addD(cur, 7);
    rSal();
  },
  cp1: () => cpTo([addD(cur, 7)]),
  cpn: () =>
    cpTo(
      Array.from(
        { length: Math.max(1, Math.min(52, +$("#n").value || 1)) },
        (_, j) => addD(cur, 7 * (j + 1)),
      ),
    ),
  cpm: () => {
    const [y, m] = refM();
    cpTo(weeksOf(y, m).filter((w) => iso(w) !== iso(cur)));
  },
  cpf: () => {
    const v = $("#df").value;
    if (!v) return toast("Elegí una fecha");
    if (!confirm("Se reemplazará esta semana. ¿Continuar?")) return;
    S.weeks[iso(cur)] = cloneWeek(S.weeks[iso(mon(parse(v)))] || {});
    done("Semana actualizada");
  },
  newg: () => grpForm(),
  editg: (b) => grpForm(b.dataset.g),
  delg: (b) => delG(b.dataset.g),
  newt: () => terrForm(),
  editt: (b) => terrForm(b.dataset.t),
  delt: (b) => delT(b.dataset.t),
  newm: () =>
    terrForm(null, (t) => {
      sel = t.id;
      startDraw(t.id);
    }),
  pick: (b) => pick(b.dataset.t),
  loc: () => M.locate({ setView: true, maxZoom: 16 }),
  draw: () => startDraw(sel),
  vedit: () => startEdit(sel),
  rmgeo: () => {
    if (confirm("¿Quitar los límites de este territorio?")) {
      T(sel).geo = null;
      save();
      paint();
      panel();
    }
  },
  undo: undoPt,
  fin: finishDraw,
  cdr: () => {
    endDraw();
    paint();
  },
  sved: () => {
    const t = T(ed.id);
    t.geo = toGeo(t, ed.pts);
    save();
    endEdit();
  },
  ced: () => endEdit(),
  exp,
  imp: () => $("#imp").click(),
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || !A[b.dataset.act] || b.disabled) return;
  if (!isAdmin() && EDIT_ACTS.includes(b.dataset.act)) {
    e.preventDefault();
    toast("Solo el administrador puede editar");
    return;
  }
  e.preventDefault();
  A[b.dataset.act](b);
});

/* ---- activar/desactivar admin ---- */
if (new URLSearchParams(location.search).get("admin") === "1") {
  setAdmin(true);
}
if (isAdmin()) {
  const btn = document.createElement("button");
  btn.className = "ib";
  btn.textContent = "Salir de admin";
  btn.onclick = () => setAdmin(false);
  document.querySelector(".bk").appendChild(btn);
}

(async () => {
  await load();
  fixRefs();
  navigator.storage?.persist?.();
  go("salidas");
})();
