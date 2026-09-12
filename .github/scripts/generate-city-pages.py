"""Generate city pages without duplicating markup. Run with --check in CI."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
cities = json.loads((ROOT / '.github/cities.json').read_text())
for city in cities:
    city['confirmation'] = '/thank-you' if city['id'] == 'cardiff' else city['path'] + 'thank-you/'
    city['cityNav'] = '<nav class="city-switch__menu" aria-label="Choose city">' + ''.join(
        '<a href="' + other['path'] + '"' + (' aria-current="page"' if other['id'] == city['id'] else '') + '>' + other['name'] + '</a>'
        for other in cities) + '</nav>'
    for template, destinations in [
        ('city', ['index.html', 'now.html', 'now/index.html'] if city['id'] == 'cardiff' else [city['id'] + '/index.html']),
        ('thank-you', ['thank-you.html'] if city['id'] == 'cardiff' else [city['id'] + '/thank-you/index.html'])
    ]:
        page = (ROOT / f'.github/templates/{template}.html').read_text()
        for key, value in city.items():
            page = page.replace('{{' + key + '}}', str(value))
        if '{{' in page:
            raise ValueError('Unresolved template variable')
        for destination in destinations:
            target = ROOT / destination
            if args.check:
                if not target.exists() or target.read_text() != page:
                    raise SystemExit(f'Regenerate city pages: {destination}')
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(page)
