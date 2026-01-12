import { getSessionId, resetSession } from '../session';

describe('Session Management', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  describe('getSessionId', () => {
    it('should generate a new session ID if none exists', () => {
      (sessionStorage.getItem as jest.Mock).mockReturnValue(null);

      const sessionId = getSessionId();

      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session_/);
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'observability_session_id',
        expect.stringMatching(/^session_/)
      );
    });

    it('should return existing session ID if available', () => {
      const existingId = 'session_12345';
      (sessionStorage.getItem as jest.Mock).mockReturnValue(existingId);

      const sessionId = getSessionId();

      expect(sessionId).toBe(existingId);
      expect(sessionStorage.setItem).not.toHaveBeenCalled();
    });

    it('should reset session after timeout', () => {
      const now = Date.now();
      const expiredTime = now - 31 * 60 * 1000; // 31 minutes ago

      (sessionStorage.getItem as jest.Mock)
        .mockReturnValueOnce('session_12345')
        .mockReturnValueOnce(expiredTime.toString());

      jest.spyOn(Date, 'now').mockReturnValue(now);

      const sessionId = getSessionId();

      expect(sessionId).not.toBe('session_12345');
      expect(sessionId).toMatch(/^session_/);
    });

    it('should update last activity time', () => {
      const existingId = 'session_12345';
      (sessionStorage.getItem as jest.Mock)
        .mockReturnValueOnce(existingId)
        .mockReturnValueOnce(Date.now().toString());

      getSessionId();

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'observability_session_last_activity',
        expect.any(String)
      );
    });
  });

  describe('resetSession', () => {
    it('should generate a new session ID', () => {
      const newSessionId = resetSession();

      expect(newSessionId).toBeDefined();
      expect(newSessionId).toMatch(/^session_/);
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'observability_session_id',
        newSessionId
      );
    });

    it('should update last activity time', () => {
      resetSession();

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        'observability_session_last_activity',
        expect.any(String)
      );
    });
  });
});
