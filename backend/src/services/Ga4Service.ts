import axios, { AxiosError } from 'axios';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Ga4Integration } from '../models';
import { AppError } from '../middleware/errorHandler';
import { decrypt, encrypt } from './EncryptionService';

const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GA4_RUN_REPORT_URL = 'https://analyticsdata.googleapis.com/v1beta';
const GA4_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

interface UpsertGa4Input {
  propertyId: string;
  measurementId?: string;
  serviceAccountEmail: string;
  privateKey?: string;
}

export interface Ga4IntegrationResponse {
  id: string;
  property_id: string;
  measurement_id: string | null;
  service_account_email: string;
  is_active: boolean;
  has_credentials: boolean;
  last_tested_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

interface GoogleTokenResponse {
  access_token: string;
}

class Ga4Service {
  private normalizePropertyId(propertyId: string): string {
    const normalized = propertyId.trim().replace(/^properties\//, '');
    if (!/^\d+$/.test(normalized)) {
      throw new AppError('propertyId must be a numeric GA4 property id', 400);
    }
    return normalized;
  }

  private normalizeServiceAccountEmail(email: string): string {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new AppError('serviceAccountEmail must be a valid email', 400);
    }
    return normalized;
  }

  private normalizePrivateKey(privateKey: string): string {
    const normalized = privateKey.trim().replace(/\\n/g, '\n');
    if (normalized.length < 32) {
      throw new AppError('privateKey must be provided', 400);
    }
    return normalized;
  }

  private toResponse(integration: Ga4Integration): Ga4IntegrationResponse {
    return {
      id: integration.id,
      property_id: integration.property_id,
      measurement_id: integration.measurement_id || null,
      service_account_email: integration.service_account_email,
      is_active: integration.is_active,
      has_credentials: Boolean(integration.service_account_key_encrypted),
      last_tested_at: integration.last_tested_at || null,
      last_error: integration.last_error || null,
      created_at: integration.created_at,
      updated_at: integration.updated_at,
    };
  }

  async getIntegration(organizationId: string): Promise<Ga4IntegrationResponse | null> {
    const integration = await Ga4Integration.findOne({
      where: { organization_id: organizationId, is_active: true },
    });

    if (!integration) {
      return null;
    }

    return this.toResponse(integration);
  }

  async upsertIntegration(
    organizationId: string,
    input: UpsertGa4Input
  ): Promise<Ga4IntegrationResponse> {
    const propertyId = this.normalizePropertyId(input.propertyId);
    const serviceAccountEmail = this.normalizeServiceAccountEmail(input.serviceAccountEmail);

    const existing = await Ga4Integration.findOne({
      where: { organization_id: organizationId },
    });

    const encryptedKey =
      input.privateKey && input.privateKey.trim() !== ''
        ? encrypt(this.normalizePrivateKey(input.privateKey))
        : existing?.service_account_key_encrypted;

    if (!encryptedKey) {
      throw new AppError('privateKey is required for first configuration', 400);
    }

    const payload = {
      property_id: propertyId,
      measurement_id: input.measurementId?.trim() || null,
      service_account_email: serviceAccountEmail,
      service_account_key_encrypted: encryptedKey,
      is_active: true,
      last_error: null as string | null,
    };

    let integration: Ga4Integration;
    if (existing) {
      await existing.update(payload);
      integration = existing;
    } else {
      integration = await Ga4Integration.create({
        id: uuidv4(),
        organization_id: organizationId,
        ...payload,
      });
    }

    return this.toResponse(integration);
  }

  private async getAccessToken(email: string, privateKey: string): Promise<string> {
    const nowInSeconds = Math.floor(Date.now() / 1000);

    const assertion = jwt.sign(
      {
        iss: email,
        scope: GA4_SCOPE,
        aud: GOOGLE_OAUTH_TOKEN_URL,
        iat: nowInSeconds,
        exp: nowInSeconds + 3600,
      },
      privateKey,
      { algorithm: 'RS256' }
    );

    const params = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    });

    try {
      const response = await axios.post<GoogleTokenResponse>(GOOGLE_OAUTH_TOKEN_URL, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15000,
      });

      return response.data.access_token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          error.response?.data?.error_description ||
          error.response?.data?.error ||
          error.message;
        throw new AppError(`Failed to get Google access token: ${message}`, 400);
      }

      throw error;
    }
  }

  private async runGa4ConnectionTest(propertyId: string, accessToken: string): Promise<void> {
    try {
      await axios.post(
        `${GA4_RUN_REPORT_URL}/properties/${propertyId}:runReport`,
        {
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }],
          limit: 1,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const details =
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          error.message;
        throw new AppError(`GA4 test request failed: ${details}`, 400);
      }

      throw error;
    }
  }

  async testIntegration(organizationId: string): Promise<Ga4IntegrationResponse> {
    const integration = await Ga4Integration.findOne({
      where: { organization_id: organizationId, is_active: true },
    });

    if (!integration) {
      throw new AppError('GA4 integration is not configured', 404);
    }

    try {
      const privateKey = decrypt(integration.service_account_key_encrypted);
      const accessToken = await this.getAccessToken(integration.service_account_email, privateKey);
      await this.runGa4ConnectionTest(integration.property_id, accessToken);

      await integration.update({
        last_tested_at: new Date(),
        last_error: null,
      });

      return this.toResponse(integration);
    } catch (error) {
      const errorMessage =
        error instanceof AppError
          ? error.message
          : axios.isAxiosError(error)
            ? ((error as AxiosError).message || 'Unknown error')
            : 'Unknown error';

      await integration.update({
        last_error: errorMessage,
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(`Failed to validate GA4 integration: ${errorMessage}`, 400);
    }
  }

  async disconnectIntegration(organizationId: string): Promise<void> {
    const integration = await Ga4Integration.findOne({
      where: { organization_id: organizationId, is_active: true },
    });

    if (!integration) {
      return;
    }

    await integration.update({
      is_active: false,
    });
  }
}

export default new Ga4Service();
