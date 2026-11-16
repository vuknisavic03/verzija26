import type { RateLimitPolicy } from './rateLimit.ts'

const policies = new Map<string, RateLimitPolicy>([
  [
    '/api/public/pre-applications',
    { limit: 5, scope: 'public-pre-application', windowSeconds: 10 * 60 },
  ],
  [
    '/api/public/candidate-accounts/forgot-password',
    { limit: 5, scope: 'candidate-password-recovery', windowSeconds: 15 * 60 },
  ],
  [
    '/api/public/candidate-accounts/activate',
    { limit: 10, scope: 'candidate-account-activation', windowSeconds: 15 * 60 },
  ],
  [
    '/api/candidate-accounts/login',
    { limit: 10, scope: 'candidate-login', windowSeconds: 15 * 60 },
  ],
  [
    '/api/candidate-accounts/forgot-password',
    { limit: 5, scope: 'candidate-payload-password-recovery', windowSeconds: 15 * 60 },
  ],
  [
    '/api/candidate-accounts/reset-password',
    { limit: 10, scope: 'candidate-password-reset', windowSeconds: 15 * 60 },
  ],
  [
    '/api/public/candidate-accounts/register',
    { limit: 10, scope: 'candidate-invitation-registration', windowSeconds: 15 * 60 },
  ],
  [
    '/api/public/candidate-invitations/verify',
    { limit: 20, scope: 'candidate-invitation-verification', windowSeconds: 15 * 60 },
  ],
  [
    '/api/public/candidate-accounts/resend-verification',
    { limit: 5, scope: 'candidate-verification-resend', windowSeconds: 15 * 60 },
  ],
  [
    '/api/public/candidate-accounts/verify-email',
    { limit: 20, scope: 'candidate-email-verification', windowSeconds: 15 * 60 },
  ],
  ['/api/public/contracts/email', { limit: 5, scope: 'portal-contract-email', windowSeconds: 60 * 60 }],
  [
    '/api/public/identity-scan',
    { limit: 20, scope: 'identity-document-scan', windowSeconds: 15 * 60 },
  ],
  // AI prevod košta: ograničenje po adresi, uz dnevni limit po kandidatu u samom prevodu.
  ['/api/public/translations', { limit: 20, scope: 'portal-ai-translation', windowSeconds: 60 * 60 }],
  ['/api/users/login', { limit: 10, scope: 'admin-login', windowSeconds: 15 * 60 }],
  [
    '/api/users/forgot-password',
    { limit: 5, scope: 'admin-password-recovery', windowSeconds: 15 * 60 },
  ],
  [
    '/api/users/reset-password',
    { limit: 10, scope: 'admin-password-reset', windowSeconds: 15 * 60 },
  ],
  [
    '/api/users/first-register',
    { limit: 5, scope: 'first-admin-registration', windowSeconds: 15 * 60 },
  ],
])

export function rateLimitPolicy(method: string, pathname: string) {
  return method === 'POST' ? policies.get(pathname) : undefined
}
