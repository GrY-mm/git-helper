#!/usr/bin/env node

import { intro, outro, select, text, confirm, spinner } from '@clack/prompts';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execAsync = promisify(exec);

async function run() {
    intro(chalk.bgBlue(' 🚀 Git Interactive Helper '));

    try {
        // 1. Ver estado actual de git
        const { stdout: statusOutput } = await execAsync('git status -s');

        if (!statusOutput.trim()) {
            console.log(chalk.yellow('⚠️ No hay cambios pendientes en este repositorio.'));
            outro('¡Todo al día!');
            return;
        }

        console.log(chalk.gray('Archivos modificados detectados.'));

        // 2. Menú principal de acciones
        const action = await select({
            message: '¿Qué quieres hacer?',
            options: [
                { value: 'quick_commit', label: 'Commit rápido (Añadir todo + Commit + Push)' },
                { value: 'status', label: 'Ver estado detallado (git status)' },
                { value: 'exit', label: 'Salir' },
            ],
        });

        if (action === 'exit' || !action) {
            outro('¡Hasta luego!');
            return;
        }

        if (action === 'status') {
            const { stdout } = await execAsync('git status');
            console.log(stdout);
            outro('Consulta finalizada.');
            return;
        }

        if (action === 'quick_commit') {
            // 3. Pedir mensaje de commit
            const commitMsg = await text({
                message: 'Escribe el mensaje para el commit:',
                validate: (value) => {
                    if (!value.trim()) return 'El mensaje no puede estar vacío.';
                },
            });

            if (typeof commitMsg === 'symbol') return; // Si el usuario cancela (ESC)

            const s = spinner();
            s.start('Ejecutando comandos de Git...');

            // 4. Ejecutar comandos de Git de forma secuencial
            await execAsync('git add .');
            await execAsync(`git commit -m "${commitMsg}"`);
            await execAsync('git push');

            s.stop(chalk.green('✅ ¡Cambios subidos a GitHub con éxito!'));
            outro('¡Buen trabajo!');
        }

    } catch (error) {
        console.error(chalk.red('❌ Ocurrió un error:'), error.message);
        outro('Proceso interrumpido.');
    }
}

run();