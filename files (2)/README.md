# Salidas, grupos y territorios

Página web estática (HTML + CSS + JavaScript). Sin servidor, sin base de datos externa, sin claves ni costos.
Usa [Leaflet](https://leafletjs.com) (cargado desde cdnjs) y teselas de OpenStreetMap, ambos gratuitos y sin API key.

## Estructura
```
salidas-territorios/
├── index.html
├── css/style.css
├── js/app.js
└── README.md
```

## Ejecutar localmente
Necesitás conexión a internet (Leaflet y el mapa se cargan desde la red).
- Opción simple: abrí `index.html` con doble clic.
- Opción recomendada (con servidor local): en esta carpeta ejecutá `python3 -m http.server 8000` y entrá a `http://localhost:8000`.

## Publicar gratis en GitHub Pages
1. Creá un repositorio público en GitHub y subí el contenido de esta carpeta (`index.html`, `css/`, `js/`) a la raíz.
2. Entrá en **Settings → Pages**, elegí **Deploy from a branch**, rama `main`, carpeta `/ (root)`, y guardá.
3. Al cabo de unos minutos la página queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

## Uso rápido
- **Grupos**: creá los grupos (nombre y descripción). Editarlos actualiza todas las salidas que los usan.
- **Territorios**: creá fichas con código, nombre, foto, descripción e información.
- **Mapa maestro**: elegí un territorio y dibujá o editá sus límites; quedan guardados como GeoJSON.
- **Salidas**: cada día admite todas las salidas que necesites (agregar, editar, duplicar, eliminar, subir/bajar). Se ordenan por horario al guardar; las flechas ajustan el orden manualmente. Con “Copiar día”, “Copiar semana” y “Editar mes” trabajás con varios días o con el mes completo.

## Copias de seguridad
Los datos se guardan **solo en el navegador** (IndexedDB) de cada dispositivo; no hay sincronización automática.
- **Exportar**: botón **⬇ Respaldo** (descarga un `.json` con salidas, grupos, territorios, fotos, polígonos GeoJSON, colores e identificadores).
- **Restaurar**: botón **⬆ Restaurar** y elegir el `.json`. La app muestra cuántos datos se reemplazarán y pide confirmación; la restauración mantiene todas las relaciones.
- Si borrás los datos del sitio en el navegador, se pierde la información: exportá un respaldo con frecuencia. Los respaldos de la versión anterior también se pueden importar.
