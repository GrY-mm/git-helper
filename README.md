# Git Helper CLI

`ghelp` es una interfaz interactiva para realizar operaciones habituales de Git paso a paso, conservando el control de los archivos y acciones seleccionados.

## Funciones

- Crear rápidamente un commit con todos los cambios del repositorio.
- Subir a GitHub los commits locales con `git push`.
- Crear un commit seleccionando archivos y consultar el historial de commits.
- Revisar el estado completo del repositorio.
- Elegir si se ejecuta `git push` después de crear un commit con selección de archivos.
- Listar ramas, crear una rama y cambiar de rama.
- Guardar cambios en un stash (incluidos archivos nuevos), ver stashes y aplicar uno sin eliminarlo.
- Descartar cambios seleccionados con confirmación explícita.

El menú principal agrupa las acciones de commits, cambios, ramas y stash. El commit rápido incluye todos los cambios y se queda en local; usa «Subir cambios a GitHub» para enviar los commits locales. El commit con selección mantiene fuera del commit los demás cambios preparados. El descarte de cambios es permanente; revisa cuidadosamente la selección antes de confirmarla.

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
