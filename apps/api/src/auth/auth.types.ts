export type JwtPayload = {
  sub: string;
  email: string;
  jti: string;
};

export type AuthUser = {
  userId: string;
  email: string;
  jti: string;
};
