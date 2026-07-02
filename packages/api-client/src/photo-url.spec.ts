import { apiOrigin, withPhotoHost, resolvePhotoUrl } from './photo-url';

describe('apiOrigin', () => {
  it('strips a trailing /api/v1', () => {
    expect(apiOrigin('http://localhost:3000/api/v1')).toBe('http://localhost:3000');
  });
  it('strips a versioned suffix on a real host', () => {
    expect(apiOrigin('https://api.example.com/api/v2')).toBe('https://api.example.com');
  });
  it('leaves a bare origin alone', () => {
    expect(apiOrigin('https://api.example.com')).toBe('https://api.example.com');
  });
});

describe('withPhotoHost', () => {
  const origin = 'http://192.168.0.2:3000';

  it('prefixes a server-relative /uploads path', () => {
    expect(withPhotoHost('/uploads/attendance/a.jpg', origin)).toBe(
      'http://192.168.0.2:3000/uploads/attendance/a.jpg',
    );
  });
  it('leaves an absolute http url untouched (production object storage)', () => {
    expect(withPhotoHost('https://cdn.example.com/x.jpg', origin)).toBe('https://cdn.example.com/x.jpg');
  });
  it('leaves a local file:// capture URI untouched', () => {
    expect(withPhotoHost('file:///var/tmp/shot.jpg', origin)).toBe('file:///var/tmp/shot.jpg');
  });
  it('returns undefined for null/empty', () => {
    expect(withPhotoHost(null, origin)).toBeUndefined();
    expect(withPhotoHost(undefined, origin)).toBeUndefined();
    expect(withPhotoHost('', origin)).toBeUndefined();
  });
});

describe('resolvePhotoUrl (wired to the app API host)', () => {
  it('resolves a relative upload against the configured host', () => {
    // In Node tests __DEV__ is undefined, so API_BASE_URL = http://localhost:3000/api/v1.
    expect(resolvePhotoUrl('/uploads/x.jpg')).toBe('http://localhost:3000/uploads/x.jpg');
  });
  it('passes an absolute url through', () => {
    expect(resolvePhotoUrl('https://cdn/x.jpg')).toBe('https://cdn/x.jpg');
  });
  it('returns undefined for nullish input', () => {
    expect(resolvePhotoUrl(null)).toBeUndefined();
  });
});
