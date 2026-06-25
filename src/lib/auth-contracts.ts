export type AuthUser = {
  name: string;
  cpfMasked: string;
  email: string | null;
};

export type AuthLoginResponse = {
  ok: true;
  data: {
    user: AuthUser;
  };
};

export type AuthRegistrationResponse = AuthLoginResponse;

export type AuthMeResponse = {
  ok: true;
  data: {
    user: AuthUser;
  };
};

export type AuthLogoutResponse = {
  ok: true;
};

export type AuthErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};
