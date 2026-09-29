from zim.plugins import PluginClass, PluginManager
from zim.notebook import NotebookExtension, resolve_notebook, build_notebook
from zim.notebook import Path
from zim.main import UsageError, build_command
from zim.plugins.quicknote import QuickNotePluginCommand


class ZimClipPlugin(PluginClass):
    plugin_info = {
        'name': _('Zim Clip'),
        'description': _('Integration with the Zim Clip browser extension'),
        'author': 'Nick',
    }

    plugin_notebook_properties = (
        (
            'mark_section',
            'string',
            _('Mark section'),
            ''
        ),
        (
            'clip_page',
            'string',
            _('Clip page'),
            ''
        ),
    )


class ZimClipNotebookExtension(NotebookExtension):
    def __init__(self, plugin, notebook):
        NotebookExtension.__init__(self, plugin, notebook)
        plugin.notebook_properties(notebook)


class ZimClipPluginCommand(QuickNotePluginCommand):
    def run(self):

        action = None
        title = None

        for option in self.opts.get('option', []):
            if option.startswith('zimclip_action='):
                action = option[len('zimclip_action='):]
            elif option.startswith('zimclip_title='):
                title = option[len('zimclip_title='):]

        # --- Clip: current Zim page ---
        if action == 'clips':
            text = self.opts.get('text', '')

            if 'notebook' not in self.opts:
                raise UsageError('Notebook is required')

            notebookinfo = resolve_notebook(
                self.opts['notebook']
            )

            if not notebookinfo:
                raise UsageError(
                    'Could not find notebook: %s' %
                    self.opts['notebook']
                )

            gui = build_command([
                '--gui',
                notebookinfo.uri
            ])

            window = gui.run()

            if window is None:
                raise UsageError(
                    'Could not open notebook in Zim GUI'
                )

            if window.get_application() is None:
                from gi.repository import Gio
                application = Gio.Application.get_default()
                if application is not None:
                    application.add_window(window)

            window.present()

            notebook = window.notebook

            plugin = PluginManager()['zimclip']
            properties = plugin.notebook_properties(notebook)

            clip_mode = properties.get(
                'clip_mode',
                'default'
            )

            # --- Clip: system clipboard ---
            if clip_mode == 'clipboard':
                if text:
                    import subprocess

                    subprocess.run(
                        ['xclip', '-selection', 'clipboard'],
                        input=text.encode('utf-8'),
                        check=True
                    )

                return None

            # --- Clip: default page ---
            if clip_mode == 'default':
                clip_page = properties.get('clip_page', '')

                if not clip_page:
                    raise UsageError(
                        'Clip page is not configured'
                    )

                page = notebook.get_page(Path(clip_page))

                if text:
                    parser = page.format.Parser()
                    tree = parser.parse(text)

                    oldtree = page.get_parsetree()

                    if oldtree:
                        tree = oldtree + tree

                    page._set_parsetree(tree)
                    notebook.store_page(page)

                return None

            # --- Clip: current Zim page ---
            if clip_mode == 'current':
                from gi.repository import Gtk
                from zim.gui.mainwindow import MainWindow

                windows = [
                    w for w in Gtk.Window.list_toplevels()
                    if isinstance(w, MainWindow)
                ]

                if not windows:
                    raise UsageError(
                        'Could not find a running Zim window'
                    )

                window = windows[0]

                if window.page is None:
                    raise UsageError(
                        'Could not determine current Zim page'
                    )

                page = window.page

                if text:
                    tree = page.parse('wiki', text)
                    page.append_parsetree(tree)
                    notebook.store_page(page)

                return None

            raise UsageError(
                'Unknown Clip storage mode: %s' % clip_mode
            )

        # --- Mark: existing behavior, unchanged ---
        if 'notebook' not in self.opts:
            raise UsageError('Notebook is required')

        notebookinfo = resolve_notebook(
            self.opts['notebook']
        )

        if not notebookinfo:
            raise UsageError(
                'Could not find notebook: %s' %
                self.opts['notebook']
            )

        notebook, _ = build_notebook(notebookinfo)

        plugin = PluginManager()['zimclip']
        properties = plugin.notebook_properties(notebook)

        self.opts['namespace'] = properties['mark_section']

        dialog = QuickNotePluginCommand.run(self)

        if title and dialog is not None:
            basename = self.opts.get('basename', '')

            if basename and basename != title:
                buffer = dialog.textview.get_buffer()
                start, end = buffer.get_bounds()
                text = start.get_text(end)

                if basename in text:
                    buffer.set_text(
                        text.replace(basename, title)
                    )

        return dialog
