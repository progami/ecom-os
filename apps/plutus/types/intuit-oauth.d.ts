declare module 'intuit-oauth' {
  interface OAuthClientOptions {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    environment: 'sandbox' | 'production';
  }

  interface TokenData {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    x_refresh_token_expires_in?: number;
  }

  interface AuthResponse {
    getJson(): TokenData;
    getToken(): TokenData;
  }

  interface AuthorizeOptions {
    scope: string[];
    state?: string;
  }

  interface SetTokenOptions {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    expires_in?: number;
  }

  export default class OAuthClient {
    static scopes: {
      Accounting: string;
      Payment: string;
      Payroll: string;
      TimeTracking: string;
      Benefits: string;
      Profile: string;
      Email: string;
      Phone: string;
      Address: string;
      OpenId: string;
    };

    constructor(options: OAuthClientOptions);

    authorizeUri(options: AuthorizeOptions): string;

    createToken(url: string): Promise<AuthResponse>;

    refresh(): Promise<AuthResponse>;

    setToken(token: SetTokenOptions): void;

    getToken(): TokenData;

    isAccessTokenValid(): boolean;

    refreshUsingToken(refreshToken: string): Promise<AuthResponse>;

    revoke(params?: { access_token?: string; refresh_token?: string }): Promise<AuthResponse>;
  }
}
