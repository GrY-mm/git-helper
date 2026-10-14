#!/usr/bin/env node

import { confirm, intro, isCancel, multiselect, outro, select, spinner, text } from '@clack/prompts';
import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';

const execFileAsync = promisify(execFile);

async function git(args) {
    const { stdout } = await execFileAsync('git', args, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
}

export function parseStatusOutput(output) {
    return output.split('\0').filter(Boolean).flatMap((entry) => {
        if (entry.length < 4) return [];

        return [{
            status: entry.slice(0, 2),
            file: entry.slice(3),
        }];
    });
}

function displayPath(file) {
    return file.replace(/[\u0000-\u001f\u007f]/g, (character) => {
        if (character === '\t') return '\\t';
        if (character === '\n') return '\\n';
        if (character === '\r') return '\\r';
        return '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0');
    });
}

function statusColor(status) {
    if (status.includes('D')) return chalk.red;
    if (status.includes('?') || status.includes('A')) return chalk.green;
    if (status.includes('M')) return chalk.blue;
    if (status.includes('R') || status.includes('C')) return chalk.cyan;
    return chalk.white;
}

async function getChanges() {
    return parseStatusOutput(await git(['status', '--short', '--no-renames', '--untracked-files=all', '-z']));
}

function changeOptions(changes) {
    return changes.map(({ status, file }) => ({
        value: file,
        label: `${statusColor(status)(`[${status}]`)} ${displayPath(file)}`,
    }));
}

function cancelled(value) {
    return isCancel(value);
}

async function showStatus() {
    console.log(await git(['status']));
}

async function showHistory() {
    const history = await git(['log', '-n', '20', '--date=relative', '--pretty=format:%h%x09%s%x09%cr']);
    console.log(history || chalk.gray('Todavía no hay commits en este repositorio.'));
    console.log();
}

async function createCommit() {
    const changes = await getChanges();
    if (!changes.length) {
        console.log(chalk.yellow('No hay cambios para incluir en un commit.'));
        return;
    }

    const selectedFiles = await multiselect({
        message: 'Selecciona los archivos que quieres incluir (Espacio para marcar, Enter para confirmar):',
        options: changeOptions(changes),
        required: true,
    });
    if (cancelled(selectedFiles)) return;

    const commitMessage = await text({
        message: 'Escribe el mensaje para el commit:',
        validate: (value) => value.trim() ? undefined : 'El mensaje no puede estar vacío.',
    });
    if (cancelled(commitMessage)) return;

    const confirmed = await confirm({
        message: `¿Confirmas crear un commit con ${selectedFiles.length} archivo(s) y el mensaje "${commitMessage}"?`,
    });
    if (cancelled(confirmed) || !confirmed) {
        outro('Operación cancelada.');
        return;
    }

    const task = spinner();
    task.start('Añadiendo los archivos seleccionados...');
    try {
        await git(['--literal-pathspecs', 'add', '--', ...selectedFiles]);
        task.message('Creando el commit seleccionado...');
        await git(['--literal-pathspecs', 'commit', '--only', '-m', commitMessage, '--', ...selectedFiles]);
        task.stop(chalk.green('Commit creado localmente. Los demás cambios preparados no se incluyeron.'));
    } catch (error) {
        task.stop(chalk.red('No se pudo completar el commit.'));
        throw error;
    }

    const shouldPush = await confirm({
        message: '¿Quieres subir los cambios con git push ahora?',
    });
    if (cancelled(shouldPush) || !shouldPush) {
        console.log(chalk.gray('El commit permanece en local; puedes subirlo más tarde con git push.'));
        return;
    }

    task.start('Subiendo cambios...');
    try {
        await git(['push']);
        task.stop(chalk.green('Cambios subidos correctamente.'));
    } catch (error) {
        task.stop(chalk.red('El commit se creó, pero no se pudo completar el push.'));
        throw error;
    }
}

async function manageBranches() {
    const action = await select({
        message: 'Gestión de ramas',
        options: [
            { value: 'list', label: 'Ver ramas' },
            { value: 'create', label: 'Crear y cambiar a una rama nueva' },
            { value: 'switch', label: 'Cambiar de rama' },
            { value: 'back', label: 'Volver al menú principal' },
        ],
    });
    if (cancelled(action) || action === 'back') return;

    if (action === 'list') {
        const current = await git(['branch', '--show-current']);
        const branches = (await git(['branch', '--format=%(refname:short)']))
            .split(/\r?\n/)
            .filter(Boolean);
        if (!branches.length) {
            console.log(chalk.yellow('Este repositorio todavía no tiene ramas con commits.'));
            return;
        }
        for (const branch of branches) {
            console.log(`${branch === current.trim() ? chalk.green('* ') : '  '}${branch}`);
        }
        return;
    }

    if (action === 'create') {
        const name = await text({
            message: 'Nombre de la nueva rama:',
            validate: async (value) => {
                if (!value.trim()) return 'El nombre no puede estar vacío.';
                try {
                    await git(['check-ref-format', '--branch', value]);
                } catch {
                    return 'El nombre de la rama no es válido.';
                }
                return undefined;
            },
        });
        if (cancelled(name)) return;
        await git(['switch', '-c', name]);
        console.log(chalk.green(`Cambiado a la nueva rama "${name}".`));
        return;
    }

    const branches = (await git(['branch', '--format=%(refname:short)']))
        .split(/\r?\n/)
        .filter(Boolean);
    const current = (await git(['branch', '--show-current'])).trim();
    const available = branches.filter((branch) => branch !== current);
    if (!available.length) {
        console.log(chalk.yellow('No hay otras ramas a las que cambiar.'));
        return;
    }

    const branch = await select({
        message: '¿A qué rama quieres cambiar?',
        options: available.map((value) => ({ value, label: value })),
    });
    if (cancelled(branch)) return;
    await git(['switch', branch]);
    console.log(chalk.green(`Cambiado a la rama "${branch}".`));
}

async function manageStash() {
    const action = await select({
        message: 'Gestión de stash',
        options: [
            { value: 'list', label: 'Ver stashes guardados' },
            { value: 'save', label: 'Guardar cambios actuales (incluye archivos nuevos)' },
            { value: 'apply', label: 'Aplicar un stash sin eliminarlo' },
            { value: 'back', label: 'Volver al menú principal' },
        ],
    });
    if (cancelled(action) || action === 'back') return;

    if (action === 'list' || action === 'apply') {
        const stashes = (await git(['stash', 'list', '--format=%gd%x09%gs']))
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line) => {
                const separator = line.indexOf('\t');
                return {
                    ref: line.slice(0, separator),
                    description: line.slice(separator + 1),
                };
            });
        if (!stashes.length) {
            console.log(chalk.yellow('No hay stashes guardados.'));
            return;
        }
        if (action === 'list') {
            for (const stash of stashes) console.log(`${stash.ref}: ${stash.description}`);
            return;
        }

        const stashRef = await select({
            message: 'Selecciona el stash que quieres aplicar:',
            options: stashes.map(({ ref, description }) => ({
                value: ref,
                label: `${ref}: ${displayPath(description)}`,
            })),
        });
        if (cancelled(stashRef)) return;
        await git(['stash', 'apply', stashRef]);
        console.log(chalk.green('Stash aplicado; se conserva en la lista.'));
        return;
    }

    const changes = await getChanges();
    if (!changes.length) {
        console.log(chalk.yellow('No hay cambios para guardar.'));
        return;
    }
    const message = await text({
        message: 'Descripción para el stash:',
        validate: (value) => value.trim() ? undefined : 'La descripción no puede estar vacía.',
    });
    if (cancelled(message)) return;

    await git(['stash', 'push', '--include-untracked', '--message', message]);
    console.log(chalk.green('Cambios guardados en el stash.'));
}

async function discardChanges() {
    const changes = await getChanges();
    if (!changes.length) {
        console.log(chalk.yellow('No hay cambios para descartar.'));
        return;
    }
    const selectedFiles = await multiselect({
        message: 'Selecciona qué cambios quieres descartar permanentemente:',
        options: changeOptions(changes),
        required: true,
    });
    if (cancelled(selectedFiles)) return;

    const selectedChanges = changes.filter(({ file }) => selectedFiles.includes(file));
    const paths = selectedChanges.map(({ file }) => file);
    const displayNames = selectedChanges.map(({ file }) => displayPath(file)).join(', ');
    const confirmed = await confirm({
        message: `Esto eliminará permanentemente los cambios de: ${displayNames}. ¿Continuar?`,
    });
    if (cancelled(confirmed) || !confirmed) {
        outro('Operación cancelada.');
        return;
    }

    let hasHead = true;
    let pathsInHead = [];
    try {
        pathsInHead = (await git(['--literal-pathspecs', 'ls-tree', '-r', '-z', '--name-only', 'HEAD', '--', ...paths]))
            .split('\0')
            .filter(Boolean);
    } catch (error) {
        if (!error.stderr?.includes('Not a valid object name')) throw error;
        hasHead = false;
    }

    const headPaths = new Set(pathsInHead);
    const tracked = paths.filter((file) => headPaths.has(file));
    const newFiles = paths.filter((file) => !headPaths.has(file));
    if (tracked.length) {
        await git(['--literal-pathspecs', 'restore', '--source=HEAD', '--staged', '--worktree', '--', ...tracked]);
    }
    if (newFiles.length) {
        if (hasHead) {
            await git(['--literal-pathspecs', 'reset', '--', ...newFiles]);
        } else {
            await git(['--literal-pathspecs', 'rm', '--cached', '--ignore-unmatch', '--', ...newFiles]);
        }
        await git(['--literal-pathspecs', 'clean', '-f', '--', ...newFiles]);
    }
    console.log(chalk.green('Cambios seleccionados descartados.'));
}

async function run() {
    intro(chalk.bgBlue(' Git Interactive Helper '));

    try {
        await git(['rev-parse', '--show-toplevel']);
        let done = false;
        while (!done) {
            const changes = await getChanges();
            const action = await select({
                message: changes.length
                    ? `¿Qué quieres hacer? (${changes.length} cambio(s) detectado(s))`
                    : '¿Qué quieres hacer? (directorio de trabajo limpio)',
                options: [
                    { value: 'status', label: 'Ver git status completo' },
                    { value: 'commit', label: 'Crear un commit seleccionando archivos' },
                    { value: 'history', label: 'Consultar historial de commits' },
                    { value: 'branches', label: 'Ver y gestionar ramas' },
                    { value: 'stash', label: 'Guardar, ver o aplicar stashes' },
                    { value: 'discard', label: 'Descartar cambios seleccionados' },
                    { value: 'exit', label: 'Salir' },
                ],
            });

            if (cancelled(action) || action === 'exit') {
                done = true;
                continue;
            }
            if (action === 'status') await showStatus();
            if (action === 'commit') await createCommit();
            if (action === 'history') await showHistory();
            if (action === 'branches') await manageBranches();
            if (action === 'stash') await manageStash();
            if (action === 'discard') await discardChanges();
        }
        outro('¡Hasta luego!');
    } catch (error) {
        const detail = error.stderr?.trim() || error.message;
        console.error(chalk.red('Ocurrió un error:'), detail);
        outro('Proceso interrumpido.');
        process.exitCode = 1;
    }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    run();
}
