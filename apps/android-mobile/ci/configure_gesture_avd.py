"""Give only modern disposable CI AVDs software Back/Home navigation."""
import os
import pathlib
import sys


def configure(api, path):
    if api < 29:
        return False
    path = pathlib.Path(path)
    lines = path.read_text().splitlines()
    lines = [line for line in lines if line.split('=', 1)[0].strip() != 'hw.mainKeys']
    path.write_text('\n'.join(lines) + '\nhw.mainKeys=no\n')
    return True


if __name__ == '__main__':
    if os.environ.get('GITHUB_ACTIONS') != 'true':
        sys.exit('Only configure the disposable GitHub emulator')
    changed = configure(int(sys.argv[1]), sys.argv[2])
    print('CI AVD software Back/Home keys enabled' if changed else 'Legacy AVD hardware configuration retained')
