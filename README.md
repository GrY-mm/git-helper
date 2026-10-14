# Git Helper CLI

`ghelp` es una interfaz interactiva para realizar operaciones habituales de Git paso a paso, conservando el control de los archivos y acciones seleccionados.

## Funciones

- Revisar el estado completo del repositorio.
- Seleccionar archivos individuales para crear un commit local; otros cambios ya preparados se mantienen fuera de ese commit.
- Elegir si se ejecuta `git push` después de crear el commit.
- Consultar los últimos 20 commits.
- Listar ramas, crear una rama y cambiar de rama.
- Guardar cambios en un stash (incluidos archivos nuevos), ver stashes y aplicar uno sin eliminarlo.
- Descartar cambios seleccionados con confirmación explícita.

Las operaciones de Git se ejecutan en el repositorio actual. El descarte de cambios es permanente; revisa cuidadosamente la selección antes de confirmarla.

## Consejos para escribir

- **Ramas:** usa un prefijo que explique el propósito y un nombre breve en minúsculas, separado por guiones. Ejemplos: `feature/inicio-sesion`, `fix/error-login`, `docs/guia-instalacion`.
- **Commits:** escribe una acción breve que describa el cambio. Ejemplo: `feat: añade inicio de sesión`.
- **Stash:** describe el trabajo que guardas para poder reconocerlo después. Ejemplo: `trabajo pendiente en el formulario`.

## Requisitos

- Node.js 18 o superior.
- Git instalado y disponible en `PATH`.

## Instalación

```bash
git clone https://github.com/GrY-mm/git-helper.git
cd git-helper
npm install
npm link
```

`npm link` registra el comando `ghelp` para ejecutarlo desde otros repositorios.

## Uso

Abre una terminal dentro de cualquier repositorio Git y ejecuta:

```bash
ghelp
```

Navega el menú con las flechas y confirma las opciones con Enter. Para ejecutar las pruebas:

```bash
npm test
```

## Licencia

Este proyecto está bajo la Licencia MIT.
