#!/usr/bin/env python3

import json
import sys
import urllib.request
from html.parser import HTMLParser


class MetadataParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta = []
        self.jsonld = []
        self._jsonld = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)

        if tag.lower() == 'meta':
            self.meta.append(attrs)

        elif tag.lower() == 'script':
            if attrs.get('type', '').lower() == 'application/ld+json':
                self._jsonld = []

    def handle_data(self, data):
        if self._jsonld is not None:
            self._jsonld.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == 'script' and self._jsonld is not None:
            text = ''.join(self._jsonld).strip()
            if text:
                try:
                    self.jsonld.append(json.loads(text))
                except json.JSONDecodeError:
                    self.jsonld.append(text)
            self._jsonld = None


def fetch(url):
    request = urllib.request.Request(
        url,
        headers={
            'User-Agent':
                'Mozilla/5.0 (X11; Linux x86_64) '
                'AppleWebKit/537.36 Chrome/153 Safari/537.36'
        }
    )

    with urllib.request.urlopen(request, timeout=20) as response:
        charset = response.headers.get_content_charset() or 'utf-8'
        return response.read().decode(charset, errors='replace')


def print_meta(parser):
    print()
    print('=== META TAGS ===')

    for attrs in parser.meta:
        interesting = {
            key: value
            for key, value in attrs.items()
            if key in ('name', 'property', 'itemprop', 'content')
        }

        if interesting:
            print(interesting)


def print_jsonld(parser):
    print()
    print('=== JSON-LD ===')

    if not parser.jsonld:
        print('(none)')
        return

    for i, data in enumerate(parser.jsonld, 1):
        print(f'--- block {i} ---')
        print(json.dumps(data, ensure_ascii=False, indent=2))


def main():
    if len(sys.argv) != 2:
        print(f'Usage: {sys.argv[0]} URL')
        sys.exit(1)

    url = sys.argv[1]

    print(f'URL: {url}')
    print('Fetching...')

    try:
        html = fetch(url)
    except Exception as e:
        print(f'ERROR: {e}')
        sys.exit(1)

    print(f'Received: {len(html)} bytes')

    parser = MetadataParser()
    parser.feed(html)

    print_meta(parser)
    print_jsonld(parser)


if __name__ == '__main__':
    main()
