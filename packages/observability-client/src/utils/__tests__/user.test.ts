import { getUserId, setUserId, getObservabilityUserId } from '../user';

describe('User Utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('getUserId', () => {
    it('should return null if no user ID is found', () => {
      expect(getUserId()).toBeNull();
    });

    it('should get user ID from localStorage "user" object', () => {
      localStorage.setItem('user', JSON.stringify({ id: 123 }));

      expect(getUserId()).toBe(123);
    });

    it('should get user ID from localStorage "userId"', () => {
      localStorage.setItem('userId', '456');

      expect(getUserId()).toBe(456);
    });

    it('should get user ID from localStorage "user_id"', () => {
      localStorage.setItem('user_id', '789');

      expect(getUserId()).toBe(789);
    });

    it('should handle invalid JSON gracefully', () => {
      localStorage.setItem('user', 'invalid json');

      expect(getUserId()).toBeNull();
    });
  });

  describe('setUserId', () => {
    it('should store user ID in localStorage', () => {
      setUserId(999);

      expect(localStorage.getItem('observability_user_id')).toBe('999');
    });

    it('should remove user ID when set to null', () => {
      localStorage.setItem('observability_user_id', '123');

      setUserId(null);

      expect(localStorage.getItem('observability_user_id')).toBeNull();
    });
  });

  describe('getObservabilityUserId', () => {
    it('should return manually set user ID first', () => {
      localStorage.setItem('observability_user_id', '100');
      localStorage.setItem('userId', '200');

      expect(getObservabilityUserId()).toBe(100);
    });

    it('should fall back to getUserId if no manual ID', () => {
      localStorage.setItem('userId', '300');

      expect(getObservabilityUserId()).toBe(300);
    });

    it('should return null if no user ID found', () => {
      expect(getObservabilityUserId()).toBeNull();
    });
  });
});
