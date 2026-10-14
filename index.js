#!/usr/bin/env node

import { confirm, intro, isCancel, multiselect, outro, select, spinner, text } from '@clack/prompts';
import { execFile } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { basename } from 'node:path';
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

function section(title) {
    console.log(`\n${chalk.bold.cyan(`◆ ${title}`)}`);
    console.log(chalk.gray('─'.repeat(title.length + 2)));
}

function clearScreen() {
    console.clear();
}

function success(message) {
    console.log(`${chalk.green.bold('✓')} ${message}`);
}

function warning(message) {
    console.log(`${chalk.yellow.bold('!')} ${message}`);
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
        label: `${statusColor(status).bold(`[${status}]`)} ${displayPath(file)}`,
    }));
}

async function showStatus() {
    section('Estado del repositorio');
    console.log(await git(['status']));
}

async function showHistory() {
    section('Últimos commits');
    const history = await git([
        'log',
        '-n',
        '20',
        '--date=relative',
        '--pretty=format:%C(yellow)%h%Creset  %C(cyan)%s%Creset  %C(dim)(%cr)%Creset',
    ]);
    console.log(history || chalk.gray('Todavía no hay commits en este repositorio.'));
    console.log();
}

async function createCommit() {
    const changes = await getChanges();
    if (!changes.length) {
        warning('No hay cambios para incluir en un commit.');
        return;
    }

    section('Preparar commit');
    const selectedFiles = await multiselect({
        message: 'Selecciona los archivos que quieres incluir (Espacio para marcar, Enter para confirmar):',
        options: changeOptions(changes),
        required: true,
    });
    if (isCancel(selectedFiles)) return;

    const commitMessage = await text({
        message: 'Mensaje del commit (ej.: feat: añade inicio de sesión):',
        placeholder: 'feat: añade inicio de sesión',
        validate: (value) => value.trim() ? undefined : 'El mensaje no puede estar vacío.',
    });
    if (isCancel(commitMessage)) return;

    const confirmed = await confirm({
        message: `¿Confirmas crear un commit con ${selectedFiles.length} archivo(s) y el mensaje "${commitMessage}"?`,
    });
    if (isCancel(confirmed) || !confirmed) {
        outro('Operación cancelada.');
        return;
    }

    const task = spinner();
    task.start('Añadiendo los archivos seleccionados...');
    try {
        await git(['--literal-pathspecs', 'add', '--', ...selectedFiles]);
        task.message('Creando el commit seleccionado...');
        await git(['--literal-pathspecs', 'commit', '--only', '-m', commitMessage, '--', ...selectedFiles]);
        task.stop(`${chalk.green.bold('✓')} Commit creado localmente. Los demás cambios preparados no se incluyeron.`);
    } catch (error) {
        task.stop(`${chalk.red.bold('✗')} No se pudo completar el commit.`);
        throw error;
    }

    const shouldPush = await confirm({
        message: '¿Quieres subir los cambios con git push ahora?',
    });
    if (isCancel(shouldPush) || !shouldPush) {
        console.log(`${chalk.gray('↳')} El commit permanece en local; puedes subirlo más tarde con git push.`);
        return;
    }

    task.start('Subiendo cambios...');
    try {
        await git(['push']);
        task.stop(`${chalk.green.bold('✓')} Cambios subidos correctamente.`);
    } catch (error) {
        task.stop(`${chalk.red.bold('✗')} El commit se creó, pero no se pudo completar el push.`);
        throw error;
    }
}

async function quickCommit() {
    const changes = await getChanges();
    if (!changes.length) {
        warning('No hay cambios para incluir en un commit.');
        return;
    }

    section('Commit rápido');
    console.log(chalk.gray(`${changes.length} archivo(s) incluirán todos sus cambios.`));
    const commitMessage = await text({
        message: 'Mensaje del commit:',
        placeholder: 'feat: describe el cambio',
        validate: (value) => value.trim() ? undefined : 'El mensaje no puede estar vacío.',
    });
    if (isCancel(commitMessage)) return;

    const confirmed = await confirm({
        message: `¿Confirmas crear un commit con todos los cambios y el mensaje "${commitMessage}"?`,
    });
    if (isCancel(confirmed) || !confirmed) {
        outro('Operación cancelada.');
        return;
    }

    const task = spinner();
    task.start('Preparando todos los cambios...');
    try {
        await git(['add', '--all']);
        task.message('Creando el commit...');
        await git(['commit', '-m', commitMessage]);
        task.stop(`${chalk.green.bold('✓')} Commit creado localmente.`);
    } catch (error) {
        task.stop(`${chalk.red.bold('✗')} No se pudo completar el commit.`);
        throw error;
    }
}

async function manageCommits() {
    clearScreen();
    section('Commits');
    const action = await select({
        message: '¿Qué quieres hacer con los commits?',
        options: [
            { value: 'create', label: 'Crear commit seleccionando archivos' },
            { value: 'history', label: 'Ver historial de commits' },
            { value: 'back', label: 'Volver al menú principal' },
        ],
    });
    if (isCancel(action) || action === 'back') return;
    if (action === 'create') await createCommit();
    if (action === 'history') await showHistory();
}

async function manageChanges() {
    clearScreen();
    section('Cambios');
    const action = await select({
        message: '¿Qué quieres hacer con los cambios?',
        options: [
            { value: 'status', label: 'Ver estado completo' },
            { value: 'discard', label: 'Descartar cambios seleccionados' },
            { value: 'back', label: 'Volver al menú principal' },
        ],
    });
    if (isCancel(action) || action === 'back') return;
    if (action === 'status') await showStatus();
    if (action === 'discard') await discardChanges();
}

async function manageBranches() {
    clearScreen();
    section('Ramas');
    const action = await select({
        message: 'Gestión de ramas',
        options: [
            { value: 'list', label: 'Ver ramas' },
            { value: 'create', label: 'Crear y cambiar a una rama nueva' },
            { value: 'switch', label: 'Cambiar de rama' },
            { value: 'back', label: 'Volver al menú principal' },
        ],
    });
    if (isCancel(action) || action === 'back') return;

    if (action === 'list') {
        const current = await git(['branch', '--show-current']);
        const branches = (await git(['branch', '--format=%(refname:short)']))
            .split(/\r?\n/)
            .filter(Boolean);
        if (!branches.length) {
            warning('Este repositorio todavía no tiene ramas con commits.');
            return;
        }
        for (const branch of branches) {
            console.log(`${branch === current.trim() ? chalk.green.bold('● actual ') : chalk.gray('○         ')}${chalk.cyan(branch)}`);
        }
        return;
    }

    if (action === 'create') {
        const name = await text({
            message: 'Nombre de la rama (ej.: feature/inicio-sesion o fix/error-login):',
            placeholder: 'feature/descripcion-corta',
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
        if (isCancel(name)) return;
        await git(['switch', '-c', name]);
        success(`Cambiado a la nueva rama ${chalk.cyan(name)}.`);
        return;
    }

    const branches = (await git(['branch', '--format=%(refname:short)']))
        .split(/\r?\n/)
        .filter(Boolean);
    const current = (await git(['branch', '--show-current'])).trim();
    const available = branches.filter((branch) => branch !== current);
    if (!available.length) {
        warning('No hay otras ramas a las que cambiar.');
        return;
    }

    const branch = await select({
        message: '¿A qué rama quieres cambiar?',
        options: available.map((value) => ({ value, label: value })),
    });
    if (isCancel(branch)) return;
    await git(['switch', branch]);
    success(`Cambiado a la rama ${chalk.cyan(branch)}.`);
}

async function manageStash() {
    clearScreen();
    section('Stash');
    const action = await select({
        message: 'Gestión de stash',
        options: [
            { value: 'list', label: 'Ver stashes guardados' },
            { value: 'save', label: 'Guardar cambios actuales (incluye archivos nuevos)' },
            { value: 'apply', label: 'Aplicar un stash sin eliminarlo' },
            { value: 'back', label: 'Volver al menú principal' },
        ],
    });
    if (isCancel(action) || action === 'back') return;

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
            warning('No hay stashes guardados.');
            return;
        }
        if (action === 'list') {
            for (const stash of stashes) {
                console.log(`${chalk.magenta.bold(stash.ref)}  ${chalk.gray(stash.description)}`);
            }
            return;
        }

        const stashRef = await select({
            message: 'Selecciona el stash que quieres aplicar:',
            options: stashes.map(({ ref, description }) => ({
                value: ref,
                label: `${ref}: ${displayPath(description)}`,
            })),
        });
        if (isCancel(stashRef)) return;
        await git(['stash', 'apply', stashRef]);
        success('Stash aplicado; se conserva en la lista.');
        return;
    }

    const changes = await getChanges();
    if (!changes.length) {
        warning('No hay cambios para guardar.');
        return;
    }
    const message = await text({
        message: 'Descripción del stash (ej.: trabajo pendiente en el formulario):',
        placeholder: 'trabajo pendiente en el formulario',
        validate: (value) => value.trim() ? undefined : 'La descripción no puede estar vacía.',
    });
    if (isCancel(message)) return;

    await git(['stash', 'push', '--include-untracked', '--message', message]);
    success('Cambios guardados en el stash.');
}

async function discardChanges() {
    section('Descartar cambios');
    const changes = await getChanges();
    if (!changes.length) {
        warning('No hay cambios para descartar.');
        return;
    }
    const selectedFiles = await multiselect({
        message: 'Selecciona qué cambios quieres descartar permanentemente:',
        options: changeOptions(changes),
        required: true,
    });
    if (isCancel(selectedFiles)) return;

    const selectedChanges = changes.filter(({ file }) => selectedFiles.includes(file));
    const paths = selectedChanges.map(({ file }) => file);
    const displayNames = selectedChanges.map(({ file }) => displayPath(file)).join(', ');
    console.log(`${chalk.bgRed.white.bold(' ATENCIÓN ')} ${chalk.red('Esta operación no se puede deshacer.')}`);
    const confirmed = await confirm({
        message: `Descartar permanentemente: ${chalk.cyan(displayNames)}. ¿Continuar?`,
    });
    if (isCancel(confirmed) || !confirmed) {
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
    success('Cambios seleccionados descartados.');
}

async function run() {
    try {
        const root = (await git(['rev-parse', '--show-toplevel'])).trim();
        let done = false;
        while (!done) {
            clearScreen();
            intro(`${chalk.bgCyan.black.bold(' ghelp ')} ${chalk.gray('Git Interactive Helper')}`);
            console.log(`${chalk.gray('📁')} ${chalk.bold(basename(root))}`);
            const changes = await getChanges();
            const branch = (await git(['branch', '--show-current'])).trim() || 'sin rama';
            console.log(`\n${chalk.gray('rama')} ${chalk.cyan.bold(branch)}  ${chalk.gray('│')}  ${
                changes.length
                    ? chalk.yellow.bold(`${changes.length} cambio(s)`)
                    : chalk.green('árbol limpio')
            }`);
            const action = await select({
                message: '¿Qué quieres hacer?',
                options: [
                    { value: 'quickCommit', label: 'Commit rápido (todos los cambios)' },
                    { value: 'commits', label: 'Commits' },
                    { value: 'changes', label: 'Cambios' },
                    { value: 'branches', label: 'Ramas' },
                    { value: 'stash', label: 'Stash' },
                    { value: 'exit', label: 'Salir' },
                ],
            });

            if (isCancel(action) || action === 'exit') {
                done = true;
                continue;
            }
            if (action === 'quickCommit') await quickCommit();
            if (action === 'commits') await manageCommits();
            if (action === 'changes') await manageChanges();
            if (action === 'branches') await manageBranches();
            if (action === 'stash') await manageStash();
        }
        outro('¡Hasta luego!');
    } catch (error) {
        const detail = error.stderr?.trim() || error.message;
        console.error(`\n${chalk.red.bold('✗ Ocurrió un error')}\n${chalk.gray(detail)}`);
        outro('Proceso interrumpido.');
        process.exitCode = 1;
    }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
    run();
}
