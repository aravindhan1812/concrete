import { isAllowedMime, safeFileName } from './files.service';

describe('safeFileName', () => {
  it('strips directories and unsafe characters', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('C:\\Users\\me\\Site photo #3 (final).jpg')).toBe('Site_photo_3_final_.jpg');
  });
  it('never returns an empty or hidden name', () => {
    expect(safeFileName('///')).toBe('file');
    expect(safeFileName('.env')).toBe('env');
  });
  it('keeps the extension when trimming long names', () => {
    const name = safeFileName('a'.repeat(300) + '.pdf');
    expect(name.length).toBeLessThanOrEqual(120);
    expect(name.endsWith('.pdf')).toBe(true);
  });
});

describe('isAllowedMime', () => {
  it.each(['image/jpeg', 'image/heic', 'application/pdf', 'video/mp4', 'image/vnd.dwg', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'])(
    'allows %s',
    (m) => expect(isAllowedMime(m)).toBe(true),
  );
  it.each(['text/html', 'application/javascript', 'image/svg+xml', 'application/x-msdownload'])('rejects %s', (m) => expect(isAllowedMime(m)).toBe(false));
});
