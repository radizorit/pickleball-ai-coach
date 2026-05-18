import { Global, Module } from "@nestjs/common";

import { AUTH_PORT } from "./auth.port.js";
import { AuthGuard } from "./auth.guard.js";
import { ClerkAuthVerifier } from "./clerk-auth.verifier.js";

@Global()
@Module({
  providers: [
    AuthGuard,
    {
      provide: AUTH_PORT,
      useClass: ClerkAuthVerifier,
    },
  ],
  exports: [AUTH_PORT, AuthGuard],
})
export class AuthModule {}
