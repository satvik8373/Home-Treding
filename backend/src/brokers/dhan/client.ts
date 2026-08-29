import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { DHAN_CONFIG } from './config';
import { logger } from '../../utils/logger';

export class DhanHttpClient {
  private client: AxiosInstance;
  private clientId: string;
  private accessToken: string;

  constructor(clientId: string, accessToken: string) {
    this.clientId = clientId;
    this.accessToken = accessToken;

    this.client = axios.create({
      baseURL: DHAN_CONFIG.BASE_URL,
      timeout: DHAN_CONFIG.TIMEOUT_MS,
      headers: {
        ...DHAN_CONFIG.DEFAULT_HEADERS,
        'access-token': accessToken,
        'client-id': clientId
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`[Dhan API Request] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('[Dhan API Request Error]', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.debug(`[Dhan API Response] ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        const status = error.response?.status;
        const data = error.response?.data;
        logger.error(`[Dhan API Error] Status: ${status}`, {
          url: error.config?.url,
          data: data || error.message
        });

        if (status === 401) {
          const authError = new Error('Dhan Access Token has expired or is invalid. Please reconnect your account.');
          (authError as any).statusCode = 401;
          return Promise.reject(authError);
        }

        if (status === 403) {
          const permError = new Error('Dhan trading permissions not active. Please ensure trading terminal is active in Dhan.');
          (permError as any).statusCode = 403;
          return Promise.reject(permError);
        }

        if (status === 429) {
          const rateError = new Error('Dhan rate limit exceeded. Please wait a moment.');
          (rateError as any).statusCode = 429;
          return Promise.reject(rateError);
        }

        const standardError = new Error(data?.remarks || data?.message || data?.internalErrorMessage || error.message);
        (standardError as any).statusCode = status || 500;
        (standardError as any).dhanData = data;
        return Promise.reject(standardError);
      }
    );
  }

  public updateCredentials(clientId: string, accessToken: string): void {
    this.clientId = clientId;
    this.accessToken = accessToken;
    this.client.defaults.headers['access-token'] = accessToken;
    this.client.defaults.headers['client-id'] = clientId;
  }

  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const res = await this.client.get<T>(url, config);
    return res.data;
  }

  public async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const res = await this.client.post<T>(url, data, config);
    return res.data;
  }

  public async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const res = await this.client.put<T>(url, data, config);
    return res.data;
  }

  public async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const res = await this.client.delete<T>(url, config);
    return res.data;
  }

  public getClientId(): string {
    return this.clientId;
  }
}
