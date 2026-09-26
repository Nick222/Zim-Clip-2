#!/usr/bin/env python3
"""Native Messaging host for the Chromium Zim Clip extension."""
import json
import os
import struct
import subprocess
import sys

from urllib.parse import unquote

from zim.notebook import get_notebook_list

HOST_DIR = os.path.dirname(os.path.realpath(__file__))
CONFIG_PATH = os.path.join(HOST_DIR, 'config.json')


def read_message():
    raw = sys.stdin.buffer.read(4)

    if not raw:
        return None

    length = struct.unpack('<I', raw)[0]
    payload = sys.stdin.buffer.read(length)

    if len(payload) != length:
        raise RuntimeError('Incomplete Native Messaging message')

    return json.loads(payload.decode('utf-8'))


def get_config():
    with open(CONFIG_PATH, encoding='utf-8') as fh:
        return json.load(fh)


def get_notebooks():
    notebook_list = get_notebook_list()

    notebooks = []

    for info in notebook_list:
        notebooks.append({
            'name': info.name,
            'uri': info.uri
        })

    return {
        'type': 'notebooks',
        'notebooks': notebooks
    }


def main():

    config = get_config()

    while True:
        message = read_message()

        if message is None:
            return

        if not isinstance(message, list) or not message:
            raise RuntimeError(
                'Expected a non-empty argument list'
            )

        # Request from the Zim Clip options page.
        if message == ['list_notebooks']:
            write_message(get_notebooks())
            continue

        action = message[-1]
        args = message[:-1]

        if action not in ('marks', 'clips', 'clipboard'):
            raise RuntimeError('Unknown action: ' + action)

        if action == 'clipboard':
            text = ''

            for arg in args:
                if arg.startswith('text='):
                    text = unquote(arg[5:])
                    break

            if text:
                subprocess.run(
                    ['xclip', '-selection', 'clipboard'],
                    input=text.encode('utf-8'),
                    check=True
                )

            write_message({'ok': True})

            return

        notebook = None
        zim_args = []

        for arg in args:
            if arg.startswith('notebook='):
                notebook = arg[len('notebook='):]
                continue

            if arg.startswith('option:'):
                zim_args.append('--option=' + arg[7:])
            else:
                zim_args.append('--' + arg)

        if action in ('marks', 'clips'):
            zim_args.append('--option=zimclip_action=' + action)

        if action in ('marks', 'clips'):
            plugin = 'zimclip'

        cmd = [
            config['path'],
            '--plugin', plugin,
            '--encoding=url'
        ]

        if notebook == '__default__':
            notebook_list = get_notebook_list()

            if notebook_list.default is None:
                raise RuntimeError(
                    'No default Zim notebook is configured'
                )

            notebook = notebook_list.default.uri

        if notebook:
            cmd.append('--notebook=' + notebook)

        namespace = config.get(action, '')

        if namespace:
            cmd.append('--namespace=' + namespace)

        cmd.extend(zim_args)

        subprocess.Popen(
            cmd,
            cwd=None,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True
        )

        write_message({'ok': True})
        return

def write_message(message):
    payload = json.dumps(message).encode('utf-8')

    sys.stdout.buffer.write(
        struct.pack('<I', len(payload))
    )
    sys.stdout.buffer.write(payload)
    sys.stdout.buffer.flush()


if __name__ == '__main__':
    main()
