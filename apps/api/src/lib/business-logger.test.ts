import { describe, expect, it, vi } from 'vitest'

import {
  logApiKeyEvent,
  logInvitationEvent,
  logMembershipChanged,
  logOrganizationCreated,
  logOrganizationDeleted,
  logOrganizationUpdated,
  logUserLogin,
  logUserLogout,
  logUserRegistration,
} from './business-logger.js'
import { logger } from './logger.js'

// Mock logger
vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('business-logger', () => {
  describe('logUserRegistration', () => {
    it('should log user registration event', () => {
      logUserRegistration({
        userId: 'user-123',
        email: 'user@example.com',
        organizationId: 'org-456',
        organizationSlug: 'john-doe',
        personalOrg: true,
      })

      expect(logger.info).toHaveBeenCalledWith('User registered', {
        event: 'USER_REGISTERED',
        userId: 'user-123',
        email: 'user@example.com',
        organizationId: 'org-456',
        organizationSlug: 'john-doe',
        personalOrg: true,
        timestamp: expect.any(String),
      })
    })
  })

  describe('logUserLogin', () => {
    it('should log user login event with IP', () => {
      logUserLogin({
        userId: 'user-123',
        email: 'user@example.com',
        ip: '192.168.1.1',
      })

      expect(logger.info).toHaveBeenCalledWith('User logged in', {
        event: 'USER_LOGGED_IN',
        userId: 'user-123',
        email: 'user@example.com',
        ip: '192.168.1.1',
        timestamp: expect.any(String),
      })
    })

    it('should work without IP address', () => {
      logUserLogin({
        userId: 'user-123',
        email: 'user@example.com',
      })

      expect(logger.info).toHaveBeenCalledWith('User logged in', {
        event: 'USER_LOGGED_IN',
        userId: 'user-123',
        email: 'user@example.com',
        ip: undefined,
        timestamp: expect.any(String),
      })
    })
  })

  describe('logUserLogout', () => {
    it('should log user logout event', () => {
      logUserLogout({
        userId: 'user-123',
        email: 'user@example.com',
      })

      expect(logger.info).toHaveBeenCalledWith('User logged out', {
        event: 'USER_LOGGED_OUT',
        userId: 'user-123',
        email: 'user@example.com',
        timestamp: expect.any(String),
      })
    })
  })

  describe('logOrganizationCreated', () => {
    it('should log organization creation', () => {
      logOrganizationCreated({
        organizationId: 'org-123',
        organizationSlug: 'acme',
        organizationName: 'Acme Corp',
        createdBy: 'user-456',
      })

      expect(logger.info).toHaveBeenCalledWith('Organization created', {
        event: 'ORGANIZATION_CREATED',
        organizationId: 'org-123',
        organizationSlug: 'acme',
        organizationName: 'Acme Corp',
        createdBy: 'user-456',
        timestamp: expect.any(String),
      })
    })
  })

  describe('logOrganizationUpdated', () => {
    it('should log organization update with changes', () => {
      logOrganizationUpdated({
        organizationId: 'org-123',
        organizationSlug: 'acme',
        updatedBy: 'user-456',
        changes: {
          name: { old: 'Acme', new: 'Acme Corp' },
          slug: { old: 'acme-old', new: 'acme' },
        },
      })

      expect(logger.info).toHaveBeenCalledWith('Organization updated', {
        event: 'ORGANIZATION_UPDATED',
        organizationId: 'org-123',
        organizationSlug: 'acme',
        updatedBy: 'user-456',
        changes: {
          name: { old: 'Acme', new: 'Acme Corp' },
          slug: { old: 'acme-old', new: 'acme' },
        },
        timestamp: expect.any(String),
      })
    })
  })

  describe('logOrganizationDeleted', () => {
    it('should log organization deletion with warn level', () => {
      logOrganizationDeleted({
        organizationId: 'org-123',
        organizationSlug: 'acme',
        deletedBy: 'user-456',
      })

      expect(logger.warn).toHaveBeenCalledWith('Organization deleted', {
        event: 'ORGANIZATION_DELETED',
        organizationId: 'org-123',
        organizationSlug: 'acme',
        deletedBy: 'user-456',
        timestamp: expect.any(String),
      })
    })
  })

  describe('logMembershipChanged', () => {
    it('should log member added event', () => {
      logMembershipChanged({
        event: 'MEMBER_ADDED',
        organizationId: 'org-123',
        organizationSlug: 'acme',
        targetUserId: 'user-789',
        targetEmail: 'new@example.com',
        actorUserId: 'user-456',
        actorEmail: 'admin@example.com',
        role: 'MEMBER',
      })

      expect(logger.info).toHaveBeenCalledWith('Membership changed', {
        event: 'MEMBER_ADDED',
        organizationId: 'org-123',
        organizationSlug: 'acme',
        targetUserId: 'user-789',
        targetEmail: 'new@example.com',
        actorUserId: 'user-456',
        actorEmail: 'admin@example.com',
        role: 'MEMBER',
        oldRole: undefined,
        newRole: undefined,
        reason: undefined,
        timestamp: expect.any(String),
      })
    })

    it('should log role change event', () => {
      logMembershipChanged({
        event: 'ROLE_CHANGED',
        organizationId: 'org-123',
        organizationSlug: 'acme',
        targetUserId: 'user-789',
        actorUserId: 'user-456',
        oldRole: 'MEMBER',
        newRole: 'ADMIN',
      })

      expect(logger.info).toHaveBeenCalledWith('Membership changed', {
        event: 'ROLE_CHANGED',
        organizationId: 'org-123',
        organizationSlug: 'acme',
        targetUserId: 'user-789',
        actorUserId: 'user-456',
        oldRole: 'MEMBER',
        newRole: 'ADMIN',
        targetEmail: undefined,
        actorEmail: undefined,
        role: undefined,
        reason: undefined,
        timestamp: expect.any(String),
      })
    })

    it('should log ownership transfer event', () => {
      logMembershipChanged({
        event: 'OWNERSHIP_TRANSFERRED',
        organizationId: 'org-123',
        organizationSlug: 'acme',
        targetUserId: 'user-789',
        actorUserId: 'user-456',
        oldRole: 'ADMIN',
        newRole: 'OWNER',
        reason: 'Ownership transfer requested by owner',
      })

      expect(logger.info).toHaveBeenCalledWith('Membership changed', {
        event: 'OWNERSHIP_TRANSFERRED',
        organizationId: 'org-123',
        organizationSlug: 'acme',
        targetUserId: 'user-789',
        actorUserId: 'user-456',
        oldRole: 'ADMIN',
        newRole: 'OWNER',
        reason: 'Ownership transfer requested by owner',
        targetEmail: undefined,
        actorEmail: undefined,
        role: undefined,
        timestamp: expect.any(String),
      })
    })
  })

  describe('logInvitationEvent', () => {
    it('should log invitation created event', () => {
      logInvitationEvent({
        event: 'INVITATION_CREATED',
        invitationId: 'inv-123',
        email: 'newuser@example.com',
        role: 'MEMBER',
        organizationId: 'org-456',
        organizationSlug: 'acme',
        invitedBy: 'user-789',
      })

      expect(logger.info).toHaveBeenCalledWith('Invitation event', {
        event: 'INVITATION_CREATED',
        invitationId: 'inv-123',
        email: 'newuser@example.com',
        role: 'MEMBER',
        organizationId: 'org-456',
        organizationSlug: 'acme',
        invitedBy: 'user-789',
        acceptedBy: undefined,
        revokedBy: undefined,
        timestamp: expect.any(String),
      })
    })

    it('should log invitation accepted event', () => {
      logInvitationEvent({
        event: 'INVITATION_ACCEPTED',
        invitationId: 'inv-123',
        email: 'newuser@example.com',
        role: 'MEMBER',
        organizationId: 'org-456',
        organizationSlug: 'acme',
        acceptedBy: 'user-999',
      })

      expect(logger.info).toHaveBeenCalledWith('Invitation event', {
        event: 'INVITATION_ACCEPTED',
        invitationId: 'inv-123',
        email: 'newuser@example.com',
        role: 'MEMBER',
        organizationId: 'org-456',
        organizationSlug: 'acme',
        acceptedBy: 'user-999',
        invitedBy: undefined,
        revokedBy: undefined,
        timestamp: expect.any(String),
      })
    })
  })

  describe('logApiKeyEvent', () => {
    it('should log API key created event', () => {
      logApiKeyEvent({
        event: 'API_KEY_CREATED',
        apiKeyId: 'key-123',
        apiKeyName: 'Production Key',
        organizationId: 'org-456',
        organizationSlug: 'acme',
        scopes: ['read', 'write'],
        createdBy: 'user-789',
      })

      expect(logger.info).toHaveBeenCalledWith('API key event', {
        event: 'API_KEY_CREATED',
        apiKeyId: 'key-123',
        apiKeyName: 'Production Key',
        organizationId: 'org-456',
        organizationSlug: 'acme',
        scopes: ['read', 'write'],
        createdBy: 'user-789',
        revokedBy: undefined,
        timestamp: expect.any(String),
      })
    })

    it('should log API key revoked event', () => {
      logApiKeyEvent({
        event: 'API_KEY_REVOKED',
        apiKeyId: 'key-123',
        apiKeyName: 'Production Key',
        organizationId: 'org-456',
        scopes: ['read', 'write'],
        revokedBy: 'user-789',
      })

      expect(logger.info).toHaveBeenCalledWith('API key event', {
        event: 'API_KEY_REVOKED',
        apiKeyId: 'key-123',
        apiKeyName: 'Production Key',
        organizationId: 'org-456',
        scopes: ['read', 'write'],
        revokedBy: 'user-789',
        organizationSlug: undefined,
        createdBy: undefined,
        timestamp: expect.any(String),
      })
    })
  })
})
