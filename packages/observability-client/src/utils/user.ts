/**
 * Get user ID from common auth patterns
 * Checks localStorage for common user storage patterns
 */
export function getUserId(): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // Try common patterns
    const patterns = [
      'user',
      'currentUser',
      'auth_user',
      'user_data',
      'userInfo',
    ];

    for (const pattern of patterns) {
      const userStr = localStorage.getItem(pattern);
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user?.id && typeof user.id === 'number') {
            return user.id;
          }
          if (user?.user_id && typeof user.user_id === 'number') {
            return user.user_id;
          }
        } catch (e) {
          // Continue to next pattern
        }
      }
    }

    // Try direct ID storage
    const userIdStr = localStorage.getItem('user_id') || localStorage.getItem('userId');
    if (userIdStr) {
      const userId = parseInt(userIdStr, 10);
      if (!isNaN(userId)) {
        return userId;
      }
    }
  } catch (e) {
    // Ignore errors
  }

  return null;
}

/**
 * Set user ID manually
 */
export function setUserId(userId: number | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (userId === null) {
    localStorage.removeItem('observability_user_id');
  } else {
    localStorage.setItem('observability_user_id', userId.toString());
  }
}

/**
 * Get user ID from observability-specific storage or fallback to auto-detection
 */
export function getObservabilityUserId(): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const userIdStr = localStorage.getItem('observability_user_id');
    if (userIdStr) {
      const userId = parseInt(userIdStr, 10);
      if (!isNaN(userId)) {
        return userId;
      }
    }
  } catch (e) {
    // Fall through to auto-detection
  }

  return getUserId();
}
