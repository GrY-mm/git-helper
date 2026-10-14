import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatusOutput } from '../index.js';

test('parseStatusOutput preserves complete filenames, including leading spaces', () => {
    const changes = parseStatusOutput(' M index.js\0?? new file.js\0A  leading space.txt\0');

    assert.deepEqual(changes, [
        { status: ' M', file: 'index.js' },
        { status: '??', file: 'new file.js' },
        { status: 'A ', file: 'leading space.txt' },
    ]);
});

test('parseStatusOutput preserves tabs and newlines in filenames', () => {
    const changes = parseStatusOutput(' M dir/\tname\n.js\0');

    assert.deepEqual(changes, [
        { status: ' M', file: 'dir/\tname\n.js' },
    ]);
});

test('parseStatusOutput returns an empty list for a clean repository', () => {
    assert.deepEqual(parseStatusOutput(''), []);
});
