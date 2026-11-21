import { HttpErrorResponse } from '@angular/common/http';
import { isSessionRejected } from './auth.service';

describe('isSessionRejected', () => {
  const http = (status: number) => new HttpErrorResponse({ status, url: '/auth/api/auth/refresh-token' });

  it('ends the session when the backend rejects it', () => {
    expect(isSessionRejected(http(401))).toBeTrue();
    expect(isSessionRejected(http(403))).toBeTrue();
    expect(isSessionRejected(new Error('No refresh token available'))).toBeTrue();
  });

  it('keeps the session when the network or the server fail for a moment', () => {
    expect(isSessionRejected(http(0))).toBeFalse();
    expect(isSessionRejected(http(500))).toBeFalse();
    expect(isSessionRejected(http(502))).toBeFalse();
    expect(isSessionRejected(http(503))).toBeFalse();
  });
});
