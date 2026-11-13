import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Ip,
  Patch,
  Post,
} from "@nestjs/common";
import { IdentityService } from "./identity.service.js";

@Controller("auth")
export class IdentityController {
  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
  ) {}

  @Post("signup")
  signup(
    @Body() body: { email?: string; password?: string; displayName?: string },
  ) {
    return this.identity.signup(
      body.email ?? "",
      body.password ?? "",
      body.displayName,
    );
  }

  @Post("login")
  login(
    @Body() body: { email?: string; password?: string },
    @Ip() clientIp?: string,
  ) {
    return this.identity.login(
      body.email ?? "",
      body.password ?? "",
      clientIp ?? "unknown",
    );
  }

  @Post("refresh")
  refresh(@Body() body: { refreshToken?: string }) {
    return this.identity.refresh(body.refreshToken ?? "");
  }

  @Post("password/forgot")
  requestPasswordReset(
    @Body() body: { email?: string },
    @Ip() clientIp?: string,
  ) {
    return this.identity.requestPasswordReset(
      body.email ?? "",
      clientIp ?? "unknown",
    );
  }

  @Post("password/reset")
  resetPassword(@Body() body: { token?: string; password?: string }) {
    return this.identity.resetPassword(body.token ?? "", body.password ?? "");
  }

  @Post("logout")
  logout(@Headers("authorization") authorization?: string) {
    return this.identity.logout(bearerToken(authorization));
  }

  @Get("me")
  me(@Headers("authorization") authorization?: string) {
    return this.identity.me(bearerToken(authorization));
  }

  @Patch("me")
  async updateMe(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: { displayName?: string },
  ) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.identity.updateDisplayName(user.id, body.displayName ?? "");
  }
}

function bearerToken(authorization?: string): string {
  const [scheme, token] = (authorization ?? "").split(" ");
  return scheme?.toLowerCase() === "bearer" ? (token ?? "") : "";
}
