import { logger } from './logger.js'

/**
 * Business event types for analytics and auditing
 */
export type BusinessEventType =
  | 'USER_REGISTERED'
  | 'USER_LOGGED_IN'
  | 'USER_LOGGED_OUT'
  | 'ORGANIZATION_CREATED'
  | 'ORGANIZATION_UPDATED'
  | 'ORGANIZATION_DELETED'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'ROLE_CHANGED'
  | 'OWNERSHIP_TRANSFERRED'
  | 'INVITATION_CREATED'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_REVOKED'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED'

/**
 * Log user registration event
 *
 * @param params - User registration details
 * @param params.userId - Newly created user ID
 * @param params.email - User's email address
 * @param params.organizationId - Associated organization ID
 * @param params.organizationSlug - Associated organization slug
 * @param params.personalOrg - Whether this is a personal organization (true for self-registration)
 *
 * @example
 * ```typescript
 * logUserRegistration({
 *   userId: user.id,
 *   email: 'user@example.com',
 *   organizationId: org.id,
 *   organizationSlug: 'john-doe',
 *   personalOrg: true,
 * })
 * ```
 */
export const logUserRegistration = (params: {
  userId: string
  email: string
  organizationId: string
  organizationSlug: string
  personalOrg: boolean
}) => {
  logger.info('User registered', {
    event: 'USER_REGISTERED',
    userId: params.userId,
    email: params.email,
    organizationId: params.organizationId,
    organizationSlug: params.organizationSlug,
    personalOrg: params.personalOrg,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log successful user login event
 *
 * Used for analytics and anomaly detection (e.g., unusual login patterns).
 *
 * @param params - Login event details
 * @param params.userId - User ID that logged in
 * @param params.email - User's email address
 * @param params.ip - Client IP address
 *
 * @example
 * ```typescript
 * logUserLogin({
 *   userId: user.id,
 *   email: user.email,
 *   ip: req.ip,
 * })
 * ```
 */
export const logUserLogin = (params: {
  userId: string
  email: string
  ip?: string | undefined
}) => {
  logger.info('User logged in', {
    event: 'USER_LOGGED_IN',
    userId: params.userId,
    email: params.email,
    ip: params.ip,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log user logout event
 *
 * @param params - Logout event details
 * @param params.userId - User ID that logged out
 * @param params.email - User's email address
 *
 * @example
 * ```typescript
 * logUserLogout({
 *   userId: user.id,
 *   email: user.email,
 * })
 * ```
 */
export const logUserLogout = (params: { userId: string; email: string }) => {
  logger.info('User logged out', {
    event: 'USER_LOGGED_OUT',
    userId: params.userId,
    email: params.email,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log organization creation event
 *
 * @param params - Organization creation details
 * @param params.organizationId - Newly created organization ID
 * @param params.organizationSlug - Organization slug (URL-friendly identifier)
 * @param params.organizationName - Organization display name
 * @param params.createdBy - User ID of the organization creator
 *
 * @example
 * ```typescript
 * logOrganizationCreated({
 *   organizationId: org.id,
 *   organizationSlug: 'acme-corp',
 *   organizationName: 'Acme Corporation',
 *   createdBy: user.id,
 * })
 * ```
 */
export const logOrganizationCreated = (params: {
  organizationId: string
  organizationSlug: string
  organizationName: string
  createdBy: string
}) => {
  logger.info('Organization created', {
    event: 'ORGANIZATION_CREATED',
    organizationId: params.organizationId,
    organizationSlug: params.organizationSlug,
    organizationName: params.organizationName,
    createdBy: params.createdBy,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log organization update event
 *
 * Tracks changes to organization settings like name, slug, or other metadata.
 *
 * @param params - Organization update details
 * @param params.organizationId - Organization ID that was updated
 * @param params.organizationSlug - Current organization slug
 * @param params.updatedBy - User ID who made the changes
 * @param params.changes - Object containing the fields that changed (e.g., { name: 'New Name' })
 *
 * @example
 * ```typescript
 * logOrganizationUpdated({
 *   organizationId: org.id,
 *   organizationSlug: 'acme-corp',
 *   updatedBy: user.id,
 *   changes: { name: 'Acme Corporation Ltd' },
 * })
 * ```
 */
export const logOrganizationUpdated = (params: {
  organizationId: string
  organizationSlug: string
  updatedBy: string
  changes: Record<string, unknown>
}) => {
  logger.info('Organization updated', {
    event: 'ORGANIZATION_UPDATED',
    organizationId: params.organizationId,
    organizationSlug: params.organizationSlug,
    updatedBy: params.updatedBy,
    changes: params.changes,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log organization deletion event (future feature)
 *
 * Uses WARN level due to the sensitive nature of organization deletion.
 *
 * @param params - Organization deletion details
 * @param params.organizationId - Organization ID that was deleted
 * @param params.organizationSlug - Organization slug before deletion
 * @param params.deletedBy - User ID who performed the deletion
 *
 * @example
 * ```typescript
 * logOrganizationDeleted({
 *   organizationId: org.id,
 *   organizationSlug: 'old-company',
 *   deletedBy: user.id,
 * })
 * ```
 */
export const logOrganizationDeleted = (params: {
  organizationId: string
  organizationSlug: string
  deletedBy: string
}) => {
  logger.warn('Organization deleted', {
    event: 'ORGANIZATION_DELETED',
    organizationId: params.organizationId,
    organizationSlug: params.organizationSlug,
    deletedBy: params.deletedBy,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log membership change events
 *
 * Tracks all changes to organization membership including additions, removals,
 * role changes, and ownership transfers.
 *
 * @param params - Membership change details
 * @param params.event - Type of membership change (MEMBER_ADDED, MEMBER_REMOVED, ROLE_CHANGED, OWNERSHIP_TRANSFERRED)
 * @param params.organizationId - Organization ID where membership changed
 * @param params.organizationSlug - Organization slug
 * @param params.targetUserId - User ID affected by the change
 * @param params.targetEmail - Email of affected user (optional)
 * @param params.actorUserId - User ID who performed the action
 * @param params.actorEmail - Email of actor (optional)
 * @param params.role - Role assigned (for MEMBER_ADDED)
 * @param params.oldRole - Previous role (for ROLE_CHANGED, OWNERSHIP_TRANSFERRED)
 * @param params.newRole - New role (for ROLE_CHANGED, OWNERSHIP_TRANSFERRED)
 * @param params.reason - Optional reason for the change
 *
 * @example
 * ```typescript
 * // Adding a member
 * logMembershipChanged({
 *   event: 'MEMBER_ADDED',
 *   organizationId: org.id,
 *   organizationSlug: 'acme-corp',
 *   targetUserId: newMember.id,
 *   targetEmail: 'jane@example.com',
 *   actorUserId: admin.id,
 *   role: 'member',
 * })
 *
 * // Role change
 * logMembershipChanged({
 *   event: 'ROLE_CHANGED',
 *   organizationId: org.id,
 *   organizationSlug: 'acme-corp',
 *   targetUserId: member.id,
 *   actorUserId: owner.id,
 *   oldRole: 'member',
 *   newRole: 'admin',
 * })
 * ```
 */
export const logMembershipChanged = (params: {
  event: 'MEMBER_ADDED' | 'MEMBER_REMOVED' | 'ROLE_CHANGED' | 'OWNERSHIP_TRANSFERRED'
  organizationId: string
  organizationSlug: string
  targetUserId: string
  targetEmail?: string | undefined
  actorUserId: string
  actorEmail?: string | undefined
  role?: string | undefined
  oldRole?: string | undefined
  newRole?: string | undefined
  reason?: string | undefined
}) => {
  logger.info('Membership changed', {
    event: params.event,
    organizationId: params.organizationId,
    organizationSlug: params.organizationSlug,
    targetUserId: params.targetUserId,
    targetEmail: params.targetEmail,
    actorUserId: params.actorUserId,
    actorEmail: params.actorEmail,
    role: params.role,
    oldRole: params.oldRole,
    newRole: params.newRole,
    reason: params.reason,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log invitation lifecycle events
 *
 * Tracks invitation creation, acceptance, and revocation for audit purposes.
 *
 * @param params - Invitation event details
 * @param params.event - Type of invitation event (INVITATION_CREATED, INVITATION_ACCEPTED, INVITATION_REVOKED)
 * @param params.invitationId - Invitation ID
 * @param params.email - Email address the invitation was sent to
 * @param params.role - Role being offered in the invitation
 * @param params.organizationId - Organization ID for the invitation
 * @param params.organizationSlug - Organization slug
 * @param params.invitedBy - User ID who created the invitation
 * @param params.acceptedBy - User ID who accepted the invitation
 * @param params.revokedBy - User ID who revoked the invitation
 *
 * @example
 * ```typescript
 * // Creating an invitation
 * logInvitationEvent({
 *   event: 'INVITATION_CREATED',
 *   invitationId: invitation.id,
 *   email: 'newmember@example.com',
 *   role: 'member',
 *   organizationId: org.id,
 *   organizationSlug: 'acme-corp',
 *   invitedBy: admin.id,
 * })
 *
 * // Accepting an invitation
 * logInvitationEvent({
 *   event: 'INVITATION_ACCEPTED',
 *   invitationId: invitation.id,
 *   email: invitation.email,
 *   role: invitation.role,
 *   organizationId: org.id,
 *   organizationSlug: 'acme-corp',
 *   acceptedBy: user.id,
 * })
 * ```
 */
export const logInvitationEvent = (params: {
  event: 'INVITATION_CREATED' | 'INVITATION_ACCEPTED' | 'INVITATION_REVOKED'
  invitationId: string
  email: string
  role: string
  organizationId: string
  organizationSlug: string
  invitedBy?: string | undefined
  acceptedBy?: string | undefined
  revokedBy?: string | undefined
}) => {
  logger.info('Invitation event', {
    event: params.event,
    invitationId: params.invitationId,
    email: params.email,
    role: params.role,
    organizationId: params.organizationId,
    organizationSlug: params.organizationSlug,
    invitedBy: params.invitedBy,
    acceptedBy: params.acceptedBy,
    revokedBy: params.revokedBy,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Log API key lifecycle events
 *
 * Tracks API key creation and revocation for security auditing.
 * Never logs the actual API key value (only ID and name).
 *
 * @param params - API key event details
 * @param params.event - Type of API key event (API_KEY_CREATED, API_KEY_REVOKED)
 * @param params.apiKeyId - API key ID (not the secret key itself)
 * @param params.apiKeyName - Human-readable name for the API key
 * @param params.organizationId - Organization ID the key belongs to
 * @param params.organizationSlug - Organization slug (optional)
 * @param params.scopes - Array of permission scopes granted to the key
 * @param params.createdBy - User ID who created the key
 * @param params.revokedBy - User ID who revoked the key
 *
 * @example
 * ```typescript
 * // Creating an API key
 * logApiKeyEvent({
 *   event: 'API_KEY_CREATED',
 *   apiKeyId: apiKey.id,
 *   apiKeyName: 'Production API',
 *   organizationId: org.id,
 *   organizationSlug: 'acme-corp',
 *   scopes: ['read:users', 'write:data'],
 *   createdBy: user.id,
 * })
 *
 * // Revoking an API key
 * logApiKeyEvent({
 *   event: 'API_KEY_REVOKED',
 *   apiKeyId: apiKey.id,
 *   apiKeyName: apiKey.name,
 *   organizationId: org.id,
 *   scopes: apiKey.scopes,
 *   revokedBy: admin.id,
 * })
 * ```
 */
export const logApiKeyEvent = (params: {
  event: 'API_KEY_CREATED' | 'API_KEY_REVOKED'
  apiKeyId: string
  apiKeyName: string
  organizationId: string
  organizationSlug?: string | undefined
  scopes: string[]
  createdBy?: string | undefined
  revokedBy?: string | undefined
}) => {
  logger.info('API key event', {
    event: params.event,
    apiKeyId: params.apiKeyId,
    apiKeyName: params.apiKeyName,
    organizationId: params.organizationId,
    organizationSlug: params.organizationSlug,
    scopes: params.scopes,
    createdBy: params.createdBy,
    revokedBy: params.revokedBy,
    timestamp: new Date().toISOString(),
  })
}
